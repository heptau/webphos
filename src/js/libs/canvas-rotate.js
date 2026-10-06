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
