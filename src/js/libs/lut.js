/**
 * Color lookup tables (.cube files) - the standard way to share a "look" between programs.
 * Only 3D tables are supported (LUT_3D_SIZE). Pure functions.
 */

/**
 * @param {string} text content of a .cube file
 * @returns {{size: number, data: Float32Array}|null} table of size^3 RGB triples (red changes fastest) or null when it is not valid
 */
export function parse_cube(text) {
	var size = 0;
	var values = [];
	var min = [0, 0, 0];
	var max = [1, 1, 1];
	var lines = String(text).split(/\r?\n/);
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		if (line == '' || line[0] == '#') {
			continue;
		}
		var parts = line.split(/\s+/);
		var key = parts[0].toUpperCase();
		if (key == 'LUT_3D_SIZE') {
			size = parseInt(parts[1], 10);
		}
		else if (key == 'LUT_1D_SIZE') {
			return null;
		}
		else if (key == 'DOMAIN_MIN' && parts.length >= 4) {
			min = parts.slice(1, 4).map(parseFloat);
		}
		else if (key == 'DOMAIN_MAX' && parts.length >= 4) {
			max = parts.slice(1, 4).map(parseFloat);
		}
		else if (/^[-+]?[0-9.]/.test(line) && parts.length >= 3) {
			values.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
		}
	}
	if (!(size >= 2 && size <= 128) || values.length != size * size * size * 3 || values.some(isNaN)) {
		return null;
	}
	var data = new Float32Array(values.length);
	for (var v = 0; v < values.length; v++) {
		var c = v % 3;
		data[v] = (values[v] - min[c]) / ((max[c] - min[c]) || 1);
	}
	return {size: size, data: data};
}

/**
 * @param {{size: number, data: Float32Array}} lut
 * @param {number} r 0 - 1
 * @param {number} g 0 - 1
 * @param {number} b 0 - 1
 * @returns {number[]} [r, g, b] 0 - 1 (trilinear interpolation)
 */
export function lookup(lut, r, g, b) {
	var n = lut.size - 1;
	var fr = Math.min(1, Math.max(0, r)) * n;
	var fg = Math.min(1, Math.max(0, g)) * n;
	var fb = Math.min(1, Math.max(0, b)) * n;
	var r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
	var r1 = Math.min(n, r0 + 1), g1 = Math.min(n, g0 + 1), b1 = Math.min(n, b0 + 1);
	var dr = fr - r0, dg = fg - g0, db = fb - b0;
	var size = lut.size;
	var out = [0, 0, 0];
	var at = function (ri, gi, bi, c) {
		return lut.data[((bi * size + gi) * size + ri) * 3 + c];
	};
	for (var c = 0; c < 3; c++) {
		var c00 = at(r0, g0, b0, c) * (1 - dr) + at(r1, g0, b0, c) * dr;
		var c10 = at(r0, g1, b0, c) * (1 - dr) + at(r1, g1, b0, c) * dr;
		var c01 = at(r0, g0, b1, c) * (1 - dr) + at(r1, g0, b1, c) * dr;
		var c11 = at(r0, g1, b1, c) * (1 - dr) + at(r1, g1, b1, c) * dr;
		var c0 = c00 * (1 - dg) + c10 * dg;
		var c1 = c01 * (1 - dg) + c11 * dg;
		out[c] = c0 * (1 - db) + c1 * db;
	}
	return out;
}

/**
 * @param {object} image ImageData-like, changed in place
 * @param {{size: number, data: Float32Array}} lut
 * @param {number} [strength] 0 - 100 mix of the look with the original, default 100
 * @returns {object} the image
 */
export function apply_lut(image, lut, strength) {
	strength = Math.min(100, Math.max(0, strength == undefined ? 100 : strength)) / 100;
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		var mapped = lookup(lut, data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
		for (var c = 0; c < 3; c++) {
			data[i + c] = Math.round(data[i + c] * (1 - strength) + mapped[c] * 255 * strength);
		}
	}
	return image;
}
