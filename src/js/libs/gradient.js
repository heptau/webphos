/**
 * Gradients with any number of color stops (Gradient tool + Gradient Editor). Pure functions, no DOM.
 *
 * Stop: {pos: 0..1, color: '#rrggbb', alpha: 0..255}
 */
import { parse_color } from './layer-styles.js';

export const GRADIENT_TYPES = ['Linear', 'Radial', 'Angular', 'Reflected', 'Diamond'];

//the gradient grows from the center of the dragged area (the layer is stored around the center)
export const CENTERED_TYPES = ['Radial', 'Diamond'];

export const MAX_STOPS = 16;

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function to_hex(color) {
	const rgb = parse_color(color);
	return `#${  rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Cleans a list of stops (it can come from a saved project): valid colors, positions 0-1 in order,
 * at most MAX_STOPS, at least two stops.
 *
 * @param {Stop[]} stops
 * @returns {Stop[]}
 */
export function normalize_stops(stops) {
	const list = Array.isArray(stops) ? stops : [];
	const result = list.slice(0, MAX_STOPS).map((stop) => {
		stop = stop || {};
		const alpha = parseFloat(stop.alpha);
		return {
			pos: clamp(parseFloat(stop.pos) || 0, 0, 1),
			color: to_hex(stop.color),
			alpha: isNaN(alpha) ? 255 : clamp(Math.round(alpha), 0, 255),
		};
	});
	result.sort((a, b) => { return a.pos - b.pos; });
	if (result.length == 0) {
		return [{pos: 0, color: '#000000', alpha: 255}, {pos: 1, color: '#ffffff', alpha: 255}];
	}
	if (result.length == 1) {
		result.push({pos: 1, color: result[0].color, alpha: result[0].alpha});
	}
	return result;
}

/**
 * The two-color gradient of the simple tool options
 *
 * @param {string} color_1
 * @param {string} color_2
 * @param {number} alpha opacity of the second color (0-255)
 * @returns {Stop[]}
 */
export function simple_stops(color_1, color_2, alpha) {
	return normalize_stops([
		{pos: 0, color: color_1, alpha: 255},
		{pos: 1, color: color_2, alpha},
	]);
}

/**
 * Stops of a gradient layer: the editor stops, otherwise the two colors of the older layers
 *
 * @param {object} params
 * @returns {Stop[]}
 */
export function layer_stops(params) {
	params = params || {};
	if (Array.isArray(params.stops) && params.stops.length >= 2) {
		return normalize_stops(params.stops);
	}
	return simple_stops(params.color_1 || '#008000', params.color_2 || '#ffffff', parseFloat(params.alpha ?? 0));
}

/**
 * @param {object} params gradient layer params (type, or the older radial flag)
 * @returns {string} one of GRADIENT_TYPES
 */
export function gradient_type(params) {
	params = params || {};
	const type = params.type && params.type.value !== undefined ? params.type.value : params.type;
	if (GRADIENT_TYPES.includes(type)) {
		return type;
	}
	return params.radial === true ? 'Radial' : 'Linear';
}

/**
 * @param {Stop[]} stops
 * @returns {Stop[]} the same gradient running the other way
 */
export function reverse_stops(stops) {
	return normalize_stops(stops).map((stop) => {
		return {pos: 1 - stop.pos, color: stop.color, alpha: stop.alpha};
	}).reverse();
}

/**
 * Stops for a gradient that is mirrored around the start point: the first stop is in the middle
 *
 * @param {Stop[]} stops
 */
export function reflect_stops(stops) {
	const list = normalize_stops(stops);
	const result = [];
	for (let i = list.length - 1; i >= 0; i--) {
		result.push({pos: (1 - list[i].pos) / 2, color: list[i].color, alpha: list[i].alpha});
	}
	for (let j = 0; j < list.length; j++) {
		result.push({pos: (1 + list[j].pos) / 2, color: list[j].color, alpha: list[j].alpha});
	}
	return result;
}

/**
 * @param {object} stop
 * @returns {string} CSS color for the canvas gradient
 */
export function stop_css(stop) {
	const rgb = parse_color(stop.color);
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.round(clamp(stop.alpha, 0, 255) / 255 * 1000) / 1000})`;
}

/**
 * Color of the gradient at the position t (0-1)
 *
 * @param {Stop[]} stops
 * @param {number} t
 * @returns {number[]} [r, g, b, a] with a 0-255
 */
