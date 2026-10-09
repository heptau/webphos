/**
 * Brush and pencil layers draw their strokes from points that are measured from the corner of the layer. When the
 * layer is resized with the handles, `width` and `height` change but the points do not, so the strokes are drawn
 * scaled by the ratio of the new size to the size of the strokes when they were drawn (`width_original`,
 * `height_original`, set after every stroke). Pure functions, no DOM.
 */

/**
 * @param {{width?: number|null, height?: number|null, width_original?: number|null, height_original?: number|null}} layer
 * @returns {{x: number, y: number}} how much the strokes are stretched; 1 when the size of the strokes is not known
 *   (a stroke that is being drawn, an older layer) or is zero (a straight line has no height)
 */
export function stroke_scale(layer) {
	const ratio = function (size, original) {
		if (!(original > 0) || !(size > 0)) {
			return 1;
		}
		return Math.min(100, Math.max(0.01, size / original));
	};
	return {x: ratio(layer.width, layer.width_original), y: ratio(layer.height, layer.height_original)};
}

/**
 * @param {object} layer
 * @returns {boolean} the strokes of the layer are stretched (a new stroke must not be added to it, it would be stretched too)
 */
export function is_stretched(layer) {
	const scale = stroke_scale(layer);
	return Math.abs(scale.x - 1) > 0.001 || Math.abs(scale.y - 1) > 0.001;
}
