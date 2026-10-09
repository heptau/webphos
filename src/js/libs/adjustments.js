/**
 * Photoshop-like image adjustments working directly on ImageData-like objects ({data, width, height}).
 * Alpha channel is always preserved. Data is modified in place and the same object is returned.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

function luminance(r, g, b) {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Invert colors (Ctrl+I)
 *
 * @param {Image_data} image
 * @returns {Image_data}
 */
export function invert(image) {
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = 255 - data[i];
		data[i + 1] = 255 - data[i + 1];
		data[i + 2] = 255 - data[i + 2];
	}
	return image;
}

/**
 * Desaturate (Shift+Ctrl+U)
 *
 * @param {Image_data} image
 * @returns {Image_data}
 */
export function desaturate(image) {
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const gray = Math.round(luminance(data[i], data[i + 1], data[i + 2]));
		data[i] = gray;
		data[i + 1] = gray;
		data[i + 2] = gray;
	}
	return image;
}

/**
 * Threshold - pixels with luminance >= level become white, others black
 *
 * @param {Image_data} image
 * @param {number|string} level 1-255
 * @returns {Image_data}
 */
export function threshold(image, level) {
	level = clamp(parseInt(level) || 128, 1, 255);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const value = luminance(data[i], data[i + 1], data[i + 2]) >= level ? 255 : 0;
		data[i] = value;
		data[i + 1] = value;
		data[i + 2] = value;
	}
	return image;
}

/**
 * Posterize - limit number of tonal levels per channel
 *
 * @param {Image_data} image
 * @param {number|string} levels 2-255
 * @returns {Image_data}
 */
export function posterize(image, levels) {
	levels = clamp(parseInt(levels) || 4, 2, 255);
	const lookup = new Uint8ClampedArray(256);
	const step = 255 / (levels - 1);
	for (let v = 0; v < 256; v++) {
		const band = Math.min(levels - 1, Math.floor(v * levels / 256));
		lookup[v] = Math.round(band * step);
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = lookup[data[i]];
		data[i + 1] = lookup[data[i + 1]];
		data[i + 2] = lookup[data[i + 2]];
	}
	return image;
}

/**
 * Levels - input black/white points, gamma and output range (Ctrl+L)
 *
 * @param {Image_data} image
 * @param {object} params keys: in_black, in_white (0-255), gamma (0.1-9.99), out_black, out_white (0-255),
 *   channel ('rgb' (default), 'red', 'green' or 'blue') - which channels are changed
 * @returns {Image_data}
 */
export function levels(image, params) {
	const in_black = clamp(parseInt(params.in_black) || 0, 0, 254);
	const in_white = clamp(parseInt(params.in_white ?? 255), in_black + 1, 255);
	const gamma = clamp(parseFloat(params.gamma) || 1, 0.1, 9.99);
	const out_black = clamp(parseInt(params.out_black) || 0, 0, 255);
	const out_white = clamp(parseInt(params.out_white ?? 255), 0, 255);

	const lookup = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		let normalized = clamp((v - in_black) / (in_white - in_black), 0, 1);
		normalized = Math.pow(normalized, 1 / gamma);
		lookup[v] = Math.round(out_black + normalized * (out_white - out_black));
	}
	const channels = params.channel === 'red' ? [0] : params.channel === 'green' ? [1] : params.channel === 'blue' ? [2] : [0, 1, 2];
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < channels.length; c++) {
			data[i + channels[c]] = lookup[data[i + channels[c]]];
		}
	}
	return image;
}

/**
 * Brightness/Contrast (Photoshop style) - both -100..100
 *
 * @param {Image_data} image
 * @param {number|string} brightness -100..100
 * @param {number|string} contrast -100..100
 * @returns {Image_data}
 */
export function brightnessContrast(image, brightness, contrast) {
	brightness = clamp(parseFloat(brightness) || 0, -100, 100);
	contrast = clamp(parseFloat(contrast) || 0, -100, 100);

	const shift = brightness * 2.55;
	const factor = contrast >= 0 ? 255 / (255 - contrast * 2.54) : (100 + contrast) / 100;
	const lookup = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		lookup[v] = Math.round((v + shift - 128) * factor + 128);
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = lookup[data[i]];
		data[i + 1] = lookup[data[i + 1]];
		data[i + 2] = lookup[data[i + 2]];
	}
	return image;
}

function rgb_to_hsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max != min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max == r) {
			h = (g - b) / d + (g < b ? 6 : 0);
		} else if (max == g) {
			h = (b - r) / d + 2;
		} else {
			h = (r - g) / d + 4;
		}
		h /= 6;
	}
	return [h, s, l];
}