export function color_at(stops, t) {
	let k, cb;
	const list = normalize_stops(stops);
	t = clamp(t, 0, 1);
	const first = list[0];
	const last = list[list.length - 1];
	const pick = function (stop) {
		return parse_color(stop.color).concat([stop.alpha]);
	};
	if (t <= first.pos) {
		return pick(first);
	}
	if (t >= last.pos) {
		return pick(last);
	}
	for (let i = 1; i < list.length; i++) {
		if (t <= list[i].pos) {
			const a = list[i - 1];
			const b = list[i];
			k = b.pos == a.pos ? 1 : (t - a.pos) / (b.pos - a.pos);
			const ca = pick(a);
			cb = pick(b);
			return ca.map((v, n) => { return Math.round(v + (cb[n] - v) * k); });
		}
	}
	return pick(last);
}

/**
 * Pixels of a diamond gradient (squares around the center, which the other types can not draw)
 *
 * @param {number} width
 * @param {number} height
 * @param {{x: number, y: number, rx: number, ry: number, inner?: number}} geometry center, the half-sizes of the dragged
 *   area (t = 1 at the end of the drag) and inner = 0-1 where the first color ends
 * @param {Stop[]} stops
 * @returns {Uint8ClampedArray} RGBA pixels
 */
export function diamond_pixels(width, height, geometry, stops) {
	const lookup = [];
	for (let i = 0; i < 256; i++) {
		lookup.push(color_at(stops, i / 255));
	}
	const rx = Math.max(Math.abs(geometry.rx), 0.0001);
	const ry = Math.max(Math.abs(geometry.ry), 0.0001);
	const reach = rx + ry;
	const inner = clamp(geometry.inner || 0, 0, 0.99);
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		const dy = Math.abs(y + 0.5 - geometry.y);
		for (let x = 0; x < width; x++) {
			let t = (Math.abs(x + 0.5 - geometry.x) + dy) / reach;
			t = clamp((t - inner) / (1 - inner), 0, 1);
			const c = lookup[Math.round(t * 255)];
			const p = (y * width + x) * 4;
			data[p] = c[0];
			data[p + 1] = c[1];
			data[p + 2] = c[2];
			data[p + 3] = c[3];
		}
	}
	return data;
}

/**
 * Ready made gradients of the editor. "Foreground" colors are filled in by the editor.
 */
export const GRADIENT_PRESETS = [
	{name: 'Foreground to Transparent', stops: [{pos: 0, color: '@fg', alpha: 255}, {pos: 1, color: '@fg', alpha: 0}]},
	{name: 'Foreground to Background', stops: [{pos: 0, color: '@fg', alpha: 255}, {pos: 1, color: '@bg', alpha: 255}]},
	{name: 'Black to White', stops: [{pos: 0, color: '#000000', alpha: 255}, {pos: 1, color: '#ffffff', alpha: 255}]},
	{name: 'Rainbow', stops: [
		{pos: 0, color: '#ff0000', alpha: 255}, {pos: 0.2, color: '#ffff00', alpha: 255}, {pos: 0.4, color: '#00ff00', alpha: 255},
		{pos: 0.6, color: '#00ffff', alpha: 255}, {pos: 0.8, color: '#0000ff', alpha: 255}, {pos: 1, color: '#ff00ff', alpha: 255}]},
	{name: 'Sunset', stops: [
		{pos: 0, color: '#2b1055', alpha: 255}, {pos: 0.5, color: '#d53369', alpha: 255}, {pos: 1, color: '#ffd452', alpha: 255}]},
	{name: 'Ocean', stops: [{pos: 0, color: '#021b79', alpha: 255}, {pos: 1, color: '#0575e6', alpha: 255}]},
	{name: 'Chrome', stops: [
		{pos: 0, color: '#4a4a4a', alpha: 255}, {pos: 0.25, color: '#f2f2f2', alpha: 255}, {pos: 0.5, color: '#7d7d7d', alpha: 255},
		{pos: 0.75, color: '#ffffff', alpha: 255}, {pos: 1, color: '#555555', alpha: 255}]},
	{name: 'Copper', stops: [
		{pos: 0, color: '#6b3e1f', alpha: 255}, {pos: 0.35, color: '#e8a76a', alpha: 255}, {pos: 0.65, color: '#b87333', alpha: 255},
		{pos: 1, color: '#f5cba7', alpha: 255}]},
];

/**
 * @param {object} preset one of GRADIENT_PRESETS
 * @param {string} foreground
 * @param {string} background
 * @returns {Stop[]} stops with the colors filled in
 */
export function preset_stops(preset, foreground, background) {
	return normalize_stops(preset.stops.map((stop) => {
		const color = stop.color == '@fg' ? foreground : (stop.color == '@bg' ? background : stop.color);
		return {pos: stop.pos, color, alpha: stop.alpha};
	}));
}
