/**
 * Selection mask - an 8 bit alpha mask in canvas coordinates (0 = not selected, 255 = fully selected).
 * Pure functions without DOM access, so they are easy to test.
 *
 * @typedef {{width: number, height: number, data: Uint8ClampedArray}} Mask
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 * @typedef {{x: number, y: number, width: number, height: number, width_original: number, height_original: number}} Layer_geometry
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [fill] initial value
 * @returns {Mask}
 */
export function create_mask(width, height, fill) {
	const data = new Uint8ClampedArray(width * height);
	if (fill) {
		data.fill(fill);
	}
	return {width, height, data};
}

/**
 * Rectangular mask (coordinates are rounded and clamped to the canvas)
 *
 * @param {Rect} rect
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @returns {Mask}
 */
export function rect_mask(rect, width, height) {
	const mask = create_mask(width, height);
	const left = clamp(Math.round(rect.x), 0, width);
	const top = clamp(Math.round(rect.y), 0, height);
	const right = clamp(Math.round(rect.x + rect.width), 0, width);
	const bottom = clamp(Math.round(rect.y + rect.height), 0, height);
	for (let y = top; y < bottom; y++) {
		mask.data.fill(255, y * width + left, y * width + right);
	}
	return mask;
}

/**
 * Elliptical mask inscribed in the rectangle (hard edge)
 *
 * @param {Rect} rect
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @returns {Mask}
 */
export function ellipse_mask(rect, width, height) {
	const mask = create_mask(width, height);
	const rx = rect.width / 2;
	const ry = rect.height / 2;
	if (rx <= 0 || ry <= 0) {
		return mask;
	}
	const cx = rect.x + rx;
	const cy = rect.y + ry;
	const top = clamp(Math.floor(rect.y), 0, height);
	const bottom = clamp(Math.ceil(rect.y + rect.height), 0, height);
	const left = clamp(Math.floor(rect.x), 0, width);
	const right = clamp(Math.ceil(rect.x + rect.width), 0, width);
	for (let y = top; y < bottom; y++) {
		const dy = (y + 0.5 - cy) / ry;
		for (let x = left; x < right; x++) {
			const dx = (x + 0.5 - cx) / rx;
			if (dx * dx + dy * dy <= 1) {
				mask.data[y * width + x] = 255;
			}
		}
	}
	return mask;
}

/**
 * Rectangle with rounded corners (the edge is smooth)
 *
 * @param {Rect} rect
 * @param {number} radius corner radius in pixels, at most half of the shorter side
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @returns {Mask}
 */
export function rounded_rect_mask(rect, radius, width, height) {
	const mask = create_mask(width, height);
	if (rect.width <= 0 || rect.height <= 0) {
		return mask;
	}
	const r = clamp(radius, 0, Math.min(rect.width, rect.height) / 2);
	const top = clamp(Math.floor(rect.y), 0, height);
	const bottom = clamp(Math.ceil(rect.y + rect.height), 0, height);
	const left = clamp(Math.floor(rect.x), 0, width);
	const right = clamp(Math.ceil(rect.x + rect.width), 0, width);
	const half_w = rect.width / 2;
	const half_h = rect.height / 2;
	const center_x = rect.x + half_w;
	const center_y = rect.y + half_h;
	for (let y = top; y < bottom; y++) {
		for (let x = left; x < right; x++) {
			//signed distance from the edge of the rounded rectangle (negative inside)
			const qx = Math.abs(x + 0.5 - center_x) - (half_w - r);
			const qy = Math.abs(y + 0.5 - center_y) - (half_h - r);
			const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
			//half a pixel of anti-aliasing at the edge
			mask.data[y * width + x] = Math.round(clamp(0.5 - distance, 0, 1) * 255);
		}
	}
	return mask;
}

/**
 * @param {Mask} mask
 * @returns {Mask} new mask with inverted values
 */
export function invert_mask(mask) {
	const result = create_mask(mask.width, mask.height);
	for (let i = 0; i < mask.data.length; i++) {
		result.data[i] = 255 - mask.data[i];
	}
	return result;
}

/**
 * Smallest rectangle containing all pixels with value > 0
 *
 * @param {Mask} mask
 * @returns {Rect|null} null for an empty mask
 */
export function mask_bounds(mask) {
	const w = mask.width;
	const h = mask.height;
	let min_x = w, min_y = h, max_x = -1, max_y = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (mask.data[y * w + x] > 0) {
				if (x < min_x) min_x = x;
				if (x > max_x) max_x = x;
				if (y < min_y) min_y = y;
				if (y > max_y) max_y = y;
			}
		}
	}
	if (max_x < 0) {
		return null;
	}
	return {x: min_x, y: min_y, width: max_x - min_x + 1, height: max_y - min_y + 1};
}

/**
 * Feather - soft edge, approximates a gaussian blur using 3 box blur passes (edges are clamped)
 *
 * @param {Mask} mask
 * @param {number} radius in pixels, 0-250
 * @returns {Mask} new mask
 */
