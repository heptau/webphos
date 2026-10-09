/**
 * Adjustment layers (Photoshop): a layer that changes the colors of everything below it and keeps the settings,
 * so the change can be edited, hidden or removed at any time. This is the list of the adjustments it can hold.
 * Pure functions, no DOM.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 * @typedef {{name?: string, title?: string, value?: any, values?: string[], range?: number[], step?: number, type?: string, heading?: string}} Param
 */
import * as Adjustments from './adjustments.js';

const TONES = ['midtones', 'shadows', 'highlights'];
const CURVE_CHANNELS = ['rgb', 'red', 'green', 'blue'];

/**
 * Curves of a new curves adjustment: the master and the three channels, all straight
 *
 * @returns {Object<string, number[][]>}
 */
export function default_curves() {
	/** @type {Object<string, number[][]>} */
	const curves = {};
	CURVE_CHANNELS.forEach((name) => {
		curves[name] = [[0, 0], [255, 255]];
	});
	return curves;
}

/**
 * Curves from a saved project can be anything: every channel gets valid, sorted points
 *
 * @param {any} stored
 * @returns {Object<string, number[][]>}
 */
export function clean_curves(stored) {
	/** @type {Object<string, number[][]>} */
	const curves = {};
	CURVE_CHANNELS.forEach((name) => {
		curves[name] = Adjustments.normalizeCurvePoints(stored && typeof stored == 'object' ? stored[name] : null);
	});
	return curves;
}

/**
 * Key -> {title (name in the menu and in the dialog), params (as the dialogs of Image > Adjustments), apply}
 *
 * @type {Object<string, {title: string, params: Param[], apply: function(Image_data, any): Image_data, state?: {name: string, create: function(): any, clean: function(any): any}}>}
 */
