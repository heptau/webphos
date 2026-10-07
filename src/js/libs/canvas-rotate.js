/**
 * Geometry for rotating the whole canvas by 90/180/270 degrees clockwise.
 */

/**
 * New canvas size after rotation
 *
 * @param {number} width
 * @param {number} height
 * @param {number} angle 90, 180 or 270 (clockwise)
 * @returns {{width: number, height: number}}
 */
export function rotated_canvas_size(width, height, angle) {
	return angle == 90 || angle == 270 ? {width: height, height: width} : {width: width, height: height};
}

/**
 * Where an axis-aligned box (x, y, width, height) ends up after rotating the canvas clockwise.
 *
 * @param {{x: number, y: number, width: number, height: number}} box
 * @param {number} canvas_width canvas size BEFORE rotation
 * @param {number} canvas_height
 * @param {number} angle 90, 180 or 270 (clockwise)
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function rotate_box(box, canvas_width, canvas_height, angle) {
	var x = box.x, y = box.y, w = box.width, h = box.height;
	switch (angle) {
		case 90:
			return {x: canvas_height - (y + h), y: x, width: h, height: w};
		case 180:
			return {x: canvas_width - (x + w), y: canvas_height - (y + h), width: w, height: h};
		case 270:
			return {x: y, y: canvas_width - (x + w), width: h, height: w};
		default:
			return {x: x, y: y, width: w, height: h};
	}
}

/**
 * Canvas for an image turned by any angle: the smallest one that holds the whole turned picture.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} angle degrees, clockwise
 * @returns {{width: number, height: number}}
 */
export function arbitrary_canvas_size(width, height, angle) {
	var radians = angle * Math.PI / 180;
	var cos = Math.abs(Math.cos(radians));
	var sin = Math.abs(Math.sin(radians));
	return {
		width: Math.max(1, Math.ceil(width * cos + height * sin - 1e-9)),
		height: Math.max(1, Math.ceil(width * sin + height * cos - 1e-9)),
	};
}

/**
 * Where a point goes when the whole canvas is turned clockwise by an angle and the canvas grows to hold it.
 *
 * @param {{x: number, y: number}} point
 * @param {{width: number, height: number}} old_size
 * @param {{width: number, height: number}} new_size
 * @param {number} angle degrees, clockwise
 * @returns {{x: number, y: number}}
 */
export function rotate_point_arbitrary(point, old_size, new_size, angle) {
	var radians = angle * Math.PI / 180;
	var dx = point.x - old_size.width / 2;
	var dy = point.y - old_size.height / 2;
	return {
		x: new_size.width / 2 + dx * Math.cos(radians) - dy * Math.sin(radians),
		y: new_size.height / 2 + dx * Math.sin(radians) + dy * Math.cos(radians),
	};
}

/**
 * Angle that makes a measured line horizontal (Image > Straighten): the smallest turn, between -90 and 90 degrees.
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @returns {number} degrees, clockwise; 0 for a point
 */
export function straighten_angle(from, to) {
	var dx = to.x - from.x;
	var dy = to.y - from.y;
	if (dx == 0 && dy == 0) {
		return 0;
	}
	var angle = Math.atan2(dy, dx) * 180 / Math.PI;
	if (angle > 90) {
		angle -= 180;
	}
	else if (angle <= -90) {
		angle += 180;
	}
	return Math.round(-angle * 100) / 100 || 0;
}
