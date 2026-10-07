/**
 * Clipping mask (Photoshop): a layer with the blend "source-atop" shows only where the layer below it has pixels.
 * Several layers on top of each other can be clipped to the same base layer.
 */

export const CLIP_COMPOSITION = 'source-atop';

/**
 * @param {{composition?: string}|null} layer
 * @returns {boolean}
 */
export function is_clipped(layer) {
	return Boolean(layer) && layer.composition === CLIP_COMPOSITION;
}

/**
 * @param {object[]} layers all layers of the document (any order)
 * @param {number} layer_id
 * @returns {boolean} there is a layer below, to which this one can be clipped
 */
export function can_clip(layers, layer_id) {
	var sorted = layers.concat().sort(function (a, b) { return b.order - a.order; });
	var index = sorted.findIndex(function (layer) { return layer.id == layer_id; });
	return index >= 0 && index < sorted.length - 1;
}

/**
 * The layer that all the clipped layers around the given one are cut by
 *
 * @param {object[]} layers all layers of the document (any order)
 * @param {number} layer_id
 * @returns {object|null} null when the layer is not clipped
 */
export function clip_base(layers, layer_id) {
	var sorted = layers.concat().sort(function (a, b) { return b.order - a.order; });
	var index = sorted.findIndex(function (layer) { return layer.id == layer_id; });
	if (index < 0 || !is_clipped(sorted[index])) {
		return null;
	}
	for (var i = index + 1; i < sorted.length; i++) {
		if (!is_clipped(sorted[i])) {
			return sorted[i];
		}
	}
	return null;
}