export function feather_mask(mask, radius) {
	radius = clamp(Math.round(radius) || 0, 0, 250);
	const w = mask.width;
	const h = mask.height;
	const current = new Float32Array(mask.data);
	if (radius == 0) {
		return {width: w, height: h, data: new Uint8ClampedArray(mask.data)};
	}
	//box radius for a total gaussian sigma ~ radius / 2 using 3 passes
	const box = Math.max(1, Math.round(radius / 2));
	const tmp = new Float32Array(current.length);
	for (let pass = 0; pass < 3; pass++) {
		box_pass(current, tmp, w, h, box, true);
		box_pass(tmp, current, w, h, box, false);
	}
	const data = new Uint8ClampedArray(current.length);
	for (let i = 0; i < current.length; i++) {
		data[i] = Math.round(current[i]);
	}
	return {width: w, height: h, data};
}

function box_pass(src, dst, w, h, radius, horizontal) {
	const span = radius * 2 + 1;
	const lines = horizontal ? h : w;
	const length = horizontal ? w : h;
	const step = horizontal ? 1 : w;
	const line_step = horizontal ? w : 1;
	for (let line = 0; line < lines; line++) {
		const base = line * line_step;
		let sum = 0;
		for (let k = -radius; k <= radius; k++) {
			sum += src[base + clamp(k, 0, length - 1) * step];
		}
		for (let i = 0; i < length; i++) {
			dst[base + i * step] = sum / span;
			sum += src[base + clamp(i + radius + 1, 0, length - 1) * step];
			sum -= src[base + clamp(i - radius, 0, length - 1) * step];
		}
	}
}

/**
 * Expand (positive amount, grows selected area) or contract (negative) the mask with a square kernel
 *
 * @param {Mask} mask
 * @param {number} amount in pixels, clamped to -100..100
 * @returns {Mask} new mask
 */
export function morph_mask(mask, amount) {
	amount = clamp(Math.round(amount) || 0, -100, 100);
	const w = mask.width;
	const h = mask.height;
	if (amount == 0) {
		return {width: w, height: h, data: new Uint8ClampedArray(mask.data)};
	}
	const radius = Math.abs(amount);
	const is_max = amount > 0;
	const tmp = new Uint8ClampedArray(mask.data.length);
	const out = new Uint8ClampedArray(mask.data.length);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let value = is_max ? 0 : 255;
			const from = Math.max(0, x - radius);
			const to = Math.min(w - 1, x + radius);
			for (let k = from; k <= to; k++) {
				const v = mask.data[y * w + k];
				value = is_max ? Math.max(value, v) : Math.min(value, v);
			}
			tmp[y * w + x] = value;
		}
	}
	for (let x2 = 0; x2 < w; x2++) {
		for (let y2 = 0; y2 < h; y2++) {
			let value2 = is_max ? 0 : 255;
			const from2 = Math.max(0, y2 - radius);
			const to2 = Math.min(h - 1, y2 + radius);
			for (let k2 = from2; k2 <= to2; k2++) {
				const v2 = tmp[k2 * w + x2];
				value2 = is_max ? Math.max(value2, v2) : Math.min(value2, v2);
			}
			out[y2 * w + x2] = value2;
		}
	}
	return {width: w, height: h, data: out};
}

/**
 * Mask from pixels with a color similar to the given one. Fully transparent pixels are never selected.
 * Pixels within fuzziness / 2 distance are fully selected, selection fades out until fuzziness.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {number[]} color [r, g, b]
 * @param {number} fuzziness 0-200
 * @returns {Mask}
 */
export function color_range_mask(image, color, fuzziness) {
	let value;
	fuzziness = clamp(parseFloat(fuzziness) || 0, 0, 200);
	const mask = create_mask(image.width, image.height);
	const data = image.data;
	const solid = fuzziness / 2;
	for (let i = 0, p = 0; i < data.length; i += 4, p++) {
		if (data[i + 3] == 0) {
			continue;
		}
		const dr = data[i] - color[0];
		const dg = data[i + 1] - color[1];
		const db = data[i + 2] - color[2];
		const distance = Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
		if (distance <= solid) {
			value = 255;
		} else if (distance >= fuzziness || fuzziness == solid) {
			value = 0;
		} else {
			value = 255 * (fuzziness - distance) / (fuzziness - solid);
		}
		mask.data[p] = value * data[i + 3] / 255;
	}
	return mask;
}

/**
 * Mask from the alpha channel (Select layer transparency)
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @returns {Mask}
 */
export function alpha_mask(image) {
	const mask = create_mask(image.width, image.height);
	for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
		mask.data[p] = image.data[i + 3];
	}
	return mask;
}

/**
 * Mask values for every pixel of a layer image (layer pixel -> canvas coordinates -> mask).
 *
 * @param {Mask} mask
 * @param {Layer_geometry} layer
 * @param {number} width layer image width (usually width_original)
 * @param {number} height layer image height
 * @returns {Uint8ClampedArray} width * height values
 */
export function sample_mask_for_layer(mask, layer, width, height) {
	const result = new Uint8ClampedArray(width * height);
	const scale_x = layer.width / width;
	const scale_y = layer.height / height;
	for (let py = 0; py < height; py++) {
		const cy = Math.floor(layer.y + (py + 0.5) * scale_y);
		if (cy < 0 || cy >= mask.height) {
			continue;
		}
		for (let px = 0; px < width; px++) {
			const cx = Math.floor(layer.x + (px + 0.5) * scale_x);
			if (cx >= 0 && cx < mask.width) {
				result[py * width + px] = mask.data[cy * mask.width + cx];
			}
		}
	}
	return result;
}

