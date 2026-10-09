/**
 * Pure geometry helpers for the rectangular selection.
 * Selection coordinates are canvas coordinates, layer rectangles are in pixels of the layer's original image.
 *
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Converts a selection (canvas coordinates) to a rectangle in the original pixels of a layer image, clamped to the image.
 *
 * @param {Rect} selection
 * @param {{x: number, y: number, width: number, height: number, width_original: number, height_original: number}} layer
 * @returns {Rect|null} null when the selection does not intersect the layer
 */
export function selection_to_layer_rect(selection, layer) {
	if (!selection || !selection.width || !selection.height) {
		return null;
	}
	const scale_x = layer.width_original / layer.width;
	const scale_y = layer.height_original / layer.height;
	const left = clamp(Math.round((selection.x - layer.x) * scale_x), 0, layer.width_original);
	const top = clamp(Math.round((selection.y - layer.y) * scale_y), 0, layer.height_original);
	const right = clamp(Math.round((selection.x + selection.width - layer.x) * scale_x), 0, layer.width_original);
	const bottom = clamp(Math.round((selection.y + selection.height - layer.y) * scale_y), 0, layer.height_original);
	if (right <= left || bottom <= top) {
		return null;
	}
	return {x: left, y: top, width: right - left, height: bottom - top};
}

/**
 * Grows (positive amount) or shrinks (negative) the selection on all sides, clamped to the canvas.
 *
 * @param {Rect} selection
 * @param {number} amount in pixels
 * @param {number} canvas_width
 * @param {number} canvas_height
 * @returns {Rect|null} null when nothing is left
 */
export function grow_rect(selection, amount, canvas_width, canvas_height) {
	amount = Math.round(amount) || 0;
	const left = clamp(selection.x - amount, 0, canvas_width);
	const top = clamp(selection.y - amount, 0, canvas_height);
	const right = clamp(selection.x + selection.width + amount, 0, canvas_width);
	const bottom = clamp(selection.y + selection.height + amount, 0, canvas_height);
	if (right <= left || bottom <= top) {
		return null;
	}
	return {x: left, y: top, width: right - left, height: bottom - top};
}
