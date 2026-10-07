/**
 * The outline of a selection mask as a polygon (for Make Work Path from Selection). Pure functions, no DOM.
 *
 * @typedef {{x: number, y: number}} Point
 */

/**
 * Douglas-Peucker for an open run of points (no recursion, a long outline would be too deep)
 *
 * @param {Point[]} points
 * @param {number} epsilon
 * @returns {Point[]}
 */
function simplify_run(points, epsilon) {
	if (points.length < 3) {
		return points.slice();
	}
	var keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	var stack = [[0, points.length - 1]];
	while (stack.length > 0) {
		var range = stack.pop();
		var a = points[range[0]];
		var b = points[range[1]];
		var dx = b.x - a.x;
		var dy = b.y - a.y;
		var length = Math.hypot(dx, dy);
		var far = -1;
		var far_distance = epsilon;
		for (var i = range[0] + 1; i < range[1]; i++) {
			var p = points[i];
			var distance = length == 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / length;
			if (distance > far_distance) {
				far_distance = distance;
				far = i;
			}
		}
		if (far >= 0) {
			keep[far] = 1;
			stack.push([range[0], far], [far, range[1]]);
		}
	}
	return points.filter(function (point, index) { return keep[index] == 1; });
}

/**
 * A closed polygon with fewer points that stays within `epsilon` pixels of the original
 *
 * @param {Point[]} points
 * @param {number} epsilon
 * @returns {Point[]}
 */
export function simplify_polygon(points, epsilon) {
	if (points.length < 4) {
		return points.slice();
	}
	//a closed outline is cut in two at the point farthest from the first one
	var far = 0;
	var far_distance = -1;
	for (var i = 1; i < points.length; i++) {
		var distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
		if (distance > far_distance) {
			far_distance = distance;
			far = i;
		}
	}
	var first = simplify_run(points.slice(0, far + 1), epsilon);
	var second = simplify_run(points.slice(far).concat([points[0]]), epsilon);
	return first.concat(second.slice(1, -1));
}

/**
 * @param {Point[]} points
 * @returns {number} absolute area of the polygon
 */
export function polygon_area(points) {
	var sum = 0;
	for (var i = 0; i < points.length; i++) {
		var a = points[i];
		var b = points[(i + 1) % points.length];
		sum += a.x * b.y - b.x * a.y;
	}
	return Math.abs(sum) / 2;
}

/**
 * The outer outline of the biggest selected area (pixels with a value of 128 or more), simplified.
 *
 * @param {{width: number, height: number, data: Uint8ClampedArray}} mask
 * @param {number} [epsilon] how far the outline may move from the pixel edges, in pixels
 * @returns {Point[]} polygon, empty when nothing is selected
 */
export function mask_outline(mask, epsilon) {
	var w = mask.width;
	var h = mask.height;
	var data = mask.data;
	var inside = function (x, y) {
		return x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] >= 128;
	};
	var stride = w + 1;
	//edges around the selected pixels, walked clockwise, so the selected side is always on the same hand
	/** @type {Map<number, number[]>} */
	var starts = new Map();
	var add = function (x1, y1, x2, y2) {
		var key = y1 * stride + x1;
		var list = starts.get(key);
		if (!list) {
			list = [];
			starts.set(key, list);
		}
		list.push(y2 * stride + x2);
	};
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			if (!inside(x, y)) {
				continue;
			}
			if (!inside(x, y - 1)) {
				add(x, y, x + 1, y);
			}
			if (!inside(x + 1, y)) {
				add(x + 1, y, x + 1, y + 1);
			}
			if (!inside(x, y + 1)) {
				add(x + 1, y + 1, x, y + 1);
			}
			if (!inside(x - 1, y)) {
				add(x, y + 1, x, y);
			}
		}
	}
	/** @type {Point[]} */
	var best = [];
	var best_area = 0;
	while (starts.size > 0) {
		var first = starts.keys().next().value;
		var loop = [];
		var key = first;
		do {
			loop.push({x: key % stride, y: Math.floor(key / stride)});
			var list = starts.get(key);
			var next = list.pop();
			if (list.length == 0) {
				starts.delete(key);
			}
			key = next;
		} while (key !== first && starts.has(key));
		var area = polygon_area(loop);
		if (area > best_area) {
			best_area = area;
			best = loop;
		}
	}
	if (best.length == 0) {
		return [];
	}
	//only the corners of the outline are needed before the simplification
	var corners = best.filter(function (p, i) {
		var a = best[(i + best.length - 1) % best.length];
		var b = best[(i + 1) % best.length];
		return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) != 0;
	});
	return simplify_polygon(corners, epsilon === undefined ? 1.5 : epsilon);
}