/**
 * Mixes the changed image into the original one using the mask (premultiplied alpha aware).
 * The result is written into `changed`.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} original
 * @param {{data: Uint8ClampedArray, width: number, height: number}} changed same size as original
 * @param {Mask} mask
 * @param {Layer_geometry} layer
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} changed
 */
export function blend_with_mask(original, changed, mask, layer) {
	const weights = sample_mask_for_layer(mask, layer, original.width, original.height);
	const o = original.data;
	const c = changed.data;
	for (let p = 0, i = 0; p < weights.length; p++, i += 4) {
		const m = weights[p] / 255;
		if (m == 1) {
			continue;
		}
		if (m == 0) {
			c[i] = o[i];
			c[i + 1] = o[i + 1];
			c[i + 2] = o[i + 2];
			c[i + 3] = o[i + 3];
			continue;
		}
		const a0 = o[i + 3] / 255;
		const a1 = c[i + 3] / 255;
		const a = a0 + (a1 - a0) * m;
		if (a <= 0) {
			c[i] = c[i + 1] = c[i + 2] = c[i + 3] = 0;
			continue;
		}
		for (let k = 0; k < 3; k++) {
			const premultiplied = o[i + k] * a0 + (c[i + k] * a1 - o[i + k] * a0) * m;
			c[i + k] = premultiplied / a;
		}
		c[i + 3] = a * 255;
	}
	return changed;
}

/**
 * Makes the selected pixels transparent (partially for feathered edges). Modifies image in place.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {Mask} mask
 * @param {Layer_geometry} layer
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function erase_with_mask(image, mask, layer) {
	const weights = sample_mask_for_layer(mask, layer, image.width, image.height);
	for (let p = 0, i = 3; p < weights.length; p++, i += 4) {
		image.data[i] = image.data[i] * (255 - weights[p]) / 255;
	}
	return image;
}

/**
 * Anti-aliased mask of a polygon (even-odd rule), 4 sub-scanlines per pixel row with exact horizontal coverage.
 *
 * @param {{x: number, y: number}[]} points polygon vertices in canvas coordinates (implicitly closed)
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @returns {Mask}
 */
export function polygon_mask(points, width, height) {
	const mask = create_mask(width, height);
	if (!points || points.length < 3) {
		return mask;
	}
	const SUB = 4;
	let min_y = Infinity, max_y = -Infinity;
	for (let i = 0; i < points.length; i++) {
		min_y = Math.min(min_y, points[i].y);
		max_y = Math.max(max_y, points[i].y);
	}
	const first_row = clamp(Math.floor(min_y), 0, height);
	const last_row = clamp(Math.ceil(max_y), 0, height);
	const coverage = new Float32Array(width);
	const xs = [];

	for (let y = first_row; y < last_row; y++) {
		coverage.fill(0);
		for (let s = 0; s < SUB; s++) {
			const sy = y + (s + 0.5) / SUB;
			xs.length = 0;
			for (let e = 0; e < points.length; e++) {
				const p1 = points[e];
				const p2 = points[(e + 1) % points.length];
				if ((p1.y <= sy && p2.y > sy) || (p2.y <= sy && p1.y > sy)) {
					xs.push(p1.x + (sy - p1.y) * (p2.x - p1.x) / (p2.y - p1.y));
				}
			}
			xs.sort((a, b) => { return a - b; });
			for (let k = 0; k + 1 < xs.length; k += 2) {
				const x0 = clamp(xs[k], 0, width);
				const x1 = clamp(xs[k + 1], 0, width);
				if (x1 <= x0) {
					continue;
				}
				const ix0 = Math.floor(x0);
				const ix1 = Math.floor(x1);
				if (ix0 == ix1) {
					coverage[ix0] += x1 - x0;
					continue;
				}
				coverage[ix0] += ix0 + 1 - x0;
				for (let x = ix0 + 1; x < ix1; x++) {
					coverage[x] += 1;
				}
				if (ix1 < width) {
					coverage[ix1] += x1 - ix1;
				}
			}
		}
		for (let px = 0; px < width; px++) {
			mask.data[y * width + px] = Math.round(coverage[px] / SUB * 255);
		}
	}
	return mask;
}

/**
 * Combines two masks of the same size
 *
 * @param {Mask} a
 * @param {Mask} b
 * @param {'add'|'subtract'|'intersect'} mode
 * @returns {Mask} new mask
 */
export function combine_masks(a, b, mode) {
	const result = create_mask(a.width, a.height);
	for (let i = 0; i < a.data.length; i++) {
		const va = a.data[i];
		const vb = b.data[i];
		if (mode == 'add') {
			result.data[i] = Math.max(va, vb);
		} else if (mode == 'subtract') {
			result.data[i] = va * (255 - vb) / 255;
		} else {
			result.data[i] = va * vb / 255;
		}
	}
	return result;
}

/**
 * Magic wand - selects pixels similar to the pixel at (x, y).
 * A pixel is similar when none of its channels (including alpha) differs from the seed by more than `tolerance`.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {number} x seed x
 * @param {number} y seed y
 * @param {number} tolerance 0-255
 * @param {boolean} contiguous only pixels connected to the seed (4-connected), otherwise the whole image
 * @returns {Mask}
 */
