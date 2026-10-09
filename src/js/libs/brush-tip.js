/**
 * Custom brush tip (Edit > Define Brush): a picture whose dark and opaque parts become the shape of the brush.
 * Pure functions, no DOM.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

export const MAX_TIP_SIZE = 128;

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [max] longest side of the result
 * @returns {{width: number, height: number}} the size scaled down (never up) to fit, each side at least 1
 */
export function fit_tip_size(width, height, max) {
	max = max || MAX_TIP_SIZE;
	const scale = Math.min(1, max / Math.max(width, height, 1));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/**
 * Turns the picture into a mask: dark = paint, white = no paint, and the transparent parts are no paint either.
 * The result is white with the mask in the alpha channel, so it can be filled with any color later.
 *
 * @param {Image_data} image
 * @returns {Image_data} new image of the same size
 */
export function tip_mask(image) {
	const result = new Uint8ClampedArray(image.data.length);
	for (let i = 0; i < image.data.length; i += 4) {
		const lum = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
		const alpha = (1 - lum / 255) * (image.data[i + 3] / 255);
		result[i] = result[i + 1] = result[i + 2] = 255;
		result[i + 3] = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
	}
	return {data: result, width: image.width, height: image.height};
}

/**
 * @param {Image_data} mask result of tip_mask
 * @returns {boolean} the tip paints something
 */
export function tip_has_paint(mask) {
	for (let i = 3; i < mask.data.length; i += 4) {
		if (mask.data[i] > 8) {
			return true;
		}
	}
	return false;
}

/**
 * Places of the stamps along a stroke: the first point, then one every `spacing` pixels, so the brush leaves an even trace.
 *
 * @param {(number[]|null)[]} points [x, y, size] of the mouse positions, null ends a line
 * @param {number} spacing distance between two stamps in pixels (at least 1)
 * @returns {{x: number, y: number, size: number}[]}
 */
export function stamps_along(points, spacing) {
	spacing = Math.max(1, spacing);
	const stamps = [];
	let previous = null;
	let carry = 0; //distance walked since the last stamp
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		if (point == null) {
			previous = null;
			continue;
		}
		if (previous == null) {
			stamps.push({x: point[0], y: point[1], size: point[2]});
			previous = point;
			carry = 0;
			continue;
		}
		const dx = point[0] - previous[0];
		const dy = point[1] - previous[1];
		const length = Math.hypot(dx, dy);
		let walked = spacing - carry; //where the next stamp is on this segment
		while (walked <= length && length > 0) {
			const k = walked / length;
			stamps.push({x: previous[0] + dx * k, y: previous[1] + dy * k, size: previous[2] + (point[2] - previous[2]) * k});
			walked += spacing;
		}
		carry = length - (walked - spacing);
		previous = point;
	}
	return stamps;
}

const TIP_STORAGE_KEY = 'lumifex_brush_tip';
const MAX_STORED_TIP = 200000;

/**
 * A tip read from storage (or a project) can be anything: only a small PNG data URL with a short id is accepted.
 *
 * @param {any} value
 * @returns {{id: string, data: string}|null}
 */
export function clean_stored_tip(value) {
	if (value == null || typeof value != 'object') {
		return null;
	}
	const id = typeof value.id == 'string' ? value.id : '';
	const data = typeof value.data == 'string' ? value.data : '';
	if (/^[\w.-]{1,40}$/.test(id) == false || data.length > MAX_STORED_TIP || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data) == false) {
		return null;
	}
	return {id, data};
}

/**
 * The tip defined in an earlier session (kept only in this browser)
 *
 * @param {{getItem: function(string): (string|null)}} [storage]
 * @returns {{id: string, data: string}|null}
 */
export function load_stored_tip(storage) {
	try {
		const store = storage || localStorage;
		const raw = store.getItem(TIP_STORAGE_KEY);
		return raw ? clean_stored_tip(JSON.parse(raw)) : null;
	}
	catch {
		return null;
	}
}

/**
 * @param {{id: string, data: string}} tip
 * @param {{setItem: function(string, string): void}} [storage]
 * @returns {boolean} false when it could not be saved (private window, full storage)
 */
export function save_stored_tip(tip, storage) {
	try {
		const clean = clean_stored_tip(tip);
		if (clean == null) {
			return false;
		}
		(storage || localStorage).setItem(TIP_STORAGE_KEY, JSON.stringify(clean));
		return true;
	}
	catch {
		return false;
	}
}