function hue_to_rgb(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

function hsl_to_rgb(h, s, l) {
	if (s == 0) {
		return [l * 255, l * 255, l * 255];
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return [
		hue_to_rgb(p, q, h + 1 / 3) * 255,
		hue_to_rgb(p, q, h) * 255,
		hue_to_rgb(p, q, h - 1 / 3) * 255,
	];
}

/**
 * Hue/Saturation/Lightness (Ctrl+U)
 *
 * @param {Image_data} image
 * @param {object} params keys: hue (-180..180), saturation (-100..100), lightness (-100..100),
 *   colorize (bool) - makes the image one color: hue is the color (-180..180 maps to 0-360 degrees),
 *   saturation 0..100 its strength, the brightness of the image stays
 * @returns {Image_data}
 */
export function hueSaturation(image, params) {
	if (params.colorize === true || params.colorize === 'true') {
		return colorize(image, params);
	}
	const hue = clamp(parseFloat(params.hue) || 0, -180, 180) / 360;
	const saturation = clamp(parseFloat(params.saturation) || 0, -100, 100) / 100;
	const lightness = clamp(parseFloat(params.lightness) || 0, -100, 100) / 100;

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const hsl = rgb_to_hsl(data[i], data[i + 1], data[i + 2]);
		const h = (hsl[0] + hue + 1) % 1;
		const s = saturation >= 0 ? hsl[1] + (1 - hsl[1]) * saturation : hsl[1] * (1 + saturation);
		const l = lightness >= 0 ? hsl[2] + (1 - hsl[2]) * lightness : hsl[2] * (1 + lightness);
		const rgb = hsl_to_rgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
		data[i] = Math.round(rgb[0]);
		data[i + 1] = Math.round(rgb[1]);
		data[i + 2] = Math.round(rgb[2]);
	}
	return image;
}

/**
 * Exposure - exposure in stops (EV), offset and gamma correction
 *
 * @param {Image_data} image
 * @param {object} params keys: exposure (-5..5), offset (-0.5..0.5), gamma (0.1..9.99)
 * @returns {Image_data}
 */
export function exposure(image, params) {
	const exposure_value = clamp(parseFloat(params.exposure) || 0, -5, 5);
	const offset = clamp(parseFloat(params.offset) || 0, -0.5, 0.5);
	const gamma = clamp(parseFloat(params.gamma) || 1, 0.1, 9.99);

	const multiplier = Math.pow(2, exposure_value);
	const lookup = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		const value = clamp((v / 255) * multiplier + offset, 0, 1);
		lookup[v] = Math.round(Math.pow(value, 1 / gamma) * 255);
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = lookup[data[i]];
		data[i + 1] = lookup[data[i + 1]];
		data[i + 2] = lookup[data[i + 2]];
	}
	return image;
}

/**
 * Auto Contrast (Shift+Ctrl+L) - stretch the tonal range of all channels together,
 * optionally clipping a percentage of the darkest/lightest pixels.
 *
 * @param {Image_data} image
 * @param {number} [clip_percent] percentage of pixels clipped on each side (default 0.5)
 * @returns {Image_data}
 */
export function autoContrast(image, clip_percent) {
	clip_percent = clamp(parseFloat(clip_percent ?? 0.5), 0, 10);
	const data = image.data;
	const histogram = new Uint32Array(256);
	let total = 0;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		histogram[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
		total++;
	}
	if (total == 0) {
		return image;
	}

	const clip = Math.floor(total * clip_percent / 100);
	let low = 0;
	let sum = 0;
	while (low < 255 && sum + histogram[low] <= clip) {
		sum += histogram[low++];
	}
	let high = 255;
	sum = 0;
	while (high > low && sum + histogram[high] <= clip) {
		sum += histogram[high--];
	}
	if (high <= low) {
		return image;
	}
	return levels(image, {in_black: low, in_white: high, gamma: 1, out_black: 0, out_white: 255});
}

/**
 * Add Noise - uniform or gaussian noise, optionally monochromatic
 *
 * @param {Image_data} image
 * @param {object} params keys: amount (0-100 %), gaussian (bool), monochrome (bool)
 * @param {function} [random] random number generator returning [0, 1), injectable for tests
 * @returns {Image_data}
 */
export function addNoise(image, params, random) {
	random = random || Math.random;
	const amount = clamp(parseFloat(params.amount) || 0, 0, 100) * 2.55;
	const gaussian = params.gaussian === true || params.gaussian === 'true' || params.gaussian === 'Yes';
	const monochrome = params.monochrome === true || params.monochrome === 'true' || params.monochrome === 'Yes';

	function sample() {
		if (gaussian) {
			//Box-Muller, std ~ amount / 2
			const u = 1 - random();
			const v = random();
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * amount / 2;
		}
		return (random() * 2 - 1) * amount;
	}

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		if (monochrome) {
			const n = sample();
			data[i] += n;
			data[i + 1] += n;
			data[i + 2] += n;
		} else {
			data[i] += sample();
			data[i + 1] += sample();
			data[i + 2] += sample();
		}
	}
	return image;
}

/**
 * Parse "#rgb" / "#rrggbb" to [r, g, b]. Invalid input returns black.
 *
 * @param {string} hex
 * @returns {number[]}
 */
export function parseHex(hex) {
	const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
	if (!match) {
		return [0, 0, 0];
	}
	let value = match[1];
	if (value.length == 3) {
		value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
	}
	return [parseInt(value.substr(0, 2), 16), parseInt(value.substr(2, 2), 16), parseInt(value.substr(4, 2), 16)];
}

