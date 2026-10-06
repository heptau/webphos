/**
 * Geometry of Layer > Align / Distribute. Layers are described by x, y, width, height and rotate (degrees,
 * around the center of the layer); alignment works with the bounding box of the rotated layer.
 *
 * @typedef {{left: number, top: number, right: number, bottom: number}} Bounds
 */

/**
 * Bounding box of a (rotated) layer in canvas coordinates
 *
 * @param {{x: number, y: number, width: number, height: number, rotate?: number|null}} layer
 * @returns {Bounds}
 */
export function layer_bounds(layer) {
	var angle = (layer.rotate || 0) * Math.PI / 180;
	var cos = Math.abs(Math.cos(angle));
	var sin = Math.abs(Math.sin(angle));
	var half_width = (layer.width * cos + layer.height * sin) / 2;
	var half_height = (layer.width * sin + layer.height * cos) / 2;
	var center_x = layer.x + layer.width / 2;
	var center_y = layer.y + layer.height / 2;
	return {left: center_x - half_width, top: center_y - half_height, right: center_x + half_width, bottom: center_y + half_height};
}

export var ALIGN_MODES = ['left', 'center', 'right', 'top', 'middle', 'bottom'];

/**
 * How far a layer has to move to be aligned to a reference rectangle (canvas or selection).
 *
 * @param {Bounds} bounds bounding box of the layer
 * @param {string} mode left, center (horizontal), right, top, middle (vertical), bottom
 * @param {Bounds} reference
 * @returns {{dx: number, dy: number}} whole pixels
 */
export function align_delta(bounds, mode, reference) {
	var dx = 0;
	var dy = 0;
	switch (mode) {
		case 'left':
			dx = reference.left - bounds.left;
			break;
		case 'center':
			dx = (reference.left + reference.right) / 2 - (bounds.left + bounds.right) / 2;
			break;
		case 'right':
			dx = reference.right - bounds.right;
			break;
		case 'top':
			dy = reference.top - bounds.top;
			break;
		case 'middle':
			dy = (reference.top + reference.bottom) / 2 - (bounds.top + bounds.bottom) / 2;
			break;
		case 'bottom':
			dy = reference.bottom - bounds.bottom;
			break;
	}
	return {dx: Math.round(dx), dy: Math.round(dy)};
}

/**
 * Moves layers so that the gaps between neighbouring layers are equal. The first and the last layer (by position)
 * stay where they are.
 *
 * @param {{id: *, bounds: Bounds}[]} items at least 3 are needed to change anything
 * @param {'x'|'y'} axis x spreads horizontally, y vertically
 * @returns {{id: *, dx: number, dy: number}[]} movement of each layer (whole pixels, zero for the ones that stay)
 */
export function distribute_deltas(items, axis) {
	var start = axis == 'x' ? 'left' : 'top';
	var end = axis == 'x' ? 'right' : 'bottom';
	var sorted = items.slice().sort(function (a, b) {
		return (a.bounds[start] + a.bounds[end]) - (b.bounds[start] + b.bounds[end]);
	});
	var result = [];
	if (sorted.length < 3) {
		return sorted.map(function (item) { return {id: item.id, dx: 0, dy: 0}; });
	}
	var span_start = sorted[0].bounds[start];
	var span_end = sorted[sorted.length - 1].bounds[end];
	var total_size = 0;
	sorted.forEach(function (item) {
		total_size += item.bounds[end] - item.bounds[start];
	});
	var gap = (span_end - span_start - total_size) / (sorted.length - 1);

	var position = span_start;
	sorted.forEach(function (item, index) {
		var size = item.bounds[end] - item.bounds[start];
		var move = index == 0 || index == sorted.length - 1 ? 0 : Math.round(position - item.bounds[start]);
		result.push({id: item.id, dx: axis == 'x' ? move : 0, dy: axis == 'y' ? move : 0});
		position += size + gap;
	});
	return result;
}
