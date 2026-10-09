/**
 * Blend If (Photoshop): the layer shows only where its own brightness and / or the brightness of what is below it
 * is inside a range. The edges of the range can be soft.
 * Stored as layer.blend_if = {this: [a, b, c, d], below: [a, b, c, d]}: the layer is hidden under `a`, fades in up to `b`,
 * is fully there between `b` and `c`, fades out up to `d` and is hidden above `d` (brightness 0-255).
 *
 * @typedef {{this: number[], below: number[]}} Blend_if
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

export const DEFAULT_RANGE = [0, 0, 255, 255];

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * @param {number[]} range
 * @returns {number[]} four numbers 0-255 in a growing order; the default (everything) for anything else
 */
export function normalize_range(range) {
	if (!Array.isArray(range) || range.length != 4) {
		return DEFAULT_RANGE.concat();
	}
	const values = range.map((value) => { return clamp(Math.round(parseFloat(value)) || 0, 0, 255); });
	for (let i = 1; i < 4; i++) {
		values[i] = Math.max(values[i], values[i - 1]);
	}
	return values;
}

/**
 * @param {Blend_if|null|undefined} blend_if
 * @returns {boolean} the layer is not limited in any way
 */
export function is_default(blend_if) {
	if (!blend_if) {
		return true;
	}
	const own = normalize_range(blend_if.this);
	const below = normalize_range(blend_if.below);
	return own.join() == DEFAULT_RANGE.join() && below.join() == DEFAULT_RANGE.join();
}

/**
 * @param {number[]} range
 * @returns {Float32Array} how much of the layer stays for every brightness 0-255
 */
export function range_table(range) {
	const r = normalize_range(range);
	const table = new Float32Array(256);
	for (let v = 0; v < 256; v++) {
		const rise = v < r[0] ? 0 : (v >= r[1] ? 1 : (v - r[0]) / (r[1] - r[0]));
		const fall = v > r[3] ? 0 : (v <= r[2] ? 1 : (r[3] - v) / (r[3] - r[2]));
		table[v] = rise * fall;
	}
	return table;
}

function brightness(data, i) {
	return Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
}

/**
 * Hides the parts of the layer picture that are outside of the ranges (changes its alpha, in place)
 *
 * @param {Image_data} layer the picture of the layer
 * @param {Image_data} backdrop what is below, the same size
 * @param {Blend_if} blend_if
 * @returns {Image_data} the layer
 */
export function apply_blend_if(layer, backdrop, blend_if) {
	const own = range_table(blend_if.this);
	const below = range_table(blend_if.below);
	const data = layer.data;
	const base = backdrop.data;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		const factor = own[brightness(data, i)] * below[brightness(base, i)];
		data[i + 3] = Math.round(data[i + 3] * factor);
	}
	return layer;
}

/**
 * Settings of the dialog (dark point and softness for the dark and the light end) to the stored range
 *
 * @param {number} dark where the layer starts to show
 * @param {number} dark_soft how long it fades in
 * @param {number} light where the layer stops to show
 * @param {number} light_soft how long it fades out before that
 * @returns {number[]}
 */
export function range_from_settings(dark, dark_soft, light, light_soft) {
	const a = clamp(parseFloat(dark) || 0, 0, 255);
	const d = clamp(parseFloat(light ?? 255), 0, 255);
	const b = clamp(a + (parseFloat(dark_soft) || 0), 0, 255);
	const c = clamp(d - (parseFloat(light_soft) || 0), 0, 255);
	return normalize_range([a, b, c, d]);
}

/**
 * @param {number[]} range
 * @returns {{dark: number, dark_soft: number, light: number, light_soft: number}} the same range for the dialog
 */
export function settings_from_range(range) {
	const r = normalize_range(range);
	return {dark: r[0], dark_soft: r[1] - r[0], light: r[3], light_soft: r[3] - r[2]};
}
