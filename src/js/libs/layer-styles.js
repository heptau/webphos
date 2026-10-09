/**
 * Layer styles built from CSS filter chains (applied through ctx.filter), so they are live, non-destructive
 * layer filters just like the Shadow effect. Values are always sanitized, because filter parameters
 * can come from saved projects.
 */

export function clamp_int(value, min, max, fallback) {
	let number = parseInt(value);
	if (isNaN(number)) {
		number = fallback;
	}
	return Math.min(max, Math.max(min, number));
}

/**
 * @param {string} color
 * @returns {string} the color when it is a hex color, black otherwise
 */
export function safe_color(color) {
	return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(color)) ? String(color) : '#000000';
}

/**
 * [r, g, b] of a hex color (black for anything else)
 *
 * @param {string} color
 * @returns {number[]}
 */
export function parse_color(color) {
	let hex = safe_color(color).slice(1);
	if (hex.length <= 4) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/**
 * Coverage of the area within `size` pixels from the "source" pixels (round, anti-aliased edge).
 * Uses a 3-4 chamfer distance transform, so the cost does not depend on the size.
 *
 * @param {function(number): boolean} is_source tells whether the pixel at the given index is a source (distance 0)
 * @param {number} width
 * @param {number} height
 * @param {number} size distance in pixels
 * @returns {Uint8ClampedArray} width * height values, source pixels are 255
 */
function distance_coverage(is_source, width, height, size) {
	const INF = 0x3fffffff;
	const distance = new Int32Array(width * height);
	for (let i = 0; i < distance.length; i++) {
		distance[i] = is_source(i) ? 0 : INF;
	}
	let x, y, p, best;
	//forward pass
	for (y = 0; y < height; y++) {
		for (x = 0; x < width; x++) {
			p = y * width + x;
			best = distance[p];
			if (x > 0 && distance[p - 1] + 3 < best) best = distance[p - 1] + 3;
			if (y > 0) {
				if (distance[p - width] + 3 < best) best = distance[p - width] + 3;
				if (x > 0 && distance[p - width - 1] + 4 < best) best = distance[p - width - 1] + 4;
				if (x < width - 1 && distance[p - width + 1] + 4 < best) best = distance[p - width + 1] + 4;
			}
			distance[p] = best;
		}
	}
	//backward pass
	for (y = height - 1; y >= 0; y--) {
		for (x = width - 1; x >= 0; x--) {
			p = y * width + x;
			best = distance[p];
			if (x < width - 1 && distance[p + 1] + 3 < best) best = distance[p + 1] + 3;
			if (y < height - 1) {
				if (distance[p + width] + 3 < best) best = distance[p + width] + 3;
				if (x < width - 1 && distance[p + width + 1] + 4 < best) best = distance[p + width + 1] + 4;
				if (x > 0 && distance[p + width - 1] + 4 < best) best = distance[p + width - 1] + 4;
			}
			distance[p] = best;
		}
	}
	const limit = size * 3;
	const result = new Uint8ClampedArray(width * height);
	for (let k = 0; k < result.length; k++) {
		const d = distance[k];
		result[k] = d <= limit ? 255 : (d < limit + 3 ? Math.round(255 * (limit + 3 - d) / 3) : 0);
	}
	return result;
}

/**
 * Coverage of an outline around the non transparent pixels: 255 within `size` pixels (round, anti-aliased edge).
 *
 * @param {Uint8ClampedArray} alpha alpha channel of the image, width * height values
 * @param {number} width
 * @param {number} height
 * @param {number} size outline width in pixels, 1-100
 * @returns {Uint8ClampedArray} width * height values, pixels of the image itself are 255 too
 */
export function outline_alpha(alpha, width, height, size) {
	size = clamp_int(size, 1, 100, 1);
	return distance_coverage((i) => { return alpha[i] >= 64; }, width, height, size);
}

/**
 * Coverage of a band inside the non transparent pixels along their edge: 255 for pixels of the image that are
 * within `size` pixels of a transparent pixel (pixels outside of the image are 0).
 * The image must be surrounded by transparent pixels (or the edge of the image counts as a border).
 *
 * @param {Uint8ClampedArray} alpha alpha channel of the image, width * height values
 * @param {number} width
 * @param {number} height
 * @param {number} size band width in pixels, 1-100
 * @returns {Uint8ClampedArray} width * height values
 */
export function inner_outline_alpha(alpha, width, height, size) {
	size = clamp_int(size, 1, 100, 1);
	const band = distance_coverage((i) => { return alpha[i] < 64; }, width, height, size);
	for (let i = 0; i < band.length; i++) {
		band[i] = alpha[i] >= 64 ? band[i] : 0;
	}
	return band;
}

/**
 * Soft glow around the opaque part of the layer; strength stacks the glow to make it denser.
 *
 * @param {number} size blur radius 1-100 px
 * @param {number} strength 1-5
 * @param {string} color
 * @returns {string} value for ctx.filter
 */
export function glow_filter(size, strength, color) {
	size = clamp_int(size, 1, 100, 10);
	strength = clamp_int(strength, 1, 5, 2);
	color = safe_color(color);
	const parts = [];
	for (let i = 0; i < strength; i++) {
		parts.push(`drop-shadow(0px 0px ${size}px ${color})`);
	}
	return parts.join(' ');
}

/**
 * End points of a linear gradient that runs across a box at the given angle
 * so that the first color touches the box at one corner and the last color at the opposite one.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} angle in degrees, 0 = left to right, 90 = top to bottom
 * @returns {{x0: number, y0: number, x1: number, y1: number}}
 */
export function gradient_line(width, height, angle) {
	const radians = (parseFloat(angle) || 0) * Math.PI / 180;
	const dx = Math.cos(radians);
	const dy = Math.sin(radians);
	const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
	const cx = width / 2;
	const cy = height / 2;
	return {x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half};
}

/**
 * Smallest rectangle containing all pixels that are not fully transparent
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @returns {{x: number, y: number, width: number, height: number}|null} null for an empty image
 */
export function alpha_bounds(image) {
	const w = image.width;
	const h = image.height;
	let min_x = w, min_y = h, max_x = -1, max_y = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (image.data[(y * w + x) * 4 + 3] > 0) {
				if (x < min_x) min_x = x;
				if (x > max_x) max_x = x;
				if (y < min_y) min_y = y;
				if (y > max_y) max_y = y;
			}
		}
	}
	return max_x < 0 ? null : {x: min_x, y: min_y, width: max_x - min_x + 1, height: max_y - min_y + 1};
}

