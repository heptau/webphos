/**
 * Photoshop-like neighborhood filters working on ImageData-like objects ({data, width, height}).
 * Alpha channel is preserved. Data is modified in place and the same object is returned.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Pixelate (Mosaic) - replaces each block with its average color
 *
 * @param {Image_data} image
 * @param {number|string} size block size in pixels, 2-200
 * @returns {Image_data}
 */
export function pixelate(image, size) {
	let y, x, p;
	size = clamp(parseInt(size) || 8, 2, 200);
	const w = image.width;
	const h = image.height;
	const data = image.data;
	for (let by = 0; by < h; by += size) {
		for (let bx = 0; bx < w; bx += size) {
			const x_end = Math.min(bx + size, w);
			const y_end = Math.min(by + size, h);
			let r = 0, g = 0, b = 0, count = 0;
			for (y = by; y < y_end; y++) {
				for (x = bx; x < x_end; x++) {
					p = (y * w + x) * 4;
					r += data[p];
					g += data[p + 1];
					b += data[p + 2];
					count++;
				}
			}
			r = Math.round(r / count);
			g = Math.round(g / count);
			b = Math.round(b / count);
			for (y = by; y < y_end; y++) {
				for (x = bx; x < x_end; x++) {
					p = (y * w + x) * 4;
					data[p] = r;
					data[p + 1] = g;
					data[p + 2] = b;
				}
			}
		}
	}
	return image;
}

/**
 * Separable box blur of RGB channels (edge pixels are clamped). Returns new Float32Array (RGBA layout, alpha untouched/zero).
 *
 * @param {Image_data} image
 * @param {number} radius
 * @returns {Float32Array}
 */
function box_blur(image, radius) {
	const w = image.width;
	const h = image.height;
	const src = image.data;
	const tmp = new Float32Array(src.length);
	const out = new Float32Array(src.length);
	const span = radius * 2 + 1;

	//horizontal
	for (let y = 0; y < h; y++) {
		for (let c = 0; c < 3; c++) {
			let sum = 0;
			for (let k = -radius; k <= radius; k++) {
				sum += src[(y * w + clamp(k, 0, w - 1)) * 4 + c];
			}
			for (let x = 0; x < w; x++) {
				tmp[(y * w + x) * 4 + c] = sum / span;
				sum += src[(y * w + clamp(x + radius + 1, 0, w - 1)) * 4 + c];
				sum -= src[(y * w + clamp(x - radius, 0, w - 1)) * 4 + c];
			}
		}
	}
	//vertical
	for (let x2 = 0; x2 < w; x2++) {
		for (let c2 = 0; c2 < 3; c2++) {
			let sum2 = 0;
			for (let k2 = -radius; k2 <= radius; k2++) {
				sum2 += tmp[(clamp(k2, 0, h - 1) * w + x2) * 4 + c2];
			}
			for (let y2 = 0; y2 < h; y2++) {
				out[(y2 * w + x2) * 4 + c2] = sum2 / span;
				sum2 += tmp[(clamp(y2 + radius + 1, 0, h - 1) * w + x2) * 4 + c2];
				sum2 -= tmp[(clamp(y2 - radius, 0, h - 1) * w + x2) * 4 + c2];
			}
		}
	}
	return out;
}

/**
 * Unsharp Mask - sharpens by adding the difference between the image and its blurred copy
 *
 * @param {Image_data} image
 * @param {object} params keys: amount (0-500 %), radius (1-50 px), threshold (0-255)
 * @returns {Image_data}
 */
export function unsharpMask(image, params) {
	const amount = clamp(parseFloat(params.amount ?? 100) || 0, 0, 500) / 100;
	const radius = clamp(parseInt(params.radius ?? 2) || 1, 1, 50);
	const threshold = clamp(parseInt(params.threshold) || 0, 0, 255);

	const blurred = box_blur(image, radius);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < 3; c++) {
			const diff = data[i + c] - blurred[i + c];
			if (Math.abs(diff) >= threshold) {
				data[i + c] += diff * amount;
			}
		}
	}
	return image;
}

