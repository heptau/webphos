/**
 * Distance and angle between two points (Measure tool).
 */

/**
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {{dx: number, dy: number, length: number, angle: number}} angle in degrees, 0 = to the right, positive = up (like a math graph)
 */
export function measure(from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
	if (angle == 0) {
		angle = 0; //no negative zero
	}
	return {
		dx,
		dy,
		length: Math.hypot(dx, dy),
		angle,
	};
}

/**
 * @param {{dx: number, dy: number, length: number, angle: number}} result
 * @returns {string} e.g. "W: 120  H: 45  L: 128.2  A: 20.5°"
 */
export function format_measure(result) {
	const round = (value) => String(Math.round(value * 10) / 10);
	return `W: ${round(Math.abs(result.dx))}  H: ${round(Math.abs(result.dy))}  L: ${round(result.length)}  A: ${round(result.angle)}°`;
}