/**
 * Color Balance - shifts colors in shadows, midtones or highlights
 *
 * @param {Image_data} image
 * @param {object} params keys: range ('shadows'|'midtones'|'highlights'), cyan_red, magenta_green, yellow_blue (-100..100),
 *   preserve_luminosity (bool, default true)
 * @returns {Image_data}
 */
export function colorBalance(image, params) {
	let weight;
	const shift = [
		clamp(parseFloat(params.cyan_red) || 0, -100, 100) * 2.55,
		clamp(parseFloat(params.magenta_green) || 0, -100, 100) * 2.55,
		clamp(parseFloat(params.yellow_blue) || 0, -100, 100) * 2.55,
	];
	const range = params.range || 'midtones';
	const preserve = params.preserve_luminosity !== false && params.preserve_luminosity !== 'false';

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const lum = luminance(data[i], data[i + 1], data[i + 2]) / 255;
		if (range == 'shadows') {
			weight = Math.pow(1 - lum, 2);
		} else if (range == 'highlights') {
			weight = Math.pow(lum, 2);
		} else {
			weight = 1 - Math.pow(2 * lum - 1, 2);
		}
		const old_lum = luminance(data[i], data[i + 1], data[i + 2]);
		let r = data[i] + shift[0] * weight;
		let g = data[i + 1] + shift[1] * weight;
		let b = data[i + 2] + shift[2] * weight;
		if (preserve) {
			const diff = old_lum - luminance(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
			r += diff;
			g += diff;
			b += diff;
		}
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
	}
	return image;
}

/**
 * Photo Filter - tints the image with a color, like a colored lens filter
 *
 * @param {Image_data} image
 * @param {object} params keys: color (hex), density (0-100), preserve_luminosity (bool, default true)
 * @returns {Image_data}
 */
export function photoFilter(image, params) {
	const color = parseHex(params.color || '#ec8a00');
	const density = clamp(parseFloat(params.density ?? 25) || 0, 0, 100) / 100;
	const preserve = params.preserve_luminosity !== false && params.preserve_luminosity !== 'false';

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const old_lum = luminance(data[i], data[i + 1], data[i + 2]);
		let r = data[i] * (1 - density) + (data[i] * color[0] / 255) * density;
		let g = data[i + 1] * (1 - density) + (data[i + 1] * color[1] / 255) * density;
		let b = data[i + 2] * (1 - density) + (data[i + 2] * color[2] / 255) * density;
		if (preserve) {
			const new_lum = luminance(r, g, b);
			if (new_lum > 0) {
				const k = old_lum / new_lum;
				r *= k;
				g *= k;
				b *= k;
			}
		}
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
	}
	return image;
}

/**
 * Gradient Map - maps luminance to a gradient: shadows color -> (optional midtones color) -> highlights color
 *
 * @param {Image_data} image
 * @param {object} params keys: shadows (hex), highlights (hex), midtones (hex, optional), reverse (bool)
 * @returns {Image_data}
 */
export function gradientMap(image, params) {
	const stops = [parseHex(params.shadows || '#000000')];
	if (params.midtones) {
		stops.push(parseHex(params.midtones));
	}
	stops.push(parseHex(params.highlights || '#ffffff'));
	const reverse = params.reverse === true || params.reverse === 'true';

	const lookup = new Uint8ClampedArray(256 * 3);
	for (let v = 0; v < 256; v++) {
		const pos = (reverse ? 255 - v : v) / 255 * (stops.length - 1);
		const idx = Math.min(Math.floor(pos), stops.length - 2);
		const t = pos - idx;
		for (let c = 0; c < 3; c++) {
			lookup[v * 3 + c] = Math.round(stops[idx][c] * (1 - t) + stops[idx + 1][c] * t);
		}
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const l = Math.round(luminance(data[i], data[i + 1], data[i + 2]));
		data[i] = lookup[l * 3];
		data[i + 1] = lookup[l * 3 + 1];
		data[i + 2] = lookup[l * 3 + 2];
	}
	return image;
}

/**
 * Channel Mixer - each output channel is a weighted mix of input channels (percent)
 *
 * @param {Image_data} image
 * @param {object} params keys: r_r, r_g, r_b, g_r, g_g, g_b, b_r, b_g, b_b (-200..200, identity by default),
 *   monochrome (bool) - gray output made from the red row
 * @returns {Image_data}
 */
export function channelMixer(image, params) {
	function weight(name, fallback) {
		const value = parseFloat(params[name]);
		return (isNaN(value) ? fallback : clamp(value, -200, 200)) / 100;
	}
	const m = [
		[weight('r_r', 100), weight('r_g', 0), weight('r_b', 0)],
		[weight('g_r', 0), weight('g_g', 100), weight('g_b', 0)],
		[weight('b_r', 0), weight('b_g', 0), weight('b_b', 100)],
	];
	const monochrome = params.monochrome === true || params.monochrome === 'true';

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i], g = data[i + 1], b = data[i + 2];
		const out_r = r * m[0][0] + g * m[0][1] + b * m[0][2];
		if (monochrome) {
			data[i] = data[i + 1] = data[i + 2] = out_r;
			continue;
		}
		data[i] = out_r;
		data[i + 1] = r * m[1][0] + g * m[1][1] + b * m[1][2];
		data[i + 2] = r * m[2][0] + g * m[2][1] + b * m[2][2];
	}
	return image;
}