/**
 * High Pass - keeps edges and details, everything else becomes mid gray
 *
 * @param {Image_data} image
 * @param {number|string} radius 1-100
 * @returns {Image_data}
 */
export function highPass(image, radius) {
	radius = clamp(parseInt(radius) || 5, 1, 100);
	const blurred = box_blur(image, radius);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < 3; c++) {
			data[i + c] = data[i + c] - blurred[i + c] + 128;
		}
	}
	return image;
}

/**
 * Median - reduces noise by replacing each channel with the median of its neighborhood
 *
 * @param {Image_data} image
 * @param {number|string} radius 1-5
 * @returns {Image_data}
 */
export function median(image, radius) {
	radius = clamp(parseInt(radius) || 1, 1, 5);
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	const values = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			for (let c = 0; c < 3; c++) {
				values.length = 0;
				for (let dy = -radius; dy <= radius; dy++) {
					const yy = clamp(y + dy, 0, h - 1);
					for (let dx = -radius; dx <= radius; dx++) {
						values.push(src[(yy * w + clamp(x + dx, 0, w - 1)) * 4 + c]);
					}
				}
				values.sort((a, b) => { return a - b; });
				data[(y * w + x) * 4 + c] = values[values.length >> 1];
			}
		}
	}
	return image;
}

/**
 * Maximum (dilate lightest values) / Minimum (erode, spreads darkest values)
 *
 * @param {Image_data} image
 * @param {number|string} radius 1-10
 * @param {'maximum'|'minimum'} mode
 * @returns {Image_data}
 */
export function maxMin(image, radius, mode) {
	radius = clamp(parseInt(radius) || 1, 1, 10);
	const is_max = mode == 'maximum';
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const tmp = new Uint8ClampedArray(image.data.length);
	const data = image.data;
	const pick = is_max ? Math.max : Math.min;

	//separable: horizontal then vertical
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			for (let c = 0; c < 3; c++) {
				let v = is_max ? 0 : 255;
				for (let d = -radius; d <= radius; d++) {
					v = pick(v, src[(y * w + clamp(x + d, 0, w - 1)) * 4 + c]);
				}
				tmp[(y * w + x) * 4 + c] = v;
			}
		}
	}
	for (let y2 = 0; y2 < h; y2++) {
		for (let x2 = 0; x2 < w; x2++) {
			for (let c2 = 0; c2 < 3; c2++) {
				let v2 = is_max ? 0 : 255;
				for (let d2 = -radius; d2 <= radius; d2++) {
					v2 = pick(v2, tmp[(clamp(y2 + d2, 0, h - 1) * w + x2) * 4 + c2]);
				}
				data[(y2 * w + x2) * 4 + c2] = v2;
			}
		}
	}
	return image;
}

/**
 * Offset - shifts the image, content leaving one side re-enters on the opposite side (wrap around)
 *
 * @param {Image_data} image
 * @param {number|string} dx horizontal shift in pixels (positive = right)
 * @param {number|string} dy vertical shift in pixels (positive = down)
 * @returns {Image_data}
 */
export function offset(image, dx, dy) {
	const w = image.width;
	const h = image.height;
	if (w == 0 || h == 0) {
		return image;
	}
	dx = ((parseInt(dx) || 0) % w + w) % w;
	dy = ((parseInt(dy) || 0) % h + h) % h;
	if (dx == 0 && dy == 0) {
		return image;
	}
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	for (let y = 0; y < h; y++) {
		const ny = (y + dy) % h;
		for (let x = 0; x < w; x++) {
			const from = (y * w + x) * 4;
			const to = (ny * w + (x + dx) % w) * 4;
			data[to] = src[from];
			data[to + 1] = src[from + 1];
			data[to + 2] = src[from + 2];
			data[to + 3] = src[from + 3];
		}
	}
	return image;
}

/**
 * Motion Blur - averages pixels along a line
 *
 * @param {Image_data} image
 * @param {object} params keys: angle (-180..180 degrees), distance (1-200 px)
 * @returns {Image_data}
 */
