/**
 * Pen tool paths: a list of anchor points, each with an optional handle for the curve that comes in and the one that
 * goes out (cubic Bezier). Pure functions, no DOM.
 *
 * @typedef {{x: number, y: number}} Point
 * @typedef {{x: number, y: number, in: Point|null, out: Point|null}} Anchor handles are absolute points (null = a corner)
 * @typedef {{index: number, part: 'anchor'|'in'|'out'}} Hit
 */
import { polygon_mask } from './selection-mask.js';

export const MAX_ANCHORS = 2000;

/**
 * @param {any} value
 * @returns {Point|null}
 */
function clean_point(value) {
	if (value && isFinite(value.x) && isFinite(value.y)) {
		return {x: Number(value.x), y: Number(value.y)};
	}
	return null;
}

/**
 * Anchors from a saved project can be anything: only valid points are kept
 *
 * @param {any} data
 * @returns {Anchor[]}
 */
export function clean_anchors(data) {
	if (!Array.isArray(data)) {
		return [];
	}
	/** @type {Anchor[]} */
	const result = [];
	for (let i = 0; i < data.length && result.length < MAX_ANCHORS; i++) {
		const point = clean_point(data[i]);
		if (point) {
			result.push({x: point.x, y: point.y, in: clean_point(data[i].in), out: clean_point(data[i].out)});
		}
	}
	return result;
}

/**
 * A new anchor that is dragged: the outgoing handle follows the mouse, the incoming one is its mirror image
 *
 * @param {Anchor} anchor changed in place
 * @param {Point} to where the outgoing handle goes
 */
export function drag_smooth(anchor, to) {
	anchor.out = {x: to.x, y: to.y};
	anchor.in = {x: 2 * anchor.x - to.x, y: 2 * anchor.y - to.y};
}

/**
 * Points along the path (curves are cut into short straight pieces)
 *
 * @param {Anchor[]} anchors
 * @param {boolean} closed
 * @param {number} [steps] pieces per curve
 * @returns {Point[]}
 */
export function flatten_path(anchors, closed, steps) {
	const n = Math.min(64, Math.max(2, steps || 16));
	/** @type {Point[]} */
	const points = [];
	if (anchors.length == 0) {
		return points;
	}
	points.push({x: anchors[0].x, y: anchors[0].y});
	const count = closed ? anchors.length : anchors.length - 1;
	for (let i = 0; i < count; i++) {
		const a = anchors[i];
		const b = anchors[(i + 1) % anchors.length];
		const p1 = a.out || a;
		const p2 = b.in || b;
		if (a.out == null && b.in == null) {
			if (!(closed && i == count - 1)) {
				points.push({x: b.x, y: b.y});
			}
			continue;
		}
		for (let s = 1; s <= n; s++) {
			if (closed && i == count - 1 && s == n) {
				break; //back at the first point
			}
			const t = s / n;
			const u = 1 - t;
			points.push({
				x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
				y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
			});
		}
	}
	return points;
}

/**
 * @param {Point[]} points
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
export function bounds_of(points) {
	if (points.length == 0) {
		return null;
	}
	let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
	points.forEach((p) => {
		min_x = Math.min(min_x, p.x);
		min_y = Math.min(min_y, p.y);
		max_x = Math.max(max_x, p.x);
		max_y = Math.max(max_y, p.y);
	});
	return {x: min_x, y: min_y, width: max_x - min_x, height: max_y - min_y};
}

/**
 * What is under the mouse: an anchor or one of its handles (handles are tested first, they lie on top)
 *
 * @param {Anchor[]} anchors
 * @param {Point} point
 * @param {number} radius
 * @returns {Hit|null}
 */
export function hit_path(anchors, point, radius) {
	const near = function (p) {
		return p != null && Math.hypot(p.x - point.x, p.y - point.y) <= radius;
	};
	for (let i = anchors.length - 1; i >= 0; i--) {
		if (near(anchors[i].out)) {
			return {index: i, part: 'out'};
		}
		if (near(anchors[i].in)) {
			return {index: i, part: 'in'};
		}
	}
	for (let j = anchors.length - 1; j >= 0; j--) {
		if (near(anchors[j])) {
			return {index: j, part: 'anchor'};
		}
	}
	return null;
}

/**
 * Moves an anchor or a handle. A moved anchor takes its handles with it; a moved handle turns the opposite one
 * around the anchor (keeping its length) unless Alt is held.
 *
 * @param {Anchor} anchor changed in place
 * @param {'anchor'|'in'|'out'} part
 * @param {Point} to
 * @param {boolean} [independent] move only this handle
 */
export function move_part(anchor, part, to, independent) {
	if (part == 'anchor') {
		const dx = to.x - anchor.x;
		const dy = to.y - anchor.y;
		anchor.x = to.x;
		anchor.y = to.y;
		if (anchor.in) {
			anchor.in = {x: anchor.in.x + dx, y: anchor.in.y + dy};
		}
		if (anchor.out) {
			anchor.out = {x: anchor.out.x + dx, y: anchor.out.y + dy};
		}
		return;
	}
	const other = part == 'in' ? 'out' : 'in';
	const old_other = anchor[other];
	anchor[part] = {x: to.x, y: to.y};
	if (independent || old_other == null) {
		return;
	}
	const length = Math.hypot(old_other.x - anchor.x, old_other.y - anchor.y);
	const vx = anchor.x - to.x;
	const vy = anchor.y - to.y;
	const size = Math.hypot(vx, vy);
	if (size > 0) {
		anchor[other] = {x: anchor.x + vx / size * length, y: anchor.y + vy / size * length};
	}
}

/**
 * Selection mask of the area inside a path (an open path is closed by a straight line)
 *
 * @param {Anchor[]} anchors in the pixels of the picture
 * @param {number} width
 * @param {number} height
 * @returns {ReturnType<typeof polygon_mask>}
 */
export function path_mask(anchors, width, height) {
	return polygon_mask(flatten_path(anchors, true), width, height);
}
