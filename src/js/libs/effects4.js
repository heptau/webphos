/**
 * Skin softening, HDR look, white balance and palette reduction. Pure functions on {data, width, height}.
 */
import { blur_rgba } from './effects2.js';

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function parse_hex(hex) {
	var match = /^#?([0-9a-f]{6})$/i.exec(String(hex));
	if (!match) {
		return [128, 128, 128];
	}
	var n = parseInt(match[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Surface blur - smooths small differences (skin, noise) but keeps the edges, because strongly different
 * pixels are not mixed in.
 *
 * @param {number} radius 1 .. 40
 * @param {number} threshold 1 .. 100 differences above this stay sharp
 */
export function surface_blur(image, radius, threshold) {
	threshold = clamp(parseFloat(threshold == undefined ? 25 : threshold), 1, 100) * 2.55;
	var blurred = blur_rgba(image, radius == undefined ? 6 : radius);
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		var diff = (Math.abs(data[i] - blurred[i]) + Math.abs(data[i + 1] - blurred[i + 1]) + Math.abs(data[i + 2] - blurred[i + 2])) / 3;
		var weight = clamp(1 - diff / threshold, 0, 1);
		for (var c = 0; c < 3; c++) {
			data[i + c] = data[i + c] * (1 - weight) + blurred[i + c] * weight;
		}
	}
	return image;
}

/**
 * HDR toning - strong local contrast (the picture minus its big scale blur) and a little more color.
 *
 * @param {number} radius 5 .. 100 size of the details that get contrast
 * @param {number} strength 0 .. 100
 * @param {number} saturation -100 .. 100
 */
export function hdr_toning(image, radius, strength, saturation) {
	strength = clamp(parseFloat(strength == undefined ? 50 : strength), 0, 100) / 100 * 2.5;
	saturation = clamp(parseFloat(saturation) || 0, -100, 100) / 100;
	var blurred = blur_rgba(image, radius == undefined ? 30 : radius);
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		var luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
		for (var c = 0; c < 3; c++) {
			var value = data[i + c] + (data[i + c] - blurred[i + c]) * strength;
			value = luma + (value - luma) * (1 + saturation);
			data[i + c] = clamp(value, 0, 255);
		}
	}
	return image;
}

/**
 * White balance - the given color is the neutral gray of the scene (click a gray / white object);
 * all colors are corrected by the same factors.
 *
 * @param {string} neutral hex color that should become gray
 * @param {number} [strength] 0 .. 100, default 100
 */
export function white_balance(image, neutral, strength) {
	strength = clamp(parseFloat(strength == undefined ? 100 : strength), 0, 100) / 100;
	var color = parse_hex(neutral);
	var average = (color[0] + color[1] + color[2]) / 3;
	var factors = color.map(function (value) {
		var factor = value > 0 ? average / value : 1;
		return 1 + (clamp(factor, 0.3, 3) - 1) * strength;
	});
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		data[i] = clamp(data[i] * factors[0], 0, 255);
		data[i + 1] = clamp(data[i + 1] * factors[1], 0, 255);
		data[i + 2] = clamp(data[i + 2] * factors[2], 0, 255);
	}
	return image;
}

/**
 * Finds a palette of the most important colors (k-means on a sample of the pixels).
 *
 * @param {number} count number of colors 2 .. 64
 * @returns {number[][]} colors [r, g, b]
 */
export function find_palette(image, count) {
	count = Math.round(clamp(parseFloat(count) || 8, 2, 64));
	var data = image.data;
	var step = Math.max(1, Math.floor(image.width * image.height / 6000));
	var samples = [];
	for (var p = 0; p < image.width * image.height; p += step) {
		if (data[p * 4 + 3] > 0) {
			samples.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
		}
	}
	if (samples.length == 0) {
		return [[0, 0, 0]];
	}
	//start with colors spread over the brightness range
	samples.sort(function (a, b) {
		return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]);
	});
	var centers = [];
	for (var k = 0; k < count; k++) {
		centers.push(samples[Math.min(samples.length - 1, Math.floor((k + 0.5) / count * samples.length))].slice());
	}
	for (var iteration = 0; iteration < 8; iteration++) {
		var sums = centers.map(function () {
			return [0, 0, 0, 0];
		});
		samples.forEach(function (sample) {
			var best = 0, best_d = Infinity;
			for (var c = 0; c < centers.length; c++) {
				var d = Math.pow(sample[0] - centers[c][0], 2) + Math.pow(sample[1] - centers[c][1], 2) + Math.pow(sample[2] - centers[c][2], 2);
				if (d < best_d) {
					best_d = d;
					best = c;
				}
			}
			sums[best][0] += sample[0];
			sums[best][1] += sample[1];
			sums[best][2] += sample[2];
			sums[best][3]++;
		});
		centers = centers.map(function (center, c) {
			return sums[c][3] > 0 ? [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]] : center;
		});
	}
	return centers.map(function (center) {
		return center.map(Math.round);
	});
}

