/**
 * More photo effects working on ImageData-like objects {data, width, height} (RGBA, alpha is kept).
 * Pure functions, covered by tests.
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function hex_to_rgb(hex) {
	var match = /^#?([0-9a-f]{6})$/i.exec(String(hex));
	if (!match) {
		return [128, 128, 128];
	}
	var n = parseInt(match[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

//one pass of a box blur on a single float channel (edges are repeated)
function box_blur_channel(values, width, height, radius) {
	var temp = new Float32Array(values.length);
	var out = new Float32Array(values.length);
	var size = radius * 2 + 1;
	for (var y = 0; y < height; y++) {
		var sum = 0;
		for (var k = -radius; k <= radius; k++) {
			sum += values[y * width + clamp(k, 0, width - 1)];
		}
		for (var x = 0; x < width; x++) {
			temp[y * width + x] = sum / size;
			sum += values[y * width + clamp(x + radius + 1, 0, width - 1)] - values[y * width + clamp(x - radius, 0, width - 1)];
		}
	}
	for (var x2 = 0; x2 < width; x2++) {
		var sum2 = 0;
		for (var k2 = -radius; k2 <= radius; k2++) {
			sum2 += temp[clamp(k2, 0, height - 1) * width + x2];
		}
		for (var y2 = 0; y2 < height; y2++) {
			out[y2 * width + x2] = sum2 / size;
			sum2 += temp[clamp(y2 + radius + 1, 0, height - 1) * width + x2] - temp[clamp(y2 - radius, 0, height - 1) * width + x2];
		}
	}
	return out;
}

/**
 * Gaussian-like blur (three box blur passes), returns a new RGBA array.
 */
export function blur_rgba(image, radius) {
	radius = Math.round(clamp(radius, 0, 100));
	var w = image.width;
	var h = image.height;
	var result = new Uint8ClampedArray(image.data);
	if (radius < 1) {
		return result;
	}
	var channel = new Float32Array(w * h);
	for (var c = 0; c < 4; c++) {
		for (var p = 0; p < channel.length; p++) {
			channel[p] = image.data[p * 4 + c];
		}
		var blurred = channel;
		for (var pass = 0; pass < 3; pass++) {
			blurred = box_blur_channel(blurred, w, h, Math.max(1, Math.round(radius / 2)));
		}
		for (var q = 0; q < blurred.length; q++) {
			result[q * 4 + c] = blurred[q];
		}
	}
	return result;
}

/**
 * Vignette - darkens (negative amount lightens) the corners.
 *
 * @param {number} amount -100 .. 100
 * @param {number} size 10 .. 100 how much of the picture stays untouched (percent of the distance to the corner)
 * @param {number} softness 1 .. 100 how wide the transition is
 */
export function vignette(image, amount, size, softness) {
	amount = clamp(parseFloat(amount) || 0, -100, 100) / 100;
	size = clamp(parseFloat(size == undefined ? 50 : size), 5, 100) / 100;
	softness = clamp(parseFloat(softness == undefined ? 50 : softness), 1, 100) / 100;
	var w = image.width;
	var h = image.height;
	var cx = (w - 1) / 2;
	var cy = (h - 1) / 2;
	var max = Math.hypot(cx, cy) || 1;
	var data = image.data;
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var d = Math.hypot(x - cx, y - cy) / max;
			var t = clamp((d - size) / Math.max(0.01, softness * (1 - size + 0.3)), 0, 1);
			t = t * t * (3 - 2 * t);
			var i = (y * w + x) * 4;
			if (amount >= 0) {
				var factor = 1 - amount * t;
				data[i] *= factor;
				data[i + 1] *= factor;
				data[i + 2] *= factor;
			}
			else {
				var lift = -amount * t;
				data[i] += (255 - data[i]) * lift;
				data[i + 1] += (255 - data[i + 1]) * lift;
				data[i + 2] += (255 - data[i + 2]) * lift;
			}
		}
	}
	return image;
}

/**
 * Dehaze - removes the veil of fog: the haze is estimated from the darkest channel of the surroundings.
 *
 * @param {number} strength 0 .. 100
 */
