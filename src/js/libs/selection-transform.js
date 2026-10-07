/**
 * Transform Selection with the mouse: a frame lies around the selection; its handles scale it, the inside moves it
 * and the outside turns it. The frame is the selection's bounding rectangle scaled, turned and moved, which is the
 * same thing that transform_mask() (libs/selection-mask.js) does. Pure functions, no DOM.
 *
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 * @typedef {{scale_x: number, scale_y: number, rotate: number, dx: number, dy: number}} Transform
 *   scale in percent, rotate in degrees (clockwise), dx and dy in pixels
 */

export const SCALE_HANDLES = ['tl', 'tr', 'br', 'bl', 'top', 'right', 'bottom', 'left'];

//which sides a handle moves: -1 = the left / top one, 1 = the right / bottom one, 0 = this direction stays
const SIGNS = {
	tl: [-1, -1], tr: [1, -1], br: [1, 1], bl: [-1, 1],
	top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0],
};

const MIN_SCALE = 1;
const MAX_SCALE = 1000;
const MIN_SIZE = 2; //pixels

export var IDENTITY = {scale_x: 100, scale_y: 100, rotate: 0, dx: 0, dy: 0};

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * @param {Rect} bounds the selection before the transformation
 * @param {Transform} t
 * @returns {{cx: number, cy: number, hw: number, hh: number, angle: number}} the frame: center, half sizes, angle (radians)
 */
export function frame_of(bounds, t) {
	return {
		cx: bounds.x + bounds.width / 2 + t.dx,
		cy: bounds.y + bounds.height / 2 + t.dy,
		hw: bounds.width * t.scale_x / 200,
		hh: bounds.height * t.scale_y / 200,
		angle: t.rotate * Math.PI / 180,
	};
}

/**
 * @param {{x: number, y: number}} point in the picture
 * @param {object} frame from frame_of
 * @returns {{x: number, y: number}} the point in the frame: from its center, along its sides
 */
export function to_local(point, frame) {
	var dx = point.x - frame.cx;
	var dy = point.y - frame.cy;
	var cos = Math.cos(frame.angle);
	var sin = Math.sin(frame.angle);
	return {x: dx * cos + dy * sin, y: -dx * sin + dy * cos};
}

/**
 * @param {{x: number, y: number}} local point in the frame
 * @param {object} frame
 * @returns {{x: number, y: number}} the point in the picture
 */
export function from_local(local, frame) {
	var cos = Math.cos(frame.angle);
	var sin = Math.sin(frame.angle);
	return {x: frame.cx + local.x * cos - local.y * sin, y: frame.cy + local.x * sin + local.y * cos};
}

/**
 * @param {Rect} bounds
 * @param {Transform} t
 * @param {number} rotate_distance how far above the top edge the rotation handle is (pixels)
 * @returns {Object<string, {x: number, y: number}>} places of the handles and of the corners of the frame
 */
export function handle_points(bounds, t, rotate_distance) {
	var f = frame_of(bounds, t);
	var result = {};
	SCALE_HANDLES.forEach(function (name) {
		result[name] = from_local({x: SIGNS[name][0] * f.hw, y: SIGNS[name][1] * f.hh}, f);
	});
	result.rotate = from_local({x: 0, y: -f.hh - (rotate_distance || 0)}, f);
	return result;
}

/**
 * What is under a point
 *
 * @param {Rect} bounds
 * @param {Transform} t
 * @param {{x: number, y: number}} point
 * @param {number} reach how near a handle the point has to be (pixels)
 * @param {number} rotate_distance
 * @returns {string|null} a handle ('tl'... 'left'), 'rotate' (the handle above the frame or the outside near it),
 *   'move' (inside the frame) or null (far from the frame)
 */
export function hit_test(bounds, t, point, reach, rotate_distance) {
	var points = handle_points(bounds, t, rotate_distance);
	var near = function (name) {
		return Math.hypot(points[name].x - point.x, points[name].y - point.y) <= reach;
	};
	if (near('rotate')) {
		return 'rotate';
	}
	//corners first, they are small and edges are long
	var order = ['tl', 'tr', 'br', 'bl', 'top', 'right', 'bottom', 'left'];
	for (var i = 0; i < order.length; i++) {
		if (near(order[i])) {
			return order[i];
		}
	}
	var f = frame_of(bounds, t);
	var local = to_local(point, f);
	if (Math.abs(local.x) <= f.hw && Math.abs(local.y) <= f.hh) {
		return 'move';
	}
	//a little outside of the frame turns it
	if (Math.abs(local.x) <= f.hw + reach * 2.5 && Math.abs(local.y) <= f.hh + reach * 2.5) {
		return 'rotate';
	}
	return null;
}

