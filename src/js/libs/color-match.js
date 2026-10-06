/**
 * Match Color - moves the colors of an image towards the colors of a reference image
 * (mean and spread of every channel in a luma / chroma space are matched). Pure functions.
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

//ITU-R BT.601 YCbCr
function to_ycc(r, g, b) {
	return [
		0.299 * r + 0.587 * g + 0.114 * b,
		128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
		128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
	];
}

function from_ycc(y, cb, cr) {
	return [
		y + 1.402 * (cr - 128),
		y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128),
		y + 1.772 * (cb - 128),
	];
}

/**
 * @param {{data: ArrayLike<number>}} image
 * @returns {{mean: number[], deviation: number[], count: number}} statistics of the opaque pixels in Y, Cb, Cr
 */
export function color_statistics(image) {
	var sum = [0, 0, 0];
	var square = [0, 0, 0];
	var count = 0;
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		var ycc = to_ycc(data[i], data[i + 1], data[i + 2]);
		for (var c = 0; c < 3; c++) {
			sum[c] += ycc[c];
			square[c] += ycc[c] * ycc[c];
		}
		count++;
	}
	if (count == 0) {
		return {mean: [0, 128, 128], deviation: [1, 1, 1], count: 0};
	}
	var mean = sum.map((value) => value / count);
	var deviation = square.map((value, c) => Math.sqrt(Math.max(0, value / count - mean[c] * mean[c])));
	return {mean: mean, deviation: deviation, count: count};
}

/**
 * @param {object} image ImageData-like, changed in place
 * @param {object} reference ImageData-like image whose colors are copied
 * @param {number} [strength] 0 - 100 % of the change, default 100
 * @returns {object} the image
 */
export function match_color(image, reference, strength) {
	strength = clamp(strength == undefined ? 100 : strength, 0, 100) / 100;
	var from = color_statistics(image);
	var to = color_statistics(reference);
	if (from.count == 0 || to.count == 0 || strength == 0) {
		return image;
	}
	var data = image.data;
	for (var i = 0; i < data.length; i += 4) {
		if (data[i + 3] == 0) {
			continue;
		}
		var ycc = to_ycc(data[i], data[i + 1], data[i + 2]);
		for (var c = 0; c < 3; c++) {
			//the spread is matched only partly, so flat images do not explode
			var ratio = clamp(to.deviation[c] / Math.max(from.deviation[c], 1), 0.4, 2.5);
			var matched = (ycc[c] - from.mean[c]) * ratio + to.mean[c];
			ycc[c] = ycc[c] * (1 - strength) + matched * strength;
		}
		var rgb = from_ycc(ycc[0], ycc[1], ycc[2]);
		data[i] = clamp(Math.round(rgb[0]), 0, 255);
		data[i + 1] = clamp(Math.round(rgb[1]), 0, 255);
		data[i + 2] = clamp(Math.round(rgb[2]), 0, 255);
	}
	return image;
}