export function dehaze(image, strength) {
	strength = clamp(parseFloat(strength) || 0, 0, 100) / 100;
	if (strength == 0) {
		return image;
	}
	var w = image.width;
	var h = image.height;
	var data = image.data;
	var dark = new Float32Array(w * h);
	for (var p = 0; p < dark.length; p++) {
		dark[p] = Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
	}
	var haze = box_blur_channel(dark, w, h, Math.max(2, Math.round(Math.min(w, h) / 40)));
	var light = 245;
	for (var q = 0; q < haze.length; q++) {
		var transmission = clamp(1 - strength * 0.9 * haze[q] / light, 0.25, 1);
		var i = q * 4;
		for (var c = 0; c < 3; c++) {
			data[i + c] = clamp((data[i + c] - light * (1 - transmission)) / transmission, 0, 255);
		}
	}
	return image;
}

/**
 * Tilt-shift - a sharp horizontal band, blurred above and below (the picture looks like a miniature).
 *
 * @param {number} focus_y 0 .. 100 position of the sharp band (percent of the height)
 * @param {number} band 0 .. 100 height of the sharp band (percent)
 * @param {number} blur radius of the blur in pixels
 */
export function tilt_shift(image, focus_y, band, blur) {
	var w = image.width;
	var h = image.height;
	var center = clamp(parseFloat(focus_y == undefined ? 50 : focus_y), 0, 100) / 100 * h;
	var half = clamp(parseFloat(band == undefined ? 20 : band), 0, 100) / 200 * h;
	var blurred = blur_rgba(image, blur == undefined ? 8 : blur);
	var data = image.data;
	for (var y = 0; y < h; y++) {
		var distance = Math.max(0, Math.abs(y - center) - half);
		var amount = clamp(distance / Math.max(1, h * 0.25), 0, 1);
		if (amount == 0) {
			continue;
		}
		for (var x = 0; x < w; x++) {
			var i = (y * w + x) * 4;
			for (var c = 0; c < 4; c++) {
				data[i + c] = data[i + c] * (1 - amount) + blurred[i + c] * amount;
			}
		}
	}
	return image;
}

/**
 * Split toning - tints the shadows and the highlights with different colors.
 *
 * @param {string} shadow_color
 * @param {string} highlight_color
 * @param {number} balance -100 .. 100 moves the border between shadows and highlights
 * @param {number} strength 0 .. 100
 */
export function split_toning(image, shadow_color, highlight_color, balance, strength) {
	var shadow = hex_to_rgb(shadow_color);
	var highlight = hex_to_rgb(highlight_color);
	var shift = clamp(parseFloat(balance) || 0, -100, 100) / 200;
	strength = clamp(parseFloat(strength == undefined ? 50 : strength), 0, 100) / 100;
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		var luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
		var t = clamp(luma + shift, 0, 1);
		for (var c = 0; c < 3; c++) {
			var tint = shadow[c] * (1 - t) + highlight[c] * t;
			//the tint is mixed in as a soft light so that the brightness stays
			var mixed = data[i + c] * (1 - strength * 0.5) + tint * strength * 0.5 + (data[i + c] - 128) * 0;
			data[i + c] = clamp(mixed, 0, 255);
		}
	}
	return image;
}

/**
 * Chromatic aberration - the red and blue channels are moved in opposite directions (lens fringing, glitch look).
 *
 * @param {number} amount -50 .. 50 shift in pixels
 */
export function chromatic_aberration(image, amount) {
	var shift = Math.round(clamp(parseFloat(amount) || 0, -50, 50));
	if (shift == 0) {
		return image;
	}
	var w = image.width;
	var h = image.height;
	var source = new Uint8ClampedArray(image.data);
	var data = image.data;
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var i = (y * w + x) * 4;
			data[i] = source[(y * w + clamp(x - shift, 0, w - 1)) * 4];
			data[i + 2] = source[(y * w + clamp(x + shift, 0, w - 1)) * 4 + 2];
		}
	}
	return image;
}

/**
 * Halftone - the brightness becomes a grid of dots (like in print).
 *
 * @param {number} cell size of the grid cell in pixels, 3 .. 40
 * @param {boolean} [color] keeps the color of the picture in the dots, otherwise black dots on white
 */
