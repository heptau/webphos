/**
 * Brush stabilizer: the brush follows the mouse with a lag, so a shaky hand draws a smooth line.
 */

/**
 * @param {{x: number, y: number}} previous where the brush was
 * @param {{x: number, y: number}} target where the mouse is
 * @param {number|string} amount 0-100 %, 0 = no smoothing
 * @returns {{x: number, y: number}} the new position of the brush, between the two
 */
export function stabilize(previous, target, amount) {
	var strength = Math.min(95, Math.max(0, parseFloat(amount) || 0)) / 100;
	if (previous == null || strength == 0) {
		return {x: target.x, y: target.y};
	}
	return {
		x: previous.x + (target.x - previous.x) * (1 - strength),
		y: previous.y + (target.y - previous.y) * (1 - strength),
	};
}