export function magic_wand_mask(image, x, y, tolerance, contiguous) {
	const w = image.width;
	const h = image.height;
	const mask = create_mask(w, h);
	x = Math.floor(x);
	y = Math.floor(y);
	if (x < 0 || y < 0 || x >= w || y >= h) {
		return mask;
	}
	tolerance = clamp(parseInt(tolerance) || 0, 0, 255);
	const data = image.data;
	const seed = (y * w + x) * 4;
	const sr = data[seed], sg = data[seed + 1], sb = data[seed + 2], sa = data[seed + 3];

	function matches(p) {
		const i = p * 4;
		return Math.abs(data[i] - sr) <= tolerance && Math.abs(data[i + 1] - sg) <= tolerance
			&& Math.abs(data[i + 2] - sb) <= tolerance && Math.abs(data[i + 3] - sa) <= tolerance;
	}

	if (!contiguous) {
		for (let p = 0; p < w * h; p++) {
			if (matches(p)) {
				mask.data[p] = 255;
			}
		}
		return mask;
	}

	//scanline flood fill
	const stack = [y * w + x];
	while (stack.length) {
		const pos = stack.pop();
		const py = Math.floor(pos / w);
		const px = pos - py * w;
		if (mask.data[pos] || !matches(pos)) {
			continue;
		}
		let left = px;
		while (left > 0 && !mask.data[py * w + left - 1] && matches(py * w + left - 1)) {
			left--;
		}
		let right = px;
		while (right < w - 1 && !mask.data[py * w + right + 1] && matches(py * w + right + 1)) {
			right++;
		}
		for (let cx = left; cx <= right; cx++) {
			mask.data[py * w + cx] = 255;
		}
		for (let dy = -1; dy <= 1; dy += 2) {
			const ny = py + dy;
			if (ny < 0 || ny >= h) {
				continue;
			}
			let in_run = false;
			for (let nx = left; nx <= right; nx++) {
				const np = ny * w + nx;
				if (!mask.data[np] && matches(np)) {
					if (!in_run) {
						stack.push(np);
						in_run = true;
					}
				} else {
					in_run = false;
				}
			}
		}
	}
	return mask;
}

/**
 * Keeps only the selected pixels: alpha is multiplied by the mask (soft edges stay semi-transparent).
 * Modifies image in place. Counterpart of erase_with_mask.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {Mask} mask
 * @param {Layer_geometry} layer
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function keep_with_mask(image, mask, layer) {
	const weights = sample_mask_for_layer(mask, layer, image.width, image.height);
	for (let p = 0, i = 3; p < weights.length; p++, i += 4) {
		image.data[i] = image.data[i] * weights[p] / 255;
	}
	return image;
}

/**
 * Nearest neighbour resize of a mask (used when a saved selection is loaded after the canvas size changed)
 *
 * @param {Mask} mask
 * @param {number} width
 * @param {number} height
 * @returns {Mask} new mask
 */
export function resize_mask(mask, width, height) {
	const result = create_mask(width, height);
	if (mask.width == width && mask.height == height) {
		result.data.set(mask.data);
		return result;
	}
	for (let y = 0; y < height; y++) {
		const sy = Math.min(mask.height - 1, Math.floor((y + 0.5) * mask.height / height));
		for (let x = 0; x < width; x++) {
			const sx = Math.min(mask.width - 1, Math.floor((x + 0.5) * mask.width / width));
			result.data[y * width + x] = mask.data[sy * mask.width + sx];
		}
	}
	return result;
}

/**
 * Paints one round dab into the mask.
 *
 * @param {Mask} mask modified in place
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} radius in pixels
 * @param {number} softness 0 (hard edge) - 1 (fades out from the center)
 * @param {'add'|'subtract'} mode add selects, subtract deselects
 * @returns {Rect|null} changed area, null when the dab is completely outside the mask
 */
export function paint_mask_stamp(mask, cx, cy, radius, softness, mode) {
	radius = Math.max(0.5, radius);
	softness = clamp(softness || 0, 0, 1);
	const inner = radius * (1 - softness);
	const left = clamp(Math.floor(cx - radius), 0, mask.width - 1);
	const right = clamp(Math.ceil(cx + radius), 0, mask.width - 1);
	const top = clamp(Math.floor(cy - radius), 0, mask.height - 1);
	const bottom = clamp(Math.ceil(cy + radius), 0, mask.height - 1);
	if (cx + radius < 0 || cy + radius < 0 || cx - radius > mask.width || cy - radius > mask.height) {
		return null;
	}
	for (let y = top; y <= bottom; y++) {
		for (let x = left; x <= right; x++) {
			const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
			if (d > radius) {
				continue;
			}
			const a = d <= inner || radius <= inner ? 1 : (radius - d) / (radius - inner);
			const i = y * mask.width + x;
			if (mode == 'subtract') {
				mask.data[i] = mask.data[i] * (1 - a);
			} else {
				mask.data[i] = Math.max(mask.data[i], 255 * a);
			}
		}
	}
	return {x: left, y: top, width: right - left + 1, height: bottom - top + 1};
}

/**
 * Paints a stroke (dabs along a line) into the mask.
 *
 * @param {Mask} mask modified in place
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {number} radius
 * @param {number} softness 0-1
 * @param {'add'|'subtract'} mode
 * @returns {Rect|null} union of the changed areas
 */