export const ADJUSTMENTS = {
	brightness_contrast: {
		title: 'Brightness/Contrast',
		params: [
			{name: 'brightness', title: 'Brightness:', value: 0, range: [-100, 100]},
			{name: 'contrast', title: 'Contrast:', value: 0, range: [-100, 100]},
		],
		apply: (img, s) => Adjustments.brightnessContrast(img, s.brightness, s.contrast),
	},
	levels: {
		title: 'Levels',
		params: [
			{name: 'channel', title: 'Channel:', values: ['rgb', 'red', 'green', 'blue'], value: 'rgb'},
			{name: 'in_black', title: 'Input black:', value: 0, range: [0, 254]},
			{name: 'gamma', title: 'Gamma:', value: 1, range: [0.1, 5], step: 0.01},
			{name: 'in_white', title: 'Input white:', value: 255, range: [1, 255]},
			{name: 'out_black', title: 'Output black:', value: 0, range: [0, 255]},
			{name: 'out_white', title: 'Output white:', value: 255, range: [0, 255]},
		],
		apply: (img, s) => Adjustments.levels(img, s),
	},
	hue_saturation: {
		title: 'Hue/Saturation',
		params: [
			{name: 'hue', title: 'Hue:', value: 0, range: [-180, 180]},
			{name: 'saturation', title: 'Saturation:', value: 0, range: [-100, 100]},
			{name: 'lightness', title: 'Lightness:', value: 0, range: [-100, 100]},
			{name: 'colorize', title: 'Colorize:', value: false},
		],
		apply: (img, s) => Adjustments.hueSaturation(img, s),
	},
	vibrance: {
		title: 'Vibrance',
		params: [
			{name: 'vibrance', title: 'Vibrance:', value: 0, range: [-100, 100]},
			{name: 'saturation', title: 'Saturation:', value: 0, range: [-100, 100]},
		],
		apply: (img, s) => Adjustments.vibrance(img, s),
	},
	exposure: {
		title: 'Exposure',
		params: [
			{name: 'exposure', title: 'Exposure:', value: 0, range: [-5, 5], step: 0.05},
			{name: 'offset', title: 'Offset:', value: 0, range: [-0.5, 0.5], step: 0.01},
			{name: 'gamma', title: 'Gamma:', value: 1, range: [0.1, 5], step: 0.01},
		],
		apply: (img, s) => Adjustments.exposure(img, s),
	},
	color_balance: {
		title: 'Color Balance',
		params: [
			{name: 'range', title: 'Tones:', values: TONES, value: 'midtones'},
			{name: 'cyan_red', title: 'Cyan - Red:', value: 0, range: [-100, 100]},
			{name: 'magenta_green', title: 'Magenta - Green:', value: 0, range: [-100, 100]},
			{name: 'yellow_blue', title: 'Yellow - Blue:', value: 0, range: [-100, 100]},
			{name: 'preserve_luminosity', title: 'Preserve luminosity:', value: true},
		],
		apply: (img, s) => Adjustments.colorBalance(img, s),
	},
	photo_filter: {
		title: 'Photo Filter',
		params: [
			{name: 'color', title: 'Color:', value: '#ec8a00', type: 'color'},
			{name: 'density', title: 'Density:', value: 25, range: [0, 100]},
			{name: 'preserve_luminosity', title: 'Preserve luminosity:', value: true},
		],
		apply: (img, s) => Adjustments.photoFilter(img, s),
	},
	temperature_tint: {
		title: 'Temperature/Tint',
		params: [
			{name: 'temperature', title: 'Temperature:', value: 0, range: [-100, 100]},
			{name: 'tint', title: 'Tint:', value: 0, range: [-100, 100]},
		],
		apply: (img, s) => Adjustments.temperatureTint(img, s),
	},
	black_white: {
		title: 'Black and White',
		params: [
			{name: 'reds', title: 'Reds:', value: 40, range: [-200, 300]},
			{name: 'yellows', title: 'Yellows:', value: 60, range: [-200, 300]},
			{name: 'greens', title: 'Greens:', value: 40, range: [-200, 300]},
			{name: 'cyans', title: 'Cyans:', value: 60, range: [-200, 300]},
			{name: 'blues', title: 'Blues:', value: 20, range: [-200, 300]},
			{name: 'magentas', title: 'Magentas:', value: 80, range: [-200, 300]},
			{name: 'tint', title: 'Tint:', value: false},
			{name: 'tint_color', title: 'Tint color:', value: '#e1c08c', type: 'color'},
		],
		apply: (img, s) => Adjustments.blackWhite(img, s),
	},
	gradient_map: {
		title: 'Gradient Map',
		params: [
			{name: 'shadows', title: 'Shadows:', value: '#000000', type: 'color'},
			{name: 'highlights', title: 'Highlights:', value: '#ffffff', type: 'color'},
			{name: 'reverse', title: 'Reverse:', value: false},
		],
		apply: (img, s) => Adjustments.gradientMap(img, s),
	},
	selective_color: {
		title: 'Selective Color',
		params: [
			{name: 'range', title: 'Colors:', values: ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks'], value: 'reds'},
			{name: 'cyan', title: 'Cyan:', value: 0, range: [-100, 100]},
			{name: 'magenta', title: 'Magenta:', value: 0, range: [-100, 100]},
			{name: 'yellow', title: 'Yellow:', value: 0, range: [-100, 100]},
			{name: 'black', title: 'Black:', value: 0, range: [-100, 100]},
		],
		apply: (img, s) => Adjustments.selectiveColor(img, s),
	},
	threshold: {
		title: 'Threshold',
		params: [{name: 'level', title: 'Level:', value: 128, range: [1, 255]}],
		apply: (img, s) => Adjustments.threshold(img, s.level),
	},
	posterize: {
		title: 'Posterize',
		params: [{name: 'levels', title: 'Levels:', value: 4, range: [2, 32]}],
		apply: (img, s) => Adjustments.posterize(img, s.levels),
	},
	curves: {
		title: 'Curves',
		//the graph is edited by its own editor in the dialog; the channel list only switches what the graph shows
		params: [{name: 'channel', title: 'Channel:', values: CURVE_CHANNELS, value: 'rgb'}],
		state: {name: 'curves', create: default_curves, clean: clean_curves},
		apply: (img, s) => Adjustments.curvesFromPoints(img, s.curves),
	},
	invert: {
		title: 'Invert',
		params: [],
		apply: (img) => Adjustments.invert(img),
	},
};

/**
 * @param {string} key
 * @returns {boolean}
 */
export function is_adjustment(key) {
	return Object.prototype.hasOwnProperty.call(ADJUSTMENTS, key);
}

/**
 * Settings of a new adjustment layer: the values that change nothing (or the usual starting values)
 *
 * @param {string} key
 * @returns {Object<string, any>}
 */
export function default_settings(key) {
	/** @type {Object<string, any>} */
	const settings = {};
	if (!is_adjustment(key)) {
		return settings;
	}
	ADJUSTMENTS[key].params.forEach((param) => {
		if (param.name) {
			settings[param.name] = param.value !== undefined ? param.value : (param.values ? param.values[0] : null);
		}
	});
	const state = ADJUSTMENTS[key].state;
	if (state) {
		settings[state.name] = state.create();
	}
	return settings;
}

/**
 * Settings from a saved project can be anything, so the ones that do not belong to the adjustment are dropped and
 * missing ones get the default.
 *
 * @param {string} key
 * @param {object|null} [stored]
 * @returns {Object<string, any>}
 */
export function clean_settings(key, stored) {
	const defaults = default_settings(key);
	/** @type {Object<string, any>} */
	const result = {};
	Object.keys(defaults).forEach((name) => {
		const value = stored && stored[name] !== undefined ? stored[name] : defaults[name];
		result[name] = typeof defaults[name] == 'boolean' ? value === true : value;
	});
	const state = is_adjustment(key) ? ADJUSTMENTS[key].state : undefined;
	if (state) {
		result[state.name] = state.clean(stored ? stored[state.name] : null);
	}
	return result;
}

/**
 * The picture after the adjustment (a new one, the original stays as it was)
 *
 * @param {Image_data} image
 * @param {string} key
 * @param {object} stored settings of the layer
 * @returns {Image_data}
 */
export function adjust_image(image, key, stored) {
	const copy = {width: image.width, height: image.height, data: new Uint8ClampedArray(image.data)};
	if (!is_adjustment(key)) {
		return copy;
	}
	return ADJUSTMENTS[key].apply(copy, clean_settings(key, stored));
}

/**
 * Takes the adjusted colors only partly: by the opacity of the layer and by the layer mask.
 * The alpha of the picture does not change.
 *
 * @param {Image_data} original
 * @param {Image_data} adjusted same size, changed in place
 * @param {number} amount 0-1 (opacity of the layer)
 * @param {Uint8ClampedArray|null} [weights] one value 0-255 for every pixel (the layer mask), null = everywhere
 * @returns {Image_data} adjusted
 */
export function mix_adjusted(original, adjusted, amount, weights) {
	const k = Math.min(1, Math.max(0, amount));
	const o = original.data;
	const a = adjusted.data;
	for (let i = 0, p = 0; i < a.length; i += 4, p++) {
		const share = weights ? k * weights[p] / 255 : k;
		if (share >= 1) {
			a[i + 3] = o[i + 3];
			continue;
		}
		for (let c = 0; c < 3; c++) {
			a[i + c] = Math.round(o[i + c] + (a[i + c] - o[i + c]) * share);
		}
		a[i + 3] = o[i + 3];
	}
	return adjusted;
}
