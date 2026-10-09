/**
 * Patch Tool (Photoshop): a blemish is covered with the picture of a clean place. The texture comes from the clean place,
 * the colors and the brightness from the surroundings of the blemish, so the patch does not show. Pure functions, no DOM.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Mean over a (2r+1) x (2r+1) window (the window shrinks at the edges), done in two passes with running sums.
 *
 * @param {Float32Array} src
 * @param {number} w
 * @param {number} h
 * @param {number} r
 * @returns {Float32Array}
 */
export function box_blur(src, w, h, r) {
	r = Math.max(0, Math.round(r));
	if (r == 0) {
		return new Float32Array(src);
	}
	const tmp = new Float32Array(w * h);
	const out = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		let sum = 0;
		const row = y * w;
		for (let x = -r; x < w; x++) {
			if (x + r < w) {
				sum += src[row + x + r];
			}
			if (x - r - 1 >= 0) {
				sum -= src[row + x - r - 1];
			}
			if (x >= 0) {
				tmp[row + x] = sum / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1);
			}
		}
	}
	for (let x2 = 0; x2 < w; x2++) {
		let total = 0;
		for (let y2 = -r; y2 < h; y2++) {
			if (y2 + r < h) {
				total += tmp[(y2 + r) * w + x2];
			}
			if (y2 - r - 1 >= 0) {
				total -= tmp[(y2 - r - 1) * w + x2];
			}
			if (y2 >= 0) {
				out[y2 * w + x2] = total / (Math.min(h - 1, y2 + r) - Math.max(0, y2 - r) + 1);
			}
		}
	}
	return out;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {{x: number, y: number}[]} polygon
 * @returns {boolean} the point is inside of the polygon
 */
export function point_in_polygon(x, y, polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i];
		const b = polygon[j];
		if ((a.y > y) != (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Covers the masked part of the picture with the picture of the place that is (dx, dy) away.
 *
 * @param {Image_data} image changed in place; it has to contain the masked part, the place it is copied from and some
 *   room around them (the colors of the surroundings are taken from there)
 * @param {{data: Uint8ClampedArray, width: number, height: number}} mask the part to cover, same size as the image (0-255)
 * @param {number} dx the clean place is dx pixels to the right of the blemish
 * @param {number} dy and dy pixels down
 * @param {object} [options] adapt (0-100 %, how much the colors follow the surroundings, default 100), radius
 *   (pixels used to find the colors of the surroundings, default from the size of the part: half of it + 4)
 * @returns {Image_data} the image
 */
export function patch_region(image, mask, dx, dy, options) {
	options = options || {};
	const w = image.width;
	const h = image.height;
	dx = Math.round(dx) || 0;
	dy = Math.round(dy) || 0;
	const adapt = clamp(parseFloat(options.adapt ?? 100), 0, 100) / 100;

	//where the mask is
	let left = w, top = h, right = -1, bottom = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (mask.data[y * w + x] > 0) {
				left = Math.min(left, x);
				right = Math.max(right, x);
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
		}
	}
	if (right < 0 || (dx == 0 && dy == 0)) {
		return image;
	}
	//far enough to reach the surroundings from the middle of the part
	const radius = clamp(Math.round(options.radius ?? Math.max(right - left + 1, bottom - top + 1) / 2 + 4), 4, 60);

	const src = new Uint8ClampedArray(image.data);
	const coverage = new Float32Array(w * h);
	const outside = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) {
		coverage[i] = mask.data[i] / 255;
		outside[i] = 1 - coverage[i];
	}
	//the edge of the patch fades out over a few pixels
	const feathered = box_blur(coverage, w, h, 2);
	const weight = box_blur(outside, w, h, radius);

	const channels = [];
	for (let c = 0; c < 3; c++) {
		const plain = new Float32Array(w * h);
		const surround = new Float32Array(w * h);
		for (let k = 0; k < w * h; k++) {
			plain[k] = src[k * 4 + c];
			surround[k] = src[k * 4 + c] * outside[k];
		}
		channels.push({
			source: box_blur(plain, w, h, radius), //the colors around the clean place
			target: box_blur(surround, w, h, radius), //the colors around the blemish, without the blemish itself
		});
	}

	for (let yy = Math.max(0, top - 2); yy <= Math.min(h - 1, bottom + 2); yy++) {
		for (let xx = Math.max(0, left - 2); xx <= Math.min(w - 1, right + 2); xx++) {
			const p = yy * w + xx;
			const amount = Math.max(feathered[p], coverage[p]);
			if (amount <= 0) {
				continue;
			}
			const sx = xx + dx;
			const sy = yy + dy;
			if (sx < 0 || sy < 0 || sx >= w || sy >= h) {
				continue;
			}
			const q = sy * w + sx;
			for (let ch = 0; ch < 3; ch++) {
				let value = src[q * 4 + ch];
				if (weight[p] > 0.02) {
					//the texture of the clean place with the colors of the surroundings of the blemish
					const shift = channels[ch].target[p] / weight[p] - channels[ch].source[q];
					value += shift * adapt;
				}
				value = clamp(value, 0, 255);
				image.data[p * 4 + ch] = Math.round(src[p * 4 + ch] + (value - src[p * 4 + ch]) * amount);
			}
			//the alpha of the clean place goes in too, so a blemish on a transparent edge does not stay
			image.data[p * 4 + 3] = Math.round(src[p * 4 + 3] + (src[q * 4 + 3] - src[p * 4 + 3]) * amount);
		}
	}
	return image;
}

/**
 * @typedef {{x: number, y: number, width: number, height: number, width_original: number, height_original: number, rotate?: number|null}} Patch_layer
 */

/**
 * Where a point of the picture lies in the pixels of an image layer, also when the layer is turned or stretched
 *
 * @param {Patch_layer} layer
 * @param {number} x
 * @param {number} y
 * @returns {{x: number, y: number}}
 */
export function picture_to_layer(layer, x, y) {
	const radians = -(layer.rotate || 0) * Math.PI / 180;
	const dx = x - (layer.x + layer.width / 2);
	const dy = y - (layer.y + layer.height / 2);
	const rx = dx * Math.cos(radians) - dy * Math.sin(radians);
	const ry = dx * Math.sin(radians) + dy * Math.cos(radians);
	return {
		x: rx * (layer.width_original / (layer.width || 1)) + layer.width_original / 2,
		y: ry * (layer.height_original / (layer.height || 1)) + layer.height_original / 2,
	};
}

/**
 * A move on the picture as a move in the pixels of the layer
 *
 * @param {Patch_layer} layer
 * @param {number} dx
 * @param {number} dy
 * @returns {{x: number, y: number}}
 */
export function vector_to_layer(layer, dx, dy) {
	const radians = -(layer.rotate || 0) * Math.PI / 180;
	return {
		x: (dx * Math.cos(radians) - dy * Math.sin(radians)) * (layer.width_original / (layer.width || 1)),
		y: (dx * Math.sin(radians) + dy * Math.cos(radians)) * (layer.height_original / (layer.height || 1)),
	};
}
