/**
 * Distort filters (twirl, wave) and the clouds render filter, working on ImageData-like objects
 * ({data, width, height}). Data is modified in place and the same object is returned.
 * Distort parameters are relative to the image size, so a small dialog preview looks like the real result.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

import { parseHex } from './adjustments.js';

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Bilinear sample; positions outside of the image use the nearest edge pixel.
 * Works in premultiplied alpha so transparent pixels do not bleed color into the edges.
 */
function sample(src, width, height, x, y, out) {
	x = clamp(x - 0.5, 0, width - 1);
	y = clamp(y - 0.5, 0, height - 1);
	var x0 = Math.floor(x), y0 = Math.floor(y);
	var x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
	var fx = x - x0, fy = y - y0;
	var i00 = (y0 * width + x0) * 4, i10 = (y0 * width + x1) * 4;
	var i01 = (y1 * width + x0) * 4, i11 = (y1 * width + x1) * 4;
	var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;

	var a = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
	if (a <= 0) {
		out[0] = out[1] = out[2] = out[3] = 0;
		return;
	}
	for (var c = 0; c < 3; c++) {
		out[c] = (src[i00 + c] * src[i00 + 3] * w00 + src[i10 + c] * src[i10 + 3] * w10
			+ src[i01 + c] * src[i01 + 3] * w01 + src[i11 + c] * src[i11 + 3] * w11) / a;
	}
	out[3] = a;
}

/**
 * Generic remap: every output pixel takes its color from the position returned by the mapper.
 *
 * @param {Image_data} image
 * @param {function(number, number, number[]): void} mapper writes the source position [x, y] for the output pixel (x, y)
 * @returns {Image_data}
 */
export function remap(image, mapper) {
	var w = image.width;
	var h = image.height;
	var src = new Uint8ClampedArray(image.data);
	var data = image.data;
	var position = [0, 0];
	var color = [0, 0, 0, 0];
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			position[0] = x + 0.5;
			position[1] = y + 0.5;
			mapper(position[0], position[1], position);
			sample(src, w, h, position[0], position[1], color);
			var i = (y * w + x) * 4;
			data[i] = color[0];
			data[i + 1] = color[1];
			data[i + 2] = color[2];
			data[i + 3] = color[3];
		}
	}
	return image;
}

/**
 * Twirl - rotates the image around its center, more in the middle than at the edge of the radius
 *
 * @param {Image_data} image
 * @param {object} params angle (-720..720 degrees), radius (1-100 % of the shorter side, default 50)
 * @returns {Image_data}
 */
export function twirl(image, params) {
	var angle = clamp(parseFloat(params.angle) || 0, -720, 720) * Math.PI / 180;
	var radius = clamp(parseFloat(params.radius ?? 50) || 50, 1, 100) / 100 * Math.min(image.width, image.height);
	if (angle == 0) {
		return image;
	}
	var cx = image.width / 2;
	var cy = image.height / 2;
	return remap(image, function (x, y, position) {
		var dx = x - cx;
		var dy = y - cy;
		var distance = Math.sqrt(dx * dx + dy * dy);
		if (distance >= radius) {
			return;
		}
		var factor = 1 - distance / radius;
		var theta = angle * factor * factor;
		var cos = Math.cos(theta);
		var sin = Math.sin(theta);
		position[0] = cx + dx * cos - dy * sin;
		position[1] = cy + dx * sin + dy * cos;
	});
}

/**
 * Wave - sine shaped displacement
 *
 * @param {Image_data} image
 * @param {object} params amplitude (0-30 % of the image size), wavelength (1-100 % of the image size),
 *   direction ('horizontal' moves rows sideways, 'vertical' moves columns up and down)
 * @returns {Image_data}
 */
export function wave(image, params) {
	var vertical = params.direction === 'vertical';
	var size = vertical ? image.width : image.height; //length along the wave
	var across = vertical ? image.height : image.width;
	var amplitude = clamp(parseFloat(params.amplitude) || 0, 0, 30) / 100 * across;
	var wavelength = Math.max(2, clamp(parseFloat(params.wavelength ?? 20) || 20, 1, 100) / 100 * size);
	if (amplitude == 0) {
		return image;
	}
	return remap(image, function (x, y, position) {
		if (vertical) {
			position[1] = y + amplitude * Math.sin(2 * Math.PI * x / wavelength);
		}
		else {
			position[0] = x + amplitude * Math.sin(2 * Math.PI * y / wavelength);
		}
	});
}

/**
 * Small seeded random generator (mulberry32), so the same seed always gives the same clouds
 */