/**
 * Shadows/Highlights - brightens dark areas and darkens bright areas
 *
 * @param {Image_data} image
 * @param {object} params keys: shadows (0-100), highlights (0-100)
 * @returns {Image_data}
 */
export function shadowsHighlights(image, params) {
	const shadows = clamp(parseFloat(params.shadows ?? 35) || 0, 0, 100) / 100;
	const highlights = clamp(parseFloat(params.highlights) || 0, 0, 100) / 100;

	const lookup = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		const x = v / 255;
		//bell-shaped weights keep pure black and pure white unchanged
		const lift = shadows * 2.5 * x * Math.pow(1 - x, 2);
		const drop = highlights * 2.5 * x * x * (1 - x);
		lookup[v] = Math.round(clamp(x + lift - drop, 0, 1) * 255);
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = lookup[data[i]];
		data[i + 1] = lookup[data[i + 1]];
		data[i + 2] = lookup[data[i + 2]];
	}
	return image;
}

/**
 * Equalize - redistributes luminance so that the histogram is as flat as possible; colors keep their ratios
 *
 * @param {Image_data} image
 * @returns {Image_data}
 */
export function equalize(image) {
	const data = image.data;
	const histogram = new Uint32Array(256);
	let total = 0;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		histogram[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
		total++;
	}
	if (total == 0) {
		return image;
	}
	const cdf = new Float64Array(256);
	let sum = 0;
	let cdf_min = null;
	for (let v = 0; v < 256; v++) {
		sum += histogram[v];
		cdf[v] = sum;
		if (cdf_min === null && histogram[v] > 0) {
			cdf_min = sum;
		}
	}
	const denominator = total - cdf_min;
	if (denominator <= 0) {
		return image;
	}
	const map = new Float64Array(256);
	for (let l = 0; l < 256; l++) {
		map[l] = Math.max(0, (cdf[l] - cdf_min) / denominator * 255);
	}
	for (let j = 0; j < data.length; j += 4) {
		const old_l = Math.round(luminance(data[j], data[j + 1], data[j + 2]));
		const factor = old_l > 0 ? map[old_l] / old_l : 0;
		if (old_l == 0) {
			data[j] = data[j + 1] = data[j + 2] = map[0];
			continue;
		}
		data[j] *= factor;
		data[j + 1] *= factor;
		data[j + 2] *= factor;
	}
	return image;
}

/**
 * Auto Color - stretches each channel separately to the full range (removes color casts)
 *
 * @param {Image_data} image
 * @returns {Image_data}
 */
export function autoColor(image) {
	const data = image.data;
	const min = [255, 255, 255];
	const max = [0, 0, 0];
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		for (let c = 0; c < 3; c++) {
			if (data[i + c] < min[c]) min[c] = data[i + c];
			if (data[i + c] > max[c]) max[c] = data[i + c];
		}
	}
	for (let j = 0; j < data.length; j += 4) {
		for (let k = 0; k < 3; k++) {
			if (max[k] > min[k]) {
				data[j + k] = (data[j + k] - min[k]) / (max[k] - min[k]) * 255;
			}
		}
	}
	return image;
}

/**
 * Temperature/Tint - warms (positive) or cools (negative) the image; tint moves between green (negative) and magenta (positive)
 *
 * @param {Image_data} image
 * @param {object} params keys: temperature (-100..100), tint (-100..100)
 * @returns {Image_data}
 */
export function temperatureTint(image, params) {
	const temperature = clamp(parseFloat(params.temperature) || 0, -100, 100) / 100;
	const tint = clamp(parseFloat(params.tint) || 0, -100, 100) / 100;

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] *= 1 + temperature * 0.3;
		data[i + 1] *= 1 - tint * 0.3;
		data[i + 2] *= 1 - temperature * 0.3;
	}
	return image;
}

/**
 * Sepia Tone with adjustable strength
 *
 * @param {Image_data} image
 * @param {number|string} amount 0-100 %
 * @returns {Image_data}
 */
export function sepia(image, amount) {
	amount = clamp(parseFloat(amount ?? 100) || 0, 0, 100) / 100;
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i], g = data[i + 1], b = data[i + 2];
		const sr = 0.393 * r + 0.769 * g + 0.189 * b;
		const sg = 0.349 * r + 0.686 * g + 0.168 * b;
		const sb = 0.272 * r + 0.534 * g + 0.131 * b;
		data[i] = r + (sr - r) * amount;
		data[i + 1] = g + (sg - g) * amount;
		data[i + 2] = b + (sb - b) * amount;
	}
	return image;
}

/**
 * Swap Channels - new channel order as a string of 3 letters from "rgb", e.g. "bgr"
 *
 * @param {Image_data} image
 * @param {string} order
 * @returns {Image_data}
 */
