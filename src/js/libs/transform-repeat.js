/**
 * Edit > Transform Again (Shift+Ctrl+T): the last move / scale / rotation of a layer is repeated on the active layer.
 * Pure functions, the Move tool records the transformation.
 *
 * @typedef {{x: number, y: number, width: number, height: number, rotate: number}} Geometry
 * @typedef {{dx: number, dy: number, scale_x: number, scale_y: number, rotate: number}} Transformation
 */

/**
 * @param {Geometry} before
 * @param {Geometry} after
 * @returns {Transformation|null} what changed (the center moves, the size is scaled around the center,
 *   the rotation is added); null when nothing changed
 */
export function describe_transform(before, after) {
	const before_rotate = before.rotate || 0;
	const after_rotate = after.rotate || 0;
	const result = {
		dx: (after.x + after.width / 2) - (before.x + before.width / 2),
		dy: (after.y + after.height / 2) - (before.y + before.height / 2),
		scale_x: before.width ? after.width / before.width : 1,
		scale_y: before.height ? after.height / before.height : 1,
		rotate: after_rotate - before_rotate,
	};
	if (result.dx == 0 && result.dy == 0 && result.scale_x == 1 && result.scale_y == 1 && result.rotate == 0) {
		return null;
	}
	return result;
}

/**
 * @param {Geometry} geometry
 * @param {Transformation} change
 * @returns {Geometry} the geometry after the same transformation
 */
export function apply_transform(geometry, change) {
	const width = geometry.width * change.scale_x;
	const height = geometry.height * change.scale_y;
	const center_x = geometry.x + geometry.width / 2 + change.dx;
	const center_y = geometry.y + geometry.height / 2 + change.dy;
	let rotate = ((geometry.rotate || 0) + change.rotate) % 360;
	if (rotate < 0) {
		rotate += 360;
	}
	return {
		x: Math.round(center_x - width / 2),
		y: Math.round(center_y - height / 2),
		width: Math.round(width),
		height: Math.round(height),
		rotate,
	};
}

let last = null;

/**
 * @param {Transformation|null} change
 */
export function remember_transform(change) {
	last = change;
}

/**
 * @returns {Transformation|null}
 */
export function last_transform() {
	return last;
}