export function motionBlur(image, params) {
	const angle = (parseFloat(params.angle) || 0) * Math.PI / 180;
	const distance = clamp(parseInt(params.distance ?? 10) || 1, 1, 200);
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	const dx = Math.cos(angle);
	const dy = -Math.sin(angle);
	const samples = distance * 2 + 1;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let r = 0, g = 0, b = 0;
			for (let s = -distance; s <= distance; s++) {
				const sx = clamp(Math.round(x + dx * s), 0, w - 1);
				const sy = clamp(Math.round(y + dy * s), 0, h - 1);
				const p = (sy * w + sx) * 4;
				r += src[p];
				g += src[p + 1];
				b += src[p + 2];
			}
			const q = (y * w + x) * 4;
			data[q] = r / samples;
			data[q + 1] = g / samples;
			data[q + 2] = b / samples;
		}
	}
	return image;
}

/**
 * Clarity - local contrast: large-radius unsharp mask weighted towards midtones
 *
 * @param {Image_data} image
 * @param {number|string} amount -100..100 (negative softens)
 * @param {number|string} [radius] default 20
 * @returns {Image_data}
 */
export function clarity(image, amount, radius) {
	amount = clamp(parseFloat(amount) || 0, -100, 100) / 100;
	radius = clamp(parseInt(radius ?? 20) || 20, 1, 100);
	if (amount == 0) {
		return image;
	}
	const blurred = box_blur(image, radius);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < 3; c++) {
			const value = data[i + c];
			const weight = 1 - Math.pow(Math.abs(value / 127.5 - 1), 2); //0 at black/white, 1 at mid gray
			data[i + c] = value + (value - blurred[i + c]) * amount * weight * 1.5;
		}
	}
	return image;
}

/**
 * Mirror - copies one half of the image mirrored onto the other half (symmetry)
 *
 * @param {Image_data} image
 * @param {'left'|'right'|'top'|'bottom'} source half that is kept and mirrored
 * @returns {Image_data}
 */
export function mirror(image, source) {
	const w = image.width;
	const h = image.height;
	const data = image.data;
	const horizontal = source == 'left' || source == 'right';
	if (!horizontal && source != 'top' && source != 'bottom') {
		return image;
	}
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let sx = x, sy = y;
			if (source == 'left' && x >= w / 2) sx = w - 1 - x;
			else if (source == 'right' && x < w / 2) sx = w - 1 - x;
			else if (source == 'top' && y >= h / 2) sy = h - 1 - y;
			else if (source == 'bottom' && y < h / 2) sy = h - 1 - y;
			if (sx != x || sy != y) {
				const from = (sy * w + sx) * 4;
				const to = (y * w + x) * 4;
				data[to] = data[from];
				data[to + 1] = data[from + 1];
				data[to + 2] = data[from + 2];
				data[to + 3] = data[from + 3];
			}
		}
	}
	return image;
}

/**
 * Smart Blur - blurs only between pixels of similar luminance, so edges stay sharp
 *
 * @param {Image_data} image
 * @param {object} params keys: radius (1-10), threshold (1-255)
 * @returns {Image_data}
 */
export function smartBlur(image, params) {
	const radius = clamp(parseInt(params.radius ?? 3) || 1, 1, 10);
	const threshold = clamp(parseInt(params.threshold ?? 25) || 1, 1, 255);
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;

	function lum(p) {
		return 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];
	}

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const center = (y * w + x) * 4;
			const center_lum = lum(center);
			let r = 0, g = 0, b = 0, count = 0;
			for (let dy = -radius; dy <= radius; dy++) {
				const yy = y + dy;
				if (yy < 0 || yy >= h) continue;
				for (let dx = -radius; dx <= radius; dx++) {
					const xx = x + dx;
					if (xx < 0 || xx >= w) continue;
					const p = (yy * w + xx) * 4;
					if (Math.abs(lum(p) - center_lum) <= threshold) {
						r += src[p];
						g += src[p + 1];
						b += src[p + 2];
						count++;
					}
				}
			}
			data[center] = r / count;
			data[center + 1] = g / count;
			data[center + 2] = b / count;
		}
	}
	return image;
}

/**
 * Convolution of the color channels with a 3x3 kernel (edges are clamped), alpha is preserved.
 *
 * @param {Image_data} image
 * @param {number[]} kernel 9 values, row by row
 * @param {number} offset added to every result (128 gives the gray base of the emboss)
 * @returns {Image_data}
 */