/**
 * Reduce to palette - every pixel gets the nearest color of the palette, optionally with Floyd-Steinberg dithering.
 *
 * @param {number} count number of colors
 * @param {boolean} [dither]
 * @returns {number[][]} the used palette
 */
export function reduce_to_palette(image, count, dither) {
	var palette = find_palette(image, count);
	var w = image.width;
	var h = image.height;
	var data = image.data;
	var work = new Float32Array(w * h * 3);
	for (var p = 0; p < w * h; p++) {
		work[p * 3] = data[p * 4];
		work[p * 3 + 1] = data[p * 4 + 1];
		work[p * 3 + 2] = data[p * 4 + 2];
	}
	var nearest = function (r, g, b) {
		var best = 0, best_d = Infinity;
		for (var c = 0; c < palette.length; c++) {
			var d = Math.pow(r - palette[c][0], 2) + Math.pow(g - palette[c][1], 2) + Math.pow(b - palette[c][2], 2);
			if (d < best_d) {
				best_d = d;
				best = c;
			}
		}
		return palette[best];
	};
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var i = y * w + x;
			if (data[i * 4 + 3] == 0) {
				continue;
			}
			var r = clamp(work[i * 3], 0, 255), g = clamp(work[i * 3 + 1], 0, 255), b = clamp(work[i * 3 + 2], 0, 255);
			var color = nearest(r, g, b);
			data[i * 4] = color[0];
			data[i * 4 + 1] = color[1];
			data[i * 4 + 2] = color[2];
			if (dither) {
				var err = [r - color[0], g - color[1], b - color[2]];
				var spread = function (dx, dy, f) {
					var xx = x + dx, yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
						return;
					}
					var j = yy * w + xx;
					for (var c = 0; c < 3; c++) {
						work[j * 3 + c] += err[c] * f;
					}
				};
				spread(1, 0, 7 / 16);
				spread(-1, 1, 3 / 16);
				spread(0, 1, 5 / 16);
				spread(1, 1, 1 / 16);
			}
		}
	}
	return palette;
}

/**
 * Builds a .cube file from a function that changes the colors of a picture (an adjustment).
 * The function receives an ImageData-like picture holding every color of the table once.
 *
 * @param {function} change function(image) that changes the picture in place and returns it
 * @param {number} [size] size of the table (17 .. 65), default 33
 * @param {string} [title]
 * @returns {string} content of a .cube file
 */
export function adjustment_to_cube(change, size, title) {
	size = Math.round(clamp(parseFloat(size) || 33, 2, 65));
	var width = size * size;
	var image = {width: width, height: size, data: new Uint8ClampedArray(width * size * 4)};
	for (var y = 0; y < size; y++) {
		for (var x = 0; x < width; x++) {
			var i = (y * width + x) * 4;
			image.data[i] = Math.round((x % size) / (size - 1) * 255);
			image.data[i + 1] = Math.round(y / (size - 1) * 255);
			image.data[i + 2] = Math.round(Math.floor(x / size) / (size - 1) * 255);
			image.data[i + 3] = 255;
		}
	}
	var result = change(image) || image;
	var lines = ['TITLE "' + String(title || 'WebPhos look').replace(/"/g, '') + '"', 'LUT_3D_SIZE ' + size];
	for (var b = 0; b < size; b++) {
		for (var g = 0; g < size; g++) {
			for (var r = 0; r < size; r++) {
				var j = (g * width + b * size + r) * 4;
				lines.push((result.data[j] / 255).toFixed(6) + ' ' + (result.data[j + 1] / 255).toFixed(6) + ' ' + (result.data[j + 2] / 255).toFixed(6));
			}
		}
	}
	return lines.join('\n') + '\n';
}