/**
 * The transformation after a drag
 *
 * @param {Rect} bounds
 * @param {Transform} start the transformation when the drag began
 * @param {string} kind what is dragged: a handle, 'rotate' or 'move'
 * @param {{x: number, y: number}} from where the mouse went down
 * @param {{x: number, y: number}} to where the mouse is now
 * @param {{shift?: boolean, alt?: boolean}} [keys] Shift keeps the proportions of a corner drag (and turns by 15 degrees),
 *   Alt scales around the center
 * @returns {Transform} a new transformation
 */
export function drag_transform(bounds, start, kind, from, to, keys) {
	keys = keys || {};
	var result = {scale_x: start.scale_x, scale_y: start.scale_y, rotate: start.rotate, dx: start.dx, dy: start.dy};
	var f = frame_of(bounds, start);

	if (kind == 'move') {
		result.dx = start.dx + (to.x - from.x);
		result.dy = start.dy + (to.y - from.y);
		return result;
	}
	if (kind == 'rotate') {
		var before = Math.atan2(from.y - f.cy, from.x - f.cx);
		var now = Math.atan2(to.y - f.cy, to.x - f.cx);
		var degrees = start.rotate + (now - before) * 180 / Math.PI;
		if (keys.shift) {
			degrees = Math.round(degrees / 15) * 15;
		}
		degrees = ((degrees % 360) + 360) % 360;
		result.rotate = degrees > 180 ? degrees - 360 : degrees;
		return result;
	}
	if (!SIGNS[kind]) {
		return result;
	}

	var signs = SIGNS[kind];
	var q = to_local(to, f);
	var half = [f.hw, f.hh];
	var size = [0, 0]; //new half size in the frame
	var center = [0, 0]; //new center in the frame
	for (var axis = 0; axis < 2; axis++) {
		var s = signs[axis];
		if (s == 0) {
			size[axis] = half[axis];
			center[axis] = 0;
			continue;
		}
		var pointer = axis == 0 ? q.x : q.y;
		if (keys.alt) {
			//around the center
			size[axis] = Math.max(MIN_SIZE / 2, Math.abs(pointer));
			center[axis] = 0;
		}
		else {
			var fixed = -s * half[axis]; //the side on the other end stays where it is
			var moved = s * (pointer - fixed) >= MIN_SIZE ? pointer : fixed + s * MIN_SIZE;
			size[axis] = Math.abs(moved - fixed) / 2;
			center[axis] = (moved + fixed) / 2;
		}
	}
	if (keys.shift && signs[0] != 0 && signs[1] != 0) {
		//the proportions of the frame stay: the bigger of the two changes counts
		var factor = Math.max(size[0] / f.hw, size[1] / f.hh);
		for (var a = 0; a < 2; a++) {
			var anchor = keys.alt ? 0 : -signs[a] * half[a];
			size[a] = half[a] * factor;
			center[a] = keys.alt ? 0 : anchor + signs[a] * size[a];
		}
	}

	var scale_x = clamp(size[0] * 200 / bounds.width, MIN_SCALE, MAX_SCALE);
	var scale_y = clamp(size[1] * 200 / bounds.height, MIN_SCALE, MAX_SCALE);
	//a clamped size moves the center, so the side that must stay fixed stays
	var final_half = [bounds.width * scale_x / 200, bounds.height * scale_y / 200];
	for (var b = 0; b < 2; b++) {
		if (signs[b] != 0 && !keys.alt) {
			center[b] = -signs[b] * half[b] + signs[b] * final_half[b];
		}
	}
	var moved_center = from_local({x: center[0], y: center[1]}, f);
	result.scale_x = scale_x;
	result.scale_y = scale_y;
	result.dx = moved_center.x - (bounds.x + bounds.width / 2);
	result.dy = moved_center.y - (bounds.y + bounds.height / 2);
	return result;
}