export function halftone(image, cell, color) {
	cell = Math.round(clamp(parseFloat(cell) || 8, 3, 40));
	var w = image.width;
	var h = image.height;
	var source = new Uint8ClampedArray(image.data);
	var data = image.data;
	for (var cy = 0; cy < h; cy += cell) {
		for (var cx = 0; cx < w; cx += cell) {
			var r = 0, g = 0, b = 0, a = 0, count = 0;
			for (var y = cy; y < Math.min(h, cy + cell); y++) {
				for (var x = cx; x < Math.min(w, cx + cell); x++) {
					var i = (y * w + x) * 4;
					r += source[i]; g += source[i + 1]; b += source[i + 2]; a += source[i + 3];
					count++;
				}
			}
			r /= count; g /= count; b /= count; a /= count;
			var dark = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			var radius = Math.sqrt(dark) * cell * 0.72;
			var mx = cx + cell / 2;
			var my = cy + cell / 2;
			for (var y2 = cy; y2 < Math.min(h, cy + cell); y2++) {
				for (var x2 = cx; x2 < Math.min(w, cx + cell); x2++) {
					var j = (y2 * w + x2) * 4;
					var inside = Math.hypot(x2 + 0.5 - mx, y2 + 0.5 - my) <= radius;
					if (color) {
						data[j] = inside ? r : 255;
						data[j + 1] = inside ? g : 255;
						data[j + 2] = inside ? b : 255;
					}
					else {
						data[j] = data[j + 1] = data[j + 2] = inside ? 0 : 255;
					}
					data[j + 3] = a;
				}
			}
		}
	}
	return image;
}

/**
 * Film grain - noise that is strongest in the midtones, optionally clumped to bigger grains.
 *
 * @param {number} amount 0 .. 100
 * @param {number} size 1 .. 6 grain size in pixels
 * @param {function} [random] returns 0 .. 1 (for tests)
 */
export function film_grain(image, amount, size, random) {
	amount = clamp(parseFloat(amount) || 0, 0, 100) / 100 * 60;
	size = Math.round(clamp(parseFloat(size) || 1, 1, 6));
	random = random || Math.random;
	var w = image.width;
	var h = image.height;
	var gw = Math.ceil(w / size);
	var gh = Math.ceil(h / size);
	var grain = new Float32Array(gw * gh);
	for (var g = 0; g < grain.length; g++) {
		grain[g] = (random() + random() + random()) / 3 - 0.5;
	}
	var data = image.data;
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var i = (y * w + x) * 4;
			var luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
			var weight = 1 - Math.abs(luma - 0.5) * 1.4;
			var delta = grain[Math.floor(y / size) * gw + Math.floor(x / size)] * amount * 2 * Math.max(0.2, weight);
			data[i] = clamp(data[i] + delta, 0, 255);
			data[i + 1] = clamp(data[i + 1] + delta, 0, 255);
			data[i + 2] = clamp(data[i + 2] + delta, 0, 255);
		}
	}
	return image;
}

/**
 * Dust & Scratches - pixels that differ strongly from the median of their surroundings are replaced by it.
 *
 * @param {number} radius 1 .. 4
 * @param {number} threshold 0 .. 255 smallest difference that is treated as dirt
 */
export function dust_scratches(image, radius, threshold) {
	radius = Math.round(clamp(parseFloat(radius) || 1, 1, 4));
	threshold = clamp(parseFloat(threshold) || 0, 0, 255);
	var w = image.width;
	var h = image.height;
	var source = new Uint8ClampedArray(image.data);
	var data = image.data;
	var values = [];
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			var i = (y * w + x) * 4;
			var medians = [0, 0, 0];
			var dirty = false;
			for (var c = 0; c < 3; c++) {
				values.length = 0;
				for (var dy = -radius; dy <= radius; dy++) {
					var yy = clamp(y + dy, 0, h - 1);
					for (var dx = -radius; dx <= radius; dx++) {
						values.push(source[(yy * w + clamp(x + dx, 0, w - 1)) * 4 + c]);
					}
				}
				values.sort(function (a, b) {
					return a - b;
				});
				medians[c] = values[values.length >> 1];
				if (Math.abs(source[i + c] - medians[c]) > threshold) {
					dirty = true;
				}
			}
			if (dirty) {
				data[i] = medians[0];
				data[i + 1] = medians[1];
				data[i + 2] = medians[2];
			}
		}
	}
	return image;
}