export function swapChannels(image, order) {
	const index = {r: 0, g: 1, b: 2};
	order = String(order || 'rgb').toLowerCase();
	if (!/^[rgb]{3}$/.test(order)) {
		return image;
	}
	const map = [index[order[0]], index[order[1]], index[order[2]]];
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i], g = data[i + 1], b = data[i + 2];
		const values = [r, g, b];
		data[i] = values[map[0]];
		data[i + 1] = values[map[1]];
		data[i + 2] = values[map[2]];
	}
	return image;
}

/**
 * Extract Channel - shows one channel as a grayscale image
 *
 * @param {Image_data} image
 * @param {'red'|'green'|'blue'} channel
 * @returns {Image_data}
 */
export function extractChannel(image, channel) {
	const offset = {red: 0, green: 1, blue: 2}[channel];
	if (offset === undefined) {
		return image;
	}
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const value = data[i + offset];
		data[i] = data[i + 1] = data[i + 2] = value;
	}
	return image;
}

function hue_of(r, g, b) {
	return rgb_to_hsl(r, g, b)[0] * 360;
}

const SELECTIVE_HUES = {reds: 0, yellows: 60, greens: 120, cyans: 180, blues: 240, magentas: 300};

/**
 * Selective Color - changes CMYK components (relative, like Photoshop's "Relative" method) only in the chosen color range
 *
 * @param {Image_data} image
 * @param {object} params keys: range (reds|yellows|greens|cyans|blues|magentas|whites|neutrals|blacks),
 *   cyan, magenta, yellow, black (-100..100)
 * @returns {Image_data}
 */
export function selectiveColor(image, params) {
	let weight;
	const range = params.range || 'reds';
	const adjust = [
		clamp(parseFloat(params.cyan) || 0, -100, 100) / 100,
		clamp(parseFloat(params.magenta) || 0, -100, 100) / 100,
		clamp(parseFloat(params.yellow) || 0, -100, 100) / 100,
		clamp(parseFloat(params.black) || 0, -100, 100) / 100,
	];
	if (!adjust.some(Boolean)) {
		return image;
	}
	const is_hue = SELECTIVE_HUES[range] !== undefined;
	if (!is_hue && ['whites', 'neutrals', 'blacks'].indexOf(range) < 0) {
		return image;
	}

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		if (is_hue) {
			let distance = Math.abs(hue_of(data[i], data[i + 1], data[i + 2]) - SELECTIVE_HUES[range]);
			distance = Math.min(distance, 360 - distance);
			weight = Math.max(0, 1 - distance / 60) * (max - min); //ignore grays
		} else {
			const l = (max + min) / 2;
			if (range == 'whites') {
				weight = clamp((l - 0.5) * 2, 0, 1);
			} else if (range == 'blacks') {
				weight = clamp((0.5 - l) * 2, 0, 1);
			} else {
				weight = 1 - Math.abs(l - 0.5) * 2;
			}
		}
		if (weight <= 0) {
			continue;
		}
		let k = 1 - max;
		let c = 0, m = 0, y = 0;
		if (k < 1) {
			c = (1 - r - k) / (1 - k);
			m = (1 - g - k) / (1 - k);
			y = (1 - b - k) / (1 - k);
		}
		c = clamp(c + c * adjust[0] * weight, 0, 1);
		m = clamp(m + m * adjust[1] * weight, 0, 1);
		y = clamp(y + y * adjust[2] * weight, 0, 1);
		k = clamp(k + k * adjust[3] * weight, 0, 1);
		data[i] = 255 * (1 - c) * (1 - k);
		data[i + 1] = 255 * (1 - m) * (1 - k);
		data[i + 2] = 255 * (1 - y) * (1 - k);
	}
	return image;
}

/**
 * Monotone cubic interpolation (Fritsch-Carlson) lookup table of 256 values through given points.
 *
 * @param {number[][]} points [[x, y], ...] sorted by x, x and y in 0-255
 * @returns {Uint8ClampedArray}
 */
export function curveLookup(points) {
	const n = points.length;
	const xs = points.map((p) => { return p[0]; });
	const ys = points.map((p) => { return p[1]; });
	const d = [];
	const m = [];
	for (let i = 0; i < n - 1; i++) {
		d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
	}
	m[0] = d[0];
	m[n - 1] = d[n - 2];
	for (let j = 1; j < n - 1; j++) {
		m[j] = d[j - 1] * d[j] <= 0 ? 0 : (d[j - 1] + d[j]) / 2;
	}
	for (let k = 0; k < n - 1; k++) {
		if (d[k] == 0) {
			m[k] = m[k + 1] = 0;
			continue;
		}
		const a = m[k] / d[k];
		const b = m[k + 1] / d[k];
		const s = a * a + b * b;
		if (s > 9) {
			const t = 3 / Math.sqrt(s);
			m[k] = t * a * d[k];
			m[k + 1] = t * b * d[k];
		}
	}
	const lookup = new Uint8ClampedArray(256);
	let seg = 0;
	for (let v = 0; v < 256; v++) {
		while (seg < n - 2 && v > xs[seg + 1]) {
			seg++;
		}
		const h = xs[seg + 1] - xs[seg];
		const u = (v - xs[seg]) / h;
		const u2 = u * u, u3 = u2 * u;
		lookup[v] = Math.round(
			(2 * u3 - 3 * u2 + 1) * ys[seg] + (u3 - 2 * u2 + u) * h * m[seg] +
			(-2 * u3 + 3 * u2) * ys[seg + 1] + (u3 - u2) * h * m[seg + 1]
		);
	}
	return lookup;
}

