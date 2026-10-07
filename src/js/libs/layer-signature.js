/**
 * A short text that changes whenever something that shows in the picture changes on a layer. Layers are changed in
 * many places (actions, tools, dialogs that preview), so the cache of drawn layers compares signatures instead of
 * hoping that every change tells it. Pure functions, no DOM.
 */

/**
 * Hands out the same number for the same object, so a replaced picture / mask / list of points gives another text
 *
 * @returns {function(object): number}
 */
export function make_identity() {
	var ids = new WeakMap();
	var next = 1;
	return function (object) {
		if (!ids.has(object)) {
			ids.set(object, next++);
		}
		return ids.get(object);
	};
}

/**
 * @param {object} layer
 * @param {function(object): number} identity from make_identity()
 * @returns {string}
 */
export function layer_signature(layer, identity) {
	try {
		return signature_text(layer, identity);
	}
	catch (error) {
		//something that can not be written down (a loop): never equal to another signature, so nothing is reused
		return 'x' + Math.random();
	}
}

function signature_text(layer, identity) {
	return JSON.stringify(layer, function (key, value) {
		if (key.charAt(0) === '_') {
			return undefined; //private helpers of the layer (exif, caches)
		}
		if (key === 'link' || key === 'link_canvas') {
			//the picture and whether it is loaded already (a layer is drawn empty until then)
			return value ? 'o' + identity(value) + (value.complete === false ? '-loading' : '') : null;
		}
		if (key === 'mask' && value && typeof value === 'object') {
			return 'm' + identity(value);
		}
		if ((key === 'values' || key === 'counts') && Array.isArray(value)) {
			return 'a' + identity(value) + ':' + value.length; //the long lists of a mask inside of the settings of a group
		}
		if (key === 'data') {
			if (typeof value === 'string') {
				//the picture of an image layer as a data URL: its length and ends are enough, it is replaced as a whole
				return value.length > 200 ? 's' + value.length + value.slice(0, 24) + value.slice(-24) : value;
			}
			if (value && typeof value === 'object') {
				return 'd' + identity(value) + ':' + (value.length === undefined ? '' : value.length);
			}
		}
		if (value && typeof value === 'object' && typeof value.nodeType === 'number') {
			return 'n' + identity(value);
		}
		return value;
	});
}

/**
 * @param {object[]} layers
 * @param {function(object): number} identity
 * @param {string} extra things outside of the layers that change how they are drawn (document size, fonts…)
 * @returns {string}
 */
export function stack_signature(layers, identity, extra) {
	return extra + '|' + layers.map(function (layer) { return layer_signature(layer, identity); }).join('|');
}

/**
 * Looks the same drawn on the document first and magnified afterwards as drawn magnified directly: an adjustment layer
 * (it works on a picture of the document anyway) or a picture that is neither turned nor stretched nor blurred and
 * lies on whole pixels. Magnifying uses the nearest pixel from 100 %, so then nothing is lost by drawing it once.
 *
 * @param {{type?: string|null, rotate?: number|null, width?: number, height?: number, width_original?: number, height_original?: number, x?: number, y?: number, filters?: any[]}} layer
 * @returns {boolean}
 */
export function is_pixel_exact(layer) {
	if (layer.type === 'adjustment') {
		return true;
	}
	return layer.type === 'image' && !layer.rotate && layer.width === layer.width_original && layer.height === layer.height_original
		&& Number.isInteger(layer.x) && Number.isInteger(layer.y) && (!layer.filters || layer.filters.length === 0);
}

/**
 * Can the layers below the active one be drawn once and reused? Not when the document is zoomed in and something below
 * would look different (see is_pixel_exact: vector layers are drawn sharper than the picture of the document), when a
 * clipping mask or a group reaches over the border, or when there is too little below to be worth it.
 *
 * @param {{id: *, composition?: string, group?: string|null, type?: string|null, rotate?: number|null, width?: number, height?: number, width_original?: number, height_original?: number, x?: number, y?: number, filters?: any[]}[]} layers top first
 * @param {*} active_id id of the active layer
 * @param {number} zoom
 * @returns {{upper: object[], lower: object[]}|null} the layers from the top to the active one, and the rest
 */
export function split_for_cache(layers, active_id, zoom) {
	var index = layers.findIndex(function (layer) { return layer.id == active_id; });
	if (index < 0) {
		return null;
	}
	var lower = layers.slice(index + 1);
	var upper = layers.slice(0, index + 1);
	if (lower.length < 2 || layers.some(function (layer) { return layer.composition === 'source-atop'; })) {
		return null;
	}
	if (zoom > 1 && !lower.every(is_pixel_exact)) {
		return null;
	}
	var top_group = function (layer) {
		return typeof layer.group === 'string' && layer.group !== '' ? layer.group.split('/')[0] : null;
	};
	var below_groups = lower.map(top_group).filter(function (name) { return name !== null; });
	if (upper.some(function (layer) { var name = top_group(layer); return name !== null && below_groups.indexOf(name) >= 0; })) {
		return null;
	}
	return {upper: upper, lower: lower};
}

export const PREVIEW_PIXELS = 2 * 1000 * 1000;

/**
 * How much smaller the picture is drawn while something is dragged. A document that is not much bigger than a
 * Full HD screen is always drawn in full size.
 *
 * @param {number} width width of the document
 * @param {number} height
 * @param {number} [budget] pixels that can be drawn at every move of the mouse
 * @returns {number} 1, or a number between 0.2 and 1
 */
export function preview_scale(width, height, budget) {
	var limit = budget || PREVIEW_PIXELS;
	var pixels = Math.max(1, width) * Math.max(1, height);
	if (pixels <= limit * 1.5) {
		return 1;
	}
	return Math.max(0.2, Math.sqrt(limit / pixels));
}