export function paint_mask_line(mask, from, to, radius, softness, mode) {
	const distance = Math.hypot(to.x - from.x, to.y - from.y);
	const spacing = Math.max(1, radius / 3);
	const steps = Math.max(1, Math.ceil(distance / spacing));
	let dirty = null;
	for (let s = 0; s <= steps; s++) {
		const t = s / steps;
		const rect = paint_mask_stamp(mask, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius, softness, mode);
		if (rect == null) {
			continue;
		}
		if (dirty == null) {
			dirty = rect;
		} else {
			const x0 = Math.min(dirty.x, rect.x);
			const y0 = Math.min(dirty.y, rect.y);
			const x1 = Math.max(dirty.x + dirty.width, rect.x + rect.width);
			const y1 = Math.max(dirty.y + dirty.height, rect.y + rect.height);
			dirty = {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
		}
	}
	return dirty;
}

/**
 * Creates a function telling whether a color is within `tolerance` (per channel) of any color
 * of the selected pixels. Colors are indexed in a grid with cells of tolerance size, so a lookup
 * only compares with colors from the 27 neighbouring cells.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {Mask} mask pixels with value >= 128 are the selected ones
 * @param {number} tolerance 0-255
 * @returns {function(number, number, number): boolean}
 */
function build_color_matcher(image, mask, tolerance) {
	const data = image.data;
	const colors = new Set();
	let step = 1;
	const collect = function () {
		colors.clear();
		for (let p = 0, i = 0; p < mask.data.length; p++, i += 4) {
			if (mask.data[p] >= 128 && data[i + 3] > 0) {
				colors.add(((data[i] / step | 0) * step << 16) | ((data[i + 1] / step | 0) * step << 8) | ((data[i + 2] / step | 0) * step));
			}
		}
	};
	collect();
	//too many different colors (photos) - merge similar ones, tolerance grows by the merge error
	while (colors.size > 20000 && step < 32) {
		step *= 2;
		collect();
	}
	const slack = step > 1 ? step - 1 : 0;
	const limit = tolerance + slack;
	const cell = Math.max(1, limit);

	const grid = new Map();
	colors.forEach((color) => {
		const key = (((color >> 16) / cell | 0) * 1024 + ((color >> 8 & 255) / cell | 0)) * 1024 + ((color & 255) / cell | 0);
		const list = grid.get(key);
		if (list) {
			list.push(color);
		} else {
			grid.set(key, [color]);
		}
	});

	return function (r, g, b) {
		const cr = r / cell | 0, cg = g / cell | 0, cb = b / cell | 0;
		for (let a = -1; a <= 1; a++) {
			for (let d = -1; d <= 1; d++) {
				for (let e = -1; e <= 1; e++) {
					const list = grid.get(((cr + a) * 1024 + (cg + d)) * 1024 + (cb + e));
					if (!list) {
						continue;
					}
					for (let k = 0; k < list.length; k++) {
						const color = list[k];
						if (Math.abs((color >> 16) - r) <= limit && Math.abs((color >> 8 & 255) - g) <= limit && Math.abs((color & 255) - b) <= limit) {
							return true;
						}
					}
				}
			}
		}
		return false;
	};
}

/**
 * Select Similar / Grow - extends the selection by pixels whose color is close to the colors already selected.
 * Contiguous (Grow) only adds pixels connected (4-neighbours) to the selection, otherwise (Similar) the whole image is searched.
 * Fully transparent pixels are never added.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {Mask} mask current selection, same size as the image
 * @param {number} tolerance 0-255, maximum difference of any color channel
 * @param {boolean} contiguous
 * @returns {Mask} new mask (the original selection plus the added pixels)
 */
export function select_similar_mask(image, mask, tolerance, contiguous) {
	const w = image.width;
	const h = image.height;
	tolerance = clamp(parseInt(tolerance) || 0, 0, 255);
	const result = {width: w, height: h, data: new Uint8ClampedArray(mask.data)};
	const data = image.data;
	const matches = build_color_matcher(image, mask, tolerance);

	function candidate(p) {
		const i = p * 4;
		return result.data[p] < 128 && data[i + 3] > 0 && matches(data[i], data[i + 1], data[i + 2]);
	}

	if (!contiguous) {
		for (let p = 0; p < w * h; p++) {
			if (candidate(p)) {
				result.data[p] = 255;
			}
		}
		return result;
	}

	const checked = new Uint8Array(w * h);
	const stack = new Int32Array(w * h);
	let top = 0;
	for (let s = 0; s < w * h; s++) {
		if (result.data[s] >= 128) {
			stack[top++] = s;
		}
	}
	while (top > 0) {
		const pos = stack[--top];
		const y = Math.floor(pos / w);
		const x = pos - y * w;
		const neighbours = [x > 0 ? pos - 1 : -1, x < w - 1 ? pos + 1 : -1, y > 0 ? pos - w : -1, y < h - 1 ? pos + w : -1];
		for (let n = 0; n < 4; n++) {
			const q = neighbours[n];
			if (q < 0 || checked[q] || result.data[q] >= 128) {
				continue;
			}
			checked[q] = 1;
			if (candidate(q)) {
				result.data[q] = 255;
				stack[top++] = q;
			}
		}
	}
	return result;
}

/**
 * Contrast - makes soft edges steeper around the 50 % value (100 = almost hard edge, 0 = unchanged)
 *
 * @param {Mask} mask
 * @param {number} amount 0-100
 * @returns {Mask} new mask
 */
export function contrast_mask(mask, amount) {
	amount = clamp(parseFloat(amount) || 0, 0, 100);
	const result = create_mask(mask.width, mask.height);
	if (amount == 0) {
		result.data.set(mask.data);
		return result;
	}
	const slope = 1 + amount / 100 * 20;
	const lookup = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		lookup[v] = Math.round(clamp(((v / 255) - 0.5) * slope + 0.5, 0, 1) * 255);
	}
	for (let i = 0; i < mask.data.length; i++) {
		result.data[i] = lookup[mask.data[i]];
	}
	return result;
}