/**
 * Curves - tone curve defined by output values at inputs 0, 64, 128, 192 and 255
 *
 * @param {Image_data} image
 * @param {object} params keys: channel ('rgb'|'red'|'green'|'blue'), p0, p64, p128, p192, p255 (0-255, identity by default)
 * @returns {Image_data}
 */
export function curves(image, params) {
	const inputs = [0, 64, 128, 192, 255];
	const points = inputs.map((x) => {
		const value = parseFloat(params[`p${  x}`]);
		return [x, clamp(isNaN(value) ? x : value, 0, 255)];
	});
	const lookup = curveLookup(points);
	const channel = params.channel || 'rgb';
	const channels = channel == 'red' ? [0] : channel == 'green' ? [1] : channel == 'blue' ? [2] : [0, 1, 2];

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < channels.length; c++) {
			data[i + channels[c]] = lookup[data[i + channels[c]]];
		}
	}
	return image;
}

/**
 * Dodge / Burn - lightens (dodge) or darkens (burn) the pixels, like holding back or adding exposure in a darkroom.
 * Used by the Dodge/Burn tool for every brush dab, so a small exposure builds up while painting.
 *
 * @param {Image_data} image
 * @param {object} params mode ('dodge'|'burn'), exposure (1-100 %), range ('all'|'shadows'|'midtones'|'highlights')
 * @returns {Image_data}
 */
export function dodgeBurn(image, params) {
	const burn = params.mode === 'burn';
	const strength = clamp(parseFloat(params.exposure ?? 10) || 0, 0, 100) / 100 * 0.3;
	const range = params.range || 'all';
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const lum = luminance(data[i], data[i + 1], data[i + 2]) / 255;
		let weight = 1;
		if (range === 'shadows') {
			weight = 1 - lum;
		} else if (range === 'highlights') {
			weight = lum;
		} else if (range === 'midtones') {
			weight = 1 - Math.abs(2 * lum - 1);
		}
		const amount = strength * weight;
		for (let c = 0; c < 3; c++) {
			const value = data[i + c];
			data[i + c] = burn ? value * (1 - amount) : value + (255 - value) * amount;
		}
	}
	return image;
}

/**
 * Smudge - mixes the pixels of `source` (the area where the finger was) into `target` (where it is now).
 * Colors are mixed in premultiplied alpha. Modifies target in place.
 *
 * @param {Image_data} target
 * @param {Image_data} source same size as target
 * @param {number|string} strength 0-100 (%) how much of the source is carried over
 * @returns {Image_data} target
 */
export function smudgeBlend(target, source, strength) {
	const k = clamp(parseFloat(strength ?? 50) || 0, 0, 100) / 100;
	const t = target.data;
	const s = source.data;
	const length = Math.min(t.length, s.length);
	for (let i = 0; i < length; i += 4) {
		const ta = t[i + 3] / 255;
		const sa = s[i + 3] / 255;
		const a = ta + (sa - ta) * k;
		if (a <= 0) {
			t[i] = t[i + 1] = t[i + 2] = t[i + 3] = 0;
			continue;
		}
		for (let c = 0; c < 3; c++) {
			const premultiplied = t[i + c] * ta + (s[i + c] * sa - t[i + c] * ta) * k;
			t[i + c] = premultiplied / a;
		}
		t[i + 3] = a * 255;
	}
	return target;
}

function colorize(image, params) {
	const hue = (((parseFloat(params.hue) || 0) + 360) % 360) / 360;
	const saturation = clamp(parseFloat(params.saturation) || 0, 0, 100) / 100;
	const lightness = clamp(parseFloat(params.lightness) || 0, -100, 100) / 100;
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		let l = luminance(data[i], data[i + 1], data[i + 2]) / 255;
		l = lightness >= 0 ? l + (1 - l) * lightness : l * (1 + lightness);
		const rgb = hsl_to_rgb(hue, saturation, clamp(l, 0, 1));
		data[i] = Math.round(rgb[0]);
		data[i + 1] = Math.round(rgb[1]);
		data[i + 2] = Math.round(rgb[2]);
	}
	return image;
}

/**
 * Cleans curve points: clamps to 0-255, sorts by input value, keeps one point per input value (the last one),
 * and makes sure the curve starts at input 0 and ends at input 255.
 * Anything that is not a list of points gives the identity curve.
 *
 * @param {number[][]} points [[input, output], ...]
 * @returns {number[][]}
 */