function seeded_random(seed) {
	var state = (parseInt(seed) || 0) >>> 0;
	return function () {
		state = (state + 0x6D2B79F5) >>> 0;
		var t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Fractal noise in the range 0..1 for every pixel (value noise, 6 octaves, smooth interpolation)
 *
 * @param {number} width
 * @param {number} height
 * @param {number} scale size of the largest clouds in pixels
 * @param {number} seed
 * @returns {Float32Array} width * height values
 */
export function cloud_noise(width, height, scale, seed) {
	var OCTAVES = 6;
	var random = seeded_random(seed);
	var result = new Float32Array(width * height);
	var total = 0;
	var amplitude = 1;
	for (var o = 0; o < OCTAVES; o++) {
		var cell = Math.max(1, scale / Math.pow(2, o));
		var cols = Math.ceil(width / cell) + 2;
		var rows = Math.ceil(height / cell) + 2;
		var lattice = new Float32Array(cols * rows);
		for (var i = 0; i < lattice.length; i++) {
			lattice[i] = random();
		}
		for (var y = 0; y < height; y++) {
			var gy = y / cell;
			var y0 = Math.floor(gy);
			var ty = gy - y0;
			ty = ty * ty * (3 - 2 * ty);
			for (var x = 0; x < width; x++) {
				var gx = x / cell;
				var x0 = Math.floor(gx);
				var tx = gx - x0;
				tx = tx * tx * (3 - 2 * tx);
				var a = lattice[y0 * cols + x0] * (1 - tx) + lattice[y0 * cols + x0 + 1] * tx;
				var b = lattice[(y0 + 1) * cols + x0] * (1 - tx) + lattice[(y0 + 1) * cols + x0 + 1] * tx;
				result[y * width + x] += (a * (1 - ty) + b * ty) * amplitude;
			}
		}
		total += amplitude;
		amplitude /= 2;
	}
	for (var k = 0; k < result.length; k++) {
		result[k] /= total;
	}
	return result;
}

/**
 * Clouds - fills the image with clouds between two colors and blends it with the original by opacity
 *
 * @param {Image_data} image
 * @param {object} params scale (2-100 % of the longer side), seed, color1, color2 (hex), opacity (0-100),
 *   contrast (0-100, stretches the noise)
 * @returns {Image_data}
 */
export function clouds(image, params) {
	var scale = clamp(parseFloat(params.scale ?? 30) || 30, 2, 100) / 100 * Math.max(image.width, image.height);
	var opacity = clamp(parseFloat(params.opacity ?? 100), 0, 100) / 100;
	var contrast = clamp(parseFloat(params.contrast) || 0, 0, 100) / 100;
	var c1 = parseHex(params.color1 || '#000000');
	var c2 = parseHex(params.color2 || '#ffffff');
	if (opacity == 0 || isNaN(opacity)) {
		return image;
	}
	var noise = cloud_noise(image.width, image.height, scale, params.seed);

	//stretch the noise around its mean so contrast actually changes something
	var min = Infinity, max = -Infinity;
	for (var n = 0; n < noise.length; n++) {
		if (noise[n] < min) min = noise[n];
		if (noise[n] > max) max = noise[n];
	}
	var range = max - min || 1;

	var data = image.data;
	for (var p = 0, i = 0; p < noise.length; p++, i += 4) {
		var t = (noise[p] - min) / range;
		t = clamp((t - 0.5) * (1 + contrast * 3) + 0.5, 0, 1);
		var a0 = data[i + 3] / 255;
		var a = a0 + (1 - a0) * opacity; //result alpha
		for (var c = 0; c < 3; c++) {
			var cloud = c1[c] + (c2[c] - c1[c]) * t;
			//premultiplied mix of the original (weight a0 * (1 - opacity)) and the cloud (weight opacity)
			data[i + c] = (data[i + c] * a0 * (1 - opacity) + cloud * opacity) / a;
		}
		data[i + 3] = a * 255;
	}
	return image;
}

/**
 * Lens Flare - adds a bright glow and a few soft rings ("ghosts") along the line through the image center,
 * like light reflected in camera lenses. The effect is added to the image (additive blending).
 *
 * @param {Image_data} image
 * @param {object} params x, y (0-100 % position of the light), brightness (0-300 %, default 100)
 * @returns {Image_data}
 */
export function lensFlare(image, params) {
	var w = image.width;
	var h = image.height;
	var brightness = clamp(parseFloat(params.brightness ?? 100), 0, 300) / 100;
	if (brightness == 0 || isNaN(brightness) || w == 0 || h == 0) {
		return image;
	}
	var size = Math.min(w, h);
	var lx = clamp(parseFloat(params.x ?? 30), 0, 100) / 100 * w;
	var ly = clamp(parseFloat(params.y ?? 30), 0, 100) / 100 * h;
	var cx = w / 2;
	var cy = h / 2;

	//light sources: [x, y, radius, intensity, color, ring] - ring sources are thin circles, others are glows
	var sources = [
		{x: lx, y: ly, radius: size * 0.35, intensity: 0.9, color: [255, 245, 220], ring: false},
		{x: lx, y: ly, radius: size * 0.06, intensity: 1.0, color: [255, 255, 255], ring: false},
	];
	[[-0.35, 0.10, 0.5, [255, 160, 90]], [0.45, 0.07, 0.45, [140, 200, 255]], [0.8, 0.14, 0.4, [150, 255, 160]], [1.25, 0.20, 0.35, [255, 120, 200]]]
		.forEach(function (ghost) {
			sources.push({
				x: lx + (cx - lx) * (1 + ghost[0]),
				y: ly + (cy - ly) * (1 + ghost[0]),
				radius: size * ghost[1],
				intensity: ghost[2],
				color: ghost[3],
				ring: true,
			});
		});

	var data = image.data;
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var r = 0, g = 0, b = 0;
			for (var s = 0; s < sources.length; s++) {
				var source = sources[s];
				var d = Math.sqrt((x - source.x) * (x - source.x) + (y - source.y) * (y - source.y)) / source.radius;
				var value;
				if (source.ring) {
					//soft ring at the edge of the circle with a faint fill
					var edge = d - 1;
					value = Math.exp(-edge * edge * 18) * 0.8 + (d < 1 ? 0.12 * (1 - d) : 0);
				}
				else {
					value = Math.exp(-d * d * 3);
				}
				value *= source.intensity * brightness;
				r += source.color[0] * value;
				g += source.color[1] * value;
				b += source.color[2] * value;
			}
			var i = (y * w + x) * 4;
			data[i] = Math.min(255, data[i] + r);
			data[i + 1] = Math.min(255, data[i + 1] + g);
			data[i + 2] = Math.min(255, data[i + 2] + b);
		}
	}
	return image;
}