function convolve3(image, kernel, offset) {
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			for (let c = 0; c < 3; c++) {
				let sum = 0;
				for (let ky = -1; ky <= 1; ky++) {
					const yy = clamp(y + ky, 0, h - 1);
					for (let kx = -1; kx <= 1; kx++) {
						sum += kernel[(ky + 1) * 3 + kx + 1] * src[(yy * w + clamp(x + kx, 0, w - 1)) * 4 + c];
					}
				}
				data[(y * w + x) * 4 + c] = clamp(Math.round(sum + offset), 0, 255);
			}
		}
	}
	return image;
}

/**
 * Emboss - the image turns into a gray relief lit from the given direction
 *
 * @param {Image_data} image
 * @param {object} params keys: angle (0-360 degrees, where the light comes from), amount (1-500 %)
 * @returns {Image_data}
 */
export function emboss(image, params) {
	const angle = (parseFloat(params.angle) || 0) * Math.PI / 180;
	const amount = clamp(parseFloat(params.amount ?? 100) || 0, 1, 500) / 100;
	//the gradient along the direction of the light (y goes down)
	const dx = Math.cos(angle) * amount;
	const dy = -Math.sin(angle) * amount;
	const kernel = [
		-dx - dy, -dy, dx - dy,
		-dx, 0, dx,
		-dx + dy, dy, dx + dy,
	].map((value) => { return value / 2; });
	desaturate_in_place(image);
	return convolve3(image, kernel, 128);
}

/**
 * Find Edges - bright lines on a white background where the colors change (Sobel operator)
 *
 * @param {Image_data} image
 * @returns {Image_data}
 */
export function findEdges(image) {
	let y, x, c;
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	for (y = 0; y < h; y++) {
		for (x = 0; x < w; x++) {
			const index = (y * w + x) * 4;
			for (c = 0; c < 3; c++) {
				const p = function (dx, dy) {
					return src[(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4 + c];
				};
				const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
				const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
				data[index + c] = clamp(Math.round(255 - Math.hypot(gx, gy)), 0, 255);
			}
		}
	}
	return image;
}

function desaturate_in_place(image) {
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
		data[i] = data[i + 1] = data[i + 2] = gray;
	}
}

/**
 * Surface Blur - smooths the flat areas but keeps the edges: a neighbor counts only as much as its color is close
 * to the color of the pixel (bilateral filter).
 *
 * @param {Image_data} image
 * @param {object} params radius (1-10 pixels), threshold (1-255, how different colors still get mixed)
 * @returns {Image_data}
 */
export function surfaceBlur(image, params) {
	const radius = clamp(parseInt(params.radius ?? 3) || 3, 1, 10);
	const threshold = clamp(parseFloat(params.threshold ?? 30) || 30, 1, 255);
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	//big radii look at every second neighbor, it is enough for a blur
	const step = radius > 5 ? 2 : 1;
	const limit = threshold * 3;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const r0 = src[i], g0 = src[i + 1], b0 = src[i + 2];
			let sum_r = 0, sum_g = 0, sum_b = 0, total = 0;
			for (let dy = -radius; dy <= radius; dy++) {
				if (dy % step != 0) {
					continue;
				}
				const yy = clamp(y + dy, 0, h - 1);
				for (let dx = -radius; dx <= radius; dx++) {
					if (dx % step != 0) {
						continue;
					}
					const j = (yy * w + clamp(x + dx, 0, w - 1)) * 4;
					const difference = Math.abs(src[j] - r0) + Math.abs(src[j + 1] - g0) + Math.abs(src[j + 2] - b0);
					if (difference >= limit) {
						continue;
					}
					const weight = 1 - difference / limit;
					sum_r += src[j] * weight;
					sum_g += src[j + 1] * weight;
					sum_b += src[j + 2] * weight;
					total += weight;
				}
			}
			//the pixel itself always has weight 1, so total is never 0
			data[i] = sum_r / total;
			data[i + 1] = sum_g / total;
			data[i + 2] = sum_b / total;
		}
	}
	return image;
}
