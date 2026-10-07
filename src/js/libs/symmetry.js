/**
 * Symmetry painting: the brush stroke is repeated mirrored or turned around the center of the picture.
 *
 * @typedef {{sx: number, sy: number, angle: number}} Symmetry_transform scale by sx, sy (1 or -1), then turn by angle (radians)
 */

export const SYMMETRY_MODES = ['Off', 'Horizontal', 'Vertical', 'Both', 'Radial 3', 'Radial 4', 'Radial 6', 'Radial 8'];

/**
 * @param {string|{value: string}} mode one of SYMMETRY_MODES (or a tool setting holding it)
 * @returns {Symmetry_transform[]} all the copies of a stroke, the first one is the stroke itself
 */
export function symmetry_transforms(mode) {
	if (mode && mode.value !== undefined) {
		mode = mode.value;
	}
	var identity = {sx: 1, sy: 1, angle: 0};
	switch (mode) {
		case 'Horizontal':
			//left and right are swapped
			return [identity, {sx: -1, sy: 1, angle: 0}];
		case 'Vertical':
			return [identity, {sx: 1, sy: -1, angle: 0}];
		case 'Both':
			return [identity, {sx: -1, sy: 1, angle: 0}, {sx: 1, sy: -1, angle: 0}, {sx: -1, sy: -1, angle: 0}];
		default:
			break;
	}
	var radial = /^Radial (\d+)$/.exec(String(mode));
	if (radial) {
		var count = Math.min(24, Math.max(2, parseInt(radial[1], 10)));
		var result = [];
		for (var i = 0; i < count; i++) {
			result.push({sx: 1, sy: 1, angle: 2 * Math.PI * i / count});
		}
		return result;
	}
	return [identity];
}

/**
 * Where the copies of a point are
 *
 * @param {{x: number, y: number}} point
 * @param {{x: number, y: number}} center
 * @param {string} mode
 * @returns {{x: number, y: number}[]}
 */
export function symmetric_points(point, center, mode) {
	return symmetry_transforms(mode).map(function (transform) {
		var dx = (point.x - center.x) * transform.sx;
		var dy = (point.y - center.y) * transform.sy;
		var cos = Math.cos(transform.angle);
		var sin = Math.sin(transform.angle);
		return {x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos};
	});
}