/**
 * Smooth - rounds corners and removes jagged edges (blur followed by a steep contrast curve)
 *
 * @param {Mask} mask
 * @param {number} radius in pixels, 0-100
 * @returns {Mask} new mask
 */
export function smooth_mask(mask, radius) {
	radius = clamp(Math.round(radius) || 0, 0, 100);
	if (radius == 0) {
		return {width: mask.width, height: mask.height, data: new Uint8ClampedArray(mask.data)};
	}
	return contrast_mask(feather_mask(mask, radius), 100);
}

/**
 * Border - a band of the given width along the edge of the selection (half inside, half outside)
 *
 * @param {Mask} mask
 * @param {number} width in pixels, 1-100
 * @returns {Mask} new mask
 */
export function border_mask(mask, width) {
	const half = Math.max(1, Math.ceil(clamp(Math.round(width) || 1, 1, 100) / 2));
	return combine_masks(morph_mask(mask, half), morph_mask(mask, -half), 'subtract');
}

/**
 * Refine Edge - smooth, feather, contrast and shift edge in this order
 *
 * @param {Mask} mask
 * @param {object} params keys: edge_radius (0-100 px, 0 = off), edge_sensitivity (1-100) - snap to image edges (needs `guide`);
 *   smooth (0-100 px), feather (0-250 px), contrast (0-100 %), shift (-100..100 px)
 * @param {{data: Uint8ClampedArray, width: number, height: number}} [guide] canvas-size image for edge aware refinement
 * @returns {Mask} new mask
 */
export function refine_mask(mask, params, guide) {
	if (guide && parseInt(params.edge_radius) > 0) {
		mask = guided_refine_mask(mask, guide, params.edge_radius, params.edge_sensitivity);
	}
	let result = smooth_mask(mask, params.smooth);
	if (parseInt(params.feather) > 0) {
		result = feather_mask(result, params.feather);
	}
	if (parseFloat(params.contrast) > 0) {
		result = contrast_mask(result, params.contrast);
	}
	if (parseInt(params.shift)) {
		result = morph_mask(result, params.shift);
	}
	return result;
}

/**
 * Outline of a selection for Edit > Stroke Selection
 *
 * @param {Mask} mask
 * @param {number} width in pixels, 1-100
 * @param {'inside'|'center'|'outside'} location where the stroke is placed relative to the selection edge
 * @returns {Mask} new mask
 */
export function stroke_mask(mask, width, location) {
	width = clamp(Math.round(width) || 1, 1, 100);
	if (location == 'inside') {
		return combine_masks(mask, morph_mask(mask, -width), 'subtract');
	}
	if (location == 'outside') {
		return combine_masks(morph_mask(mask, width), mask, 'subtract');
	}
	return border_mask(mask, width);
}

/**
 * Moves the mask by a whole number of pixels, what moves out of the canvas is lost
 *
 * @param {Mask} mask
 * @param {number} dx
 * @param {number} dy
 * @returns {Mask} new mask
 */
export function translate_mask(mask, dx, dy) {
	dx = Math.round(dx) || 0;
	dy = Math.round(dy) || 0;
	const w = mask.width;
	const h = mask.height;
	const result = create_mask(w, h);
	for (let y = 0; y < h; y++) {
		const ny = y + dy;
		if (ny < 0 || ny >= h) {
			continue;
		}
		const from = Math.max(0, -dx);
		const to = Math.min(w, w - dx);
		for (let x = from; x < to; x++) {
			result.data[ny * w + x + dx] = mask.data[y * w + x];
		}
	}
	return result;
}

/**
 * Transform Selection - the selection (not its pixels) is scaled and turned around its center and moved.
 * Every pixel of the result takes its value from the matching place of the original (smooth, so the edge stays soft).
 *
 * @param {Mask} mask
 * @param {object} params scale_x, scale_y (1-1000 %, default 100), rotate (degrees, clockwise), dx, dy (pixels)
 * @returns {Mask} new mask of the same size
 */