export const BLEND_MODES = [
	'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
	'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

/**
 * Canvas composite operation for a blend mode name; unknown names fall back to normal blending.
 *
 * @param {string} mode
 * @returns {string} value for ctx.globalCompositeOperation, or null for "keep the current operation" (normal)
 */
export function blend_operation(mode) {
	return BLEND_MODES.indexOf(mode) > 0 ? mode : null;
}

/**
 * Parses gradient stops written as text: "#ff0000 0, #ffff00 40%, #0000ff 100"
 * (a hex color and a position 0-100 separated by commas). Invalid parts are skipped.
 *
 * @param {string} text
 * @returns {{color: string, position: number}[]|null} stops sorted by position (0..1), null when fewer than 2 are valid
 */
export function parse_gradient_stops(text) {
	if (typeof text !== 'string' || text.trim() === '') {
		return null;
	}
	const stops = [];
	text.split(',').slice(0, 20).forEach((part) => {
		const match = /^\s*(#[0-9a-f]{3}|#[0-9a-f]{6})\s+(\d{1,3}(?:\.\d+)?)\s*%?\s*$/i.exec(part);
		if (match) {
			stops.push({color: safe_color(match[1]), position: Math.min(1, Math.max(0, parseFloat(match[2]) / 100))});
		}
	});
	if (stops.length < 2) {
		return null;
	}
	return stops.sort((a, b) => { return a.position - b.position; });
}