export function normalizeCurvePoints(points) {
	const by_input = {};
	if (Array.isArray(points)) {
		points.forEach((point) => {
			if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
				by_input[clamp(Math.round(point[0]), 0, 255)] = clamp(Math.round(point[1]), 0, 255);
			}
		});
	}
	const inputs = Object.keys(by_input).map(Number).sort((a, b) => { return a - b; });
	if (inputs.length == 0) {
		return [[0, 0], [255, 255]];
	}
	const result = inputs.map((x) => { return [x, by_input[x]]; });
	if (result[0][0] > 0) {
		result.unshift([0, result[0][1]]);
	}
	if (result[result.length - 1][0] < 255) {
		result.push([255, result[result.length - 1][1]]);
	}
	return result;
}

/**
 * Curves with any number of points, for the master (rgb) curve and for each channel separately,
 * like the Curves dialog of Photoshop: the master curve is applied first, then the channel curve.
 *
 * @param {Image_data} image
 * @param {object} curves keys rgb, red, green, blue - each a list of [input, output] points (missing = no change)
 * @returns {Image_data}
 */
export function curvesFromPoints(image, curves) {
	const master = curveLookup(normalizeCurvePoints(curves.rgb));
	const luts = ['red', 'green', 'blue'].map((name) => {
		const channel = curveLookup(normalizeCurvePoints(curves[name]));
		const lut = new Uint8ClampedArray(256);
		for (let v = 0; v < 256; v++) {
			lut[v] = channel[master[v]];
		}
		return lut;
	});
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i] = luts[0][data[i]];
		data[i + 1] = luts[1][data[i + 1]];
		data[i + 2] = luts[2][data[i + 2]];
	}
	return image;
}

/**
 * Histograms of an image for the Curves graph: counts of every value 0-255 for luminance and each channel.
 * Fully transparent pixels are ignored.
 *
 * @param {Image_data} image
 * @returns {{rgb: Uint32Array, red: Uint32Array, green: Uint32Array, blue: Uint32Array}}
 */
export function histograms(image) {
	const result = {rgb: new Uint32Array(256), red: new Uint32Array(256), green: new Uint32Array(256), blue: new Uint32Array(256)};
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		result.red[data[i]]++;
		result.green[data[i + 1]]++;
		result.blue[data[i + 2]]++;
		result.rgb[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
	}
	return result;
}

/**
 * Vibrance - raises the saturation of dull colors more than that of already vivid ones, so it does not
 * burn out the colors that are strong. Negative values calm the most vivid colors first.
 *
 * @param {Image_data} image
 * @param {object} params keys: vibrance (-100..100), saturation (-100..100) plain saturation on top of it
 * @returns {Image_data}
 */
export function vibrance(image, params) {
	const amount = clamp(parseFloat(params.vibrance) || 0, -100, 100) / 100;
	const saturation = clamp(parseFloat(params.saturation) || 0, -100, 100) / 100;
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		const current = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; //0 = gray, 1 = fully saturated
		let factor = 1 + (amount >= 0 ? amount * (1 - current) : amount * current);
		factor *= 1 + saturation;
		const gray = luminance(r, g, b);
		data[i] = clamp(Math.round(gray + (r - gray) * factor), 0, 255);
		data[i + 1] = clamp(Math.round(gray + (g - gray) * factor), 0, 255);
		data[i + 2] = clamp(Math.round(gray + (b - gray) * factor), 0, 255);
	}
	return image;
}

/**
 * Replace Color - colors close to the chosen one are shifted in hue, saturation and lightness.
 * The effect fades out smoothly with the distance, so the edges do not look cut.
 *
 * @param {Image_data} image
 * @param {object} params keys: color (hex), fuzziness (0-200), hue (-180..180), saturation (-100..100),
 *   lightness (-100..100)
 * @returns {Image_data}
 */
export function replaceColor(image, params) {
	const target = parseHex(params.color || '#000000');
	const fuzziness = clamp(parseFloat(params.fuzziness ?? 40) || 0, 0, 200);
	const hue = clamp(parseFloat(params.hue) || 0, -180, 180) / 360;
	const saturation = clamp(parseFloat(params.saturation) || 0, -100, 100) / 100;
	const lightness = clamp(parseFloat(params.lightness) || 0, -100, 100) / 100;
	const reach = fuzziness / 200 * 441.67; //distance in RGB space (the longest one is about 441.67)

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const distance = Math.hypot(data[i] - target[0], data[i + 1] - target[1], data[i + 2] - target[2]);
		const weight = reach > 0 ? clamp(1 - distance / reach, 0, 1) : (distance == 0 ? 1 : 0);
		if (weight == 0) {
			continue;
		}
		const hsl = rgb_to_hsl(data[i], data[i + 1], data[i + 2]);
		const s = saturation >= 0 ? hsl[1] + (1 - hsl[1]) * saturation : hsl[1] * (1 + saturation);
		const l = lightness >= 0 ? hsl[2] + (1 - hsl[2]) * lightness : hsl[2] * (1 + lightness);
		const rgb = hsl_to_rgb((hsl[0] + hue + 1) % 1, clamp(s, 0, 1), clamp(l, 0, 1));
		for (let c = 0; c < 3; c++) {
			data[i + c] = Math.round(data[i + c] + (rgb[c] - data[i + c]) * weight);
		}
	}
	return image;
}