export function transform_mask(mask, params) {
	const w = mask.width;
	const h = mask.height;
	const result = create_mask(w, h);
	const bounds = mask_bounds(mask);
	if (bounds == null) {
		return result;
	}
	const sx = clamp(parseFloat(params.scale_x ?? 100) || 100, 1, 1000) / 100;
	const sy = clamp(parseFloat(params.scale_y ?? 100) || 100, 1, 1000) / 100;
	const angle = (parseFloat(params.rotate) || 0) * Math.PI / 180;
	const dx = parseFloat(params.dx) || 0;
	const dy = parseFloat(params.dy) || 0;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;

	//the area the transformed selection can cover (corners of the old bounds), so the rest is not even visited
	let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
	[[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]].forEach((corner) => {
		const ux = (corner[0] - cx) * sx;
		const uy = (corner[1] - cy) * sy;
		const x = cx + dx + ux * cos - uy * sin;
		const y = cy + dy + ux * sin + uy * cos;
		left = Math.min(left, x);
		right = Math.max(right, x);
		top = Math.min(top, y);
		bottom = Math.max(bottom, y);
	});
	const x_from = clamp(Math.floor(left) - 1, 0, w);
	const x_to = clamp(Math.ceil(right) + 1, 0, w);
	const y_from = clamp(Math.floor(top) - 1, 0, h);
	const y_to = clamp(Math.ceil(bottom) + 1, 0, h);

	for (let y = y_from; y < y_to; y++) {
		for (let x = x_from; x < x_to; x++) {
			//back from the result to the original: undo the move, the turn and the scale
			const px = x + 0.5 - cx - dx;
			const py = y + 0.5 - cy - dy;
			const ox = (px * cos + py * sin) / sx + cx - 0.5;
			const oy = (-px * sin + py * cos) / sy + cy - 0.5;
			const x0 = Math.floor(ox);
			const y0 = Math.floor(oy);
			const fx = ox - x0;
			const fy = oy - y0;
			let value = 0;
			for (let j = 0; j < 2; j++) {
				for (let i = 0; i < 2; i++) {
					const xx = x0 + i;
					const yy = y0 + j;
					if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
						continue;
					}
					value += mask.data[yy * w + xx] * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
				}
			}
			result.data[y * w + x] = Math.round(value);
		}
	}
	return result;
}

/**
 * Mean over a (2r+1) x (2r+1) window (the window is shrunk at the edges), separable running sums.
 *
 * @param {Float32Array} src
 * @param {number} w
 * @param {number} h
 * @param {number} r
 * @returns {Float32Array}
 */
function box_mean(src, w, h, r) {
	const tmp = new Float32Array(src.length);
	const out = new Float32Array(src.length);
	let x, y, sum, count, from, to;
	for (y = 0; y < h; y++) {
		sum = 0;
		count = 0;
		for (x = 0; x <= Math.min(r, w - 1); x++) {
			sum += src[y * w + x];
			count++;
		}
		for (x = 0; x < w; x++) {
			tmp[y * w + x] = sum / count;
			from = x - r;
			to = x + r + 1;
			if (to < w) {
				sum += src[y * w + to];
				count++;
			}
			if (from >= 0) {
				sum -= src[y * w + from];
				count--;
			}
		}
	}
	for (x = 0; x < w; x++) {
		sum = 0;
		count = 0;
		for (y = 0; y <= Math.min(r, h - 1); y++) {
			sum += tmp[y * w + x];
			count++;
		}
		for (y = 0; y < h; y++) {
			out[y * w + x] = sum / count;
			from = y - r;
			to = y + r + 1;
			if (to < h) {
				sum += tmp[to * w + x];
				count++;
			}
			if (from >= 0) {
				sum -= tmp[from * w + x];
				count--;
			}
		}
	}
	return out;
}

/**
 * Edge aware refinement of a mask: the edge of the mask is pulled to the nearest strong edge of the image
 * (guided filter, He et al.). Works well for rough lasso or magic wand selections.
 *
 * @param {Mask} mask
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data that guides the mask
 * @param {number} radius search distance in pixels, 1-100 (0 returns a copy)
 * @param {number} sensitivity 1-100, higher snaps to weaker edges too
 * @returns {Mask} new mask
 */
export function guided_refine_mask(mask, image, radius, sensitivity) {
	radius = clamp(Math.round(radius) || 0, 0, 100);
	const w = mask.width;
	const h = mask.height;
	if (radius == 0 || image.width != w || image.height != h) {
		return {width: w, height: h, data: new Uint8ClampedArray(mask.data)};
	}
	const eps = 0.0001 * Math.pow(1000, 1 - clamp(parseFloat(sensitivity) || 50, 1, 100) / 100); //1e-1 (low) .. 1e-4 (high)
	const n = w * h;
	const guide = new Float32Array(n);
	const p = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		guide[i] = (0.299 * image.data[i * 4] + 0.587 * image.data[i * 4 + 1] + 0.114 * image.data[i * 4 + 2]) / 255;
		p[i] = mask.data[i] / 255;
	}
	const mean_i = box_mean(guide, w, h, radius);
	const mean_p = box_mean(p, w, h, radius);
	const ii = new Float32Array(n);
	const ip = new Float32Array(n);
	for (let k = 0; k < n; k++) {
		ii[k] = guide[k] * guide[k];
		ip[k] = guide[k] * p[k];
	}
	const corr_i = box_mean(ii, w, h, radius);
	const corr_ip = box_mean(ip, w, h, radius);
	const a = new Float32Array(n);
	const b = new Float32Array(n);
	for (let m = 0; m < n; m++) {
		const variance = corr_i[m] - mean_i[m] * mean_i[m];
		const covariance = corr_ip[m] - mean_i[m] * mean_p[m];
		a[m] = covariance / (variance + eps);
		b[m] = mean_p[m] - a[m] * mean_i[m];
	}
	const mean_a = box_mean(a, w, h, radius);
	const mean_b = box_mean(b, w, h, radius);
	const result = create_mask(w, h);
	for (let q = 0; q < n; q++) {
		result.data[q] = Math.round(clamp(mean_a[q] * guide[q] + mean_b[q], 0, 1) * 255);
	}
	return result;
}

