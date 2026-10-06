/**
 * Layer masks. A layer mask hides parts of a layer without touching its pixels (non-destructive).
 * It lives in the coordinates of the layer (width x height of the layer box, so it moves, resizes and rotates with the layer)
 * and is stored in the layer as a small JSON friendly object, so it survives duplicating and saving as project:
 * {width, height, values: [...], counts: [...]} - run-length encoded 8 bit mask (255 = visible, 0 = hidden).
 */
import { create_mask, sample_mask_for_layer, resize_mask } from './selection-mask.js';
import { rle_encode, rle_decode } from './selection-store.js';

var MAX_PIXELS = 64 * 1000 * 1000;

/**
 * @param {{width: number, height: number, data: Uint8ClampedArray}} mask
 * @returns {{width: number, height: number, values: number[], counts: number[]}}
 */
export function serialize_layer_mask(mask) {
	var rle = rle_encode(mask.data);
	return {width: mask.width, height: mask.height, values: Array.from(rle.values), counts: Array.from(rle.counts)};
}

/**
 * @param {object} stored value of layer.mask
 * @returns {{width: number, height: number, data: Uint8ClampedArray}|null} null when missing or invalid
 */
export function deserialize_layer_mask(stored) {
	if (!stored || !(stored.width > 0) || !(stored.height > 0) || stored.width * stored.height > MAX_PIXELS
		|| !Array.isArray(stored.values) || !Array.isArray(stored.counts)) {
		return null;
	}
	var data = rle_decode(Uint8Array.from(stored.values), Uint32Array.from(stored.counts), stored.width * stored.height);
	return data ? {width: stored.width, height: stored.height, data: data} : null;
}

/**
 * Mask with one value for the whole layer: 255 reveals everything, 0 hides everything
 *
 * @param {{width: number, height: number}} layer
 * @param {number} value
 */
export function uniform_layer_mask(layer, value) {
	return create_mask(Math.max(1, Math.round(layer.width)), Math.max(1, Math.round(layer.height)), value);
}

/**
 * Layer mask from a selection mask (canvas coordinates): selected = visible
 *
 * @param {object} selection_mask canvas-size mask
 * @param {{x: number, y: number, width: number, height: number}} layer
 */
export function layer_mask_from_selection(selection_mask, layer) {
	var width = Math.max(1, Math.round(layer.width));
	var height = Math.max(1, Math.round(layer.height));
	var geometry = {x: layer.x, y: layer.y, width: width, height: height};
	return {width: width, height: height, data: sample_mask_for_layer(selection_mask, geometry, width, height)};
}

/**
 * Layer mask as a canvas-size selection mask (everything outside of the layer is not selected)
 *
 * @param {object} layer_mask
 * @param {{x: number, y: number}} layer
 * @param {number} canvas_width
 * @param {number} canvas_height
 */
export function layer_mask_to_selection(layer_mask, layer, canvas_width, canvas_height) {
	var result = create_mask(canvas_width, canvas_height);
	var offset_x = Math.round(layer.x);
	var offset_y = Math.round(layer.y);
	for (var y = 0; y < layer_mask.height; y++) {
		var cy = y + offset_y;
		if (cy < 0 || cy >= canvas_height) {
			continue;
		}
		for (var x = 0; x < layer_mask.width; x++) {
			var cx = x + offset_x;
			if (cx >= 0 && cx < canvas_width) {
				result.data[cy * canvas_width + cx] = layer_mask.data[y * layer_mask.width + x];
			}
		}
	}
	return result;
}

/**
 * Bakes the mask into the alpha channel of the layer image (Layer > Layer Mask > Apply). Modifies image in place.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image original-resolution image data of the layer
 * @param {object} layer_mask mask in layer box resolution (resampled when the sizes differ)
 */
export function apply_layer_mask(image, layer_mask) {
	var mask = resize_mask(layer_mask, image.width, image.height);
	for (var p = 0, i = 3; p < mask.data.length; p++, i += 4) {
		image.data[i] = image.data[i] * mask.data[p] / 255;
	}
	return image;
}