/**
 * Sponge - adds (saturate) or removes (desaturate) color. Used by the Sponge tool for every brush dab,
 * so a small flow builds up while painting.
 *
 * @param {Image_data} image
 * @param {object} params mode ('saturate'|'desaturate'), flow (1-100 %)
 * @returns {Image_data}
 */
export function sponge(image, params) {
	const flow = clamp(parseFloat(params.flow ?? 15) || 0, 0, 100) / 100 * 0.4;
	const factor = params.mode === 'saturate' ? 1 + flow : 1 - flow;
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const gray = luminance(data[i], data[i + 1], data[i + 2]);
		for (let c = 0; c < 3; c++) {
			data[i + c] = clamp(Math.round(gray + (data[i + c] - gray) * factor), 0, 255);
		}
	}
	return image;
}

/**
 * Color to Alpha (GIMP) - makes the chosen color transparent. Pixels that are a mix of the color and something
 * else keep only the "something else" with the right amount of transparency, so a white background can be removed
 * without a light halo around the object.
 *
 * @param {Image_data} image
 * @param {object} params keys: color (hex, default white), threshold (0-100 %) - mixes with less than this
 *   share of other colors become fully transparent
 * @returns {Image_data}
 */
export function colorToAlpha(image, params) {
	const key = parseHex(params.color || '#ffffff');
	const threshold = clamp(parseFloat(params.threshold) || 0, 0, 99) / 100;
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		//how far the pixel is from the color, relative to the room there is in that direction
		let alpha = 0;
		for (let c = 0; c < 3; c++) {
			const d = data[i + c] - key[c];
			const room = d > 0 ? 255 - key[c] : key[c];
			if (d != 0 && room > 0) {
				alpha = Math.max(alpha, Math.abs(d) / room);
			}
		}
		alpha = clamp((alpha - threshold) / (1 - threshold), 0, 1);
		if (alpha == 0) {
			data[i + 3] = 0;
			continue;
		}
		for (let k = 0; k < 3; k++) {
			data[i + k] = clamp(Math.round(key[k] + (data[i + k] - key[k]) / alpha), 0, 255);
		}
		data[i + 3] = Math.round(data[i + 3] * alpha);
	}
	return image;
}

//hue (in degrees) of the six colors of the Black & White sliders
const BW_COLORS = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'];

/**
 * Black & White - gray picture where every color gets its own brightness (like a color filter on a black and white
 * film). The sliders say how light each color becomes: 0 = black, 100 = as light as the brightest channel.
 *
 * @param {Image_data} image
 * @param {object} params keys: reds, yellows, greens, cyans, blues, magentas (-200..300 %, defaults 40, 60, 40, 60, 20, 80),
 *   tint (bool) with tint_color (hex) colors the result
 * @returns {Image_data}
 */
export function blackWhite(image, params) {
	let h;
	const defaults = {reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80};
	const weights = BW_COLORS.map((name) => {
		const value = parseFloat(params[name]);
		return clamp(isNaN(value) ? defaults[name] : value, -200, 300) / 100;
	});
	const tint = params.tint === true || params.tint === 'true';
	const tint_rgb = tint ? parseHex(params.tint_color || '#e1c08c') : null;
	const tint_luminance = tint ? Math.max(1, luminance(tint_rgb[0], tint_rgb[1], tint_rgb[2])) : 1;

	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let gray = min;
		if (max > min) {
			//the hue as a position between the six colors: 0 red, 1 yellow, 2 green, 3 cyan, 4 blue, 5 magenta
			if (max == r) {
				h = ((g - b) / (max - min) + 6) % 6;
			} else if (max == g) {
				h = (b - r) / (max - min) + 2;
			} else {
				h = (r - g) / (max - min) + 4;
			}
			const lower = Math.floor(h) % 6;
			const share = h - Math.floor(h);
			const weight = weights[lower] + (weights[(lower + 1) % 6] - weights[lower]) * share;
			gray = min + (max - min) * weight;
		}
		gray = clamp(Math.round(gray), 0, 255);
		if (tint) {
			const k = gray / tint_luminance;
			data[i] = clamp(Math.round(tint_rgb[0] * k), 0, 255);
			data[i + 1] = clamp(Math.round(tint_rgb[1] * k), 0, 255);
			data[i + 2] = clamp(Math.round(tint_rgb[2] * k), 0, 255);
		} else {
			data[i] = data[i + 1] = data[i + 2] = gray;
		}
	}
	return image;
}

/**
 * Solarize - the channels brighter than the threshold are inverted, like a photo exposed to light during developing
 *
 * @param {Image_data} image
 * @param {number|string} threshold 0-255, default 128
 * @returns {Image_data}
 */
export function solarize(image, threshold) {
	const limit = clamp(parseFloat(threshold ?? 128), 0, 255);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		for (let c = 0; c < 3; c++) {
			if (data[i + c] >= limit) {
				data[i + c] = 255 - data[i + c];
			}
		}
	}
	return image;
}