/**
 * Subject selection - the background is found from the edges of the picture (everything connected to the border
 * that is similar to the colors there), the subject is the rest. Works well for objects on a calm background.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {number} tolerance 0-255 how different from the border color a pixel may be to count as background
 * @param {number} [smooth] radius of edge smoothing in pixels, default 2
 * @returns {Mask}
 */
export function select_subject_mask(image, tolerance, smooth) {
	const w = image.width;
	const h = image.height;
	let background = create_mask(w, h);
	if (w < 3 || h < 3) {
		return background;
	}
	//seeds along the border; each one grows a region of similar colors
	const seeds = [];
	const count = 12;
	for (let k = 0; k <= count; k++) {
		const fx = Math.round((w - 1) * k / count);
		const fy = Math.round((h - 1) * k / count);
		seeds.push([fx, 0], [fx, h - 1], [0, fy], [w - 1, fy]);
	}
	const seen = {};
	seeds.forEach((seed) => {
		const key = `${seed[0]  },${  seed[1]}`;
		if (seen[key]) {
			return;
		}
		seen[key] = true;
		if (background.data[seed[1] * w + seed[0]] == 255) {
			return;
		}
		background = combine_masks(background, magic_wand_mask(image, seed[0], seed[1], tolerance, true), 'add');
	});
	const subject = invert_mask(background);
	return smooth_mask(subject, smooth == undefined ? 2 : smooth);
}

function pixel_luma(data, i) {
	return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/**
 * Luminosity masks - select by brightness. Lights, midtones and darks fade smoothly into each other,
 * so edits made through them look natural.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {'lights'|'midtones'|'darks'} kind
 * @param {number} [strength] 1 - 4, higher numbers narrow the range (Lights 1, 2, 3...), default 1
 * @returns {Mask}
 */
export function luminosity_mask(image, kind, strength) {
	let value;
	const power = clamp(parseInt(strength) || 1, 1, 4);
	const mask = create_mask(image.width, image.height);
	const data = image.data;
	for (let p = 0; p < mask.data.length; p++) {
		const i = p * 4;
		if (data[i + 3] == 0) {
			continue;
		}
		const l = pixel_luma(data, i) / 255;
		if (kind == 'lights') {
			value = l;
		}
		else if (kind == 'darks') {
			value = 1 - l;
		}
		else {
			value = 1 - Math.abs(l - 0.5) * 2;
		}
		mask.data[p] = Math.round(Math.pow(clamp(value, 0, 1), power) * 255 * data[i + 3] / 255);
	}
	return mask;
}

/**
 * Edges - selects the places where the picture changes quickly (Sobel filter).
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {number} [sensitivity] 1 - 100, higher selects also weak edges, default 40
 * @returns {Mask}
 */
export function edges_mask(image, sensitivity) {
	const w = image.width;
	const h = image.height;
	const mask = create_mask(w, h);
	const scale = clamp(parseFloat(sensitivity) || 40, 1, 100) / 100 * 4 + 0.2;
	const data = image.data;
	const luma = new Float32Array(w * h);
	for (let p = 0; p < luma.length; p++) {
		luma[p] = pixel_luma(data, p * 4) * (data[p * 4 + 3] / 255);
	}
	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const i = y * w + x;
			const gx = -luma[i - w - 1] - 2 * luma[i - 1] - luma[i + w - 1] + luma[i - w + 1] + 2 * luma[i + 1] + luma[i + w + 1];
			const gy = -luma[i - w - 1] - 2 * luma[i - w] - luma[i - w + 1] + luma[i + w - 1] + 2 * luma[i + w] + luma[i + w + 1];
			mask.data[i] = clamp(Math.round(Math.hypot(gx, gy) / 8 * scale), 0, 255);
		}
	}
	return mask;
}

/**
 * Sky - the sky is what is connected to the top of the picture and is blue, or bright and not colorful.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image canvas-size image data
 * @param {number} [tolerance] 0 - 255 how much the colors of the sky may differ, default 30
 * @returns {Mask}
 */
export function select_sky_mask(image, tolerance) {
	const w = image.width;
	const h = image.height;
	let sky = create_mask(w, h);
	const data = image.data;
	const count = 16;
	for (let k = 0; k <= count; k++) {
		const x = Math.round((w - 1) * k / count);
		const i = x * 4;
		const r = data[i], g = data[i + 1], b = data[i + 2];
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const bluish = b >= r && b >= g * 0.92 && b > 90;
		const bright_gray = max > 170 && (max - min) < 40;
		if (data[i + 3] == 0 || (!bluish && !bright_gray)) {
			continue;
		}
		if (sky.data[x] == 255) {
			continue;
		}
		sky = combine_masks(sky, magic_wand_mask(image, x, 0, tolerance == undefined ? 30 : tolerance, true), 'add');
	}
	return smooth_mask(sky, 2);
}
