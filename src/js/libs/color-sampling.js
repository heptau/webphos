/**
 * Average color of a square area of an image (for the color picker sample size).
 * Colors are averaged in premultiplied alpha, so transparent pixels do not darken the result.
 */

/**
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {number} x center
 * @param {number} y center
 * @param {number} radius 0 = the pixel itself, 1 = 3x3, 2 = 5x5...
 * @returns {number[]} [r, g, b, a] (0 for everything when the point is outside of the image)
 */
export function average_color(image, x, y, radius) {
	x = Math.floor(x);
	y = Math.floor(y);
	radius = Math.max(0, Math.floor(radius) || 0);
	let r = 0, g = 0, b = 0, a = 0, count = 0;
	for (let yy = y - radius; yy <= y + radius; yy++) {
		for (let xx = x - radius; xx <= x + radius; xx++) {
			if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) {
				continue;
			}
			const i = (yy * image.width + xx) * 4;
			const alpha = image.data[i + 3];
			r += image.data[i] * alpha;
			g += image.data[i + 1] * alpha;
			b += image.data[i + 2] * alpha;
			a += alpha;
			count++;
		}
	}
	if (count == 0 || a == 0) {
		return [0, 0, 0, 0];
	}
	return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / count)];
}

/**
 * Radius for a sample size option such as "Point", "3x3" or "11x11"
 *
 * @param {string} option
 * @returns {number}
 */
export function sample_radius(option) {
	const match = /^(\d+)\s*x\s*\1$/i.exec(String(option || ''));
	if (!match) {
		return 0;
	}
	return Math.min(50, Math.floor((parseInt(match[1]) - 1) / 2));
}
