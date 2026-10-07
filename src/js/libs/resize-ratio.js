/**
 * Resizing a layer with the handles: the keys that keep (or free) the proportions. Pure functions, no DOM.
 */

/**
 * Shift, Option (Alt) and Ctrl / Cmd all turn the proportions of a layer on or off during the drag: a picture keeps
 * them by default and the modifier frees them, a vector layer (a stroke, a shape, text) is free by default and the
 * modifier keeps them.
 *
 * @param {{shiftKey?: boolean, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean}} event
 * @returns {boolean}
 */
export function is_ratio_modifier(event) {
	return Boolean(event && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey));
}

/**
 * @param {boolean} keeps_by_default the layer keeps its proportions without a key (a picture)
 * @param {boolean} modifier a key from is_ratio_modifier is held
 * @returns {boolean} the proportions are kept now
 */
export function keeps_ratio(keeps_by_default, modifier) {
	return keeps_by_default !== modifier;
}

/**
 * @param {number} width wanted width (a drag of a corner gives both)
 * @param {number} height wanted height
 * @param {number} ratio width / height of the layer before the drag
 * @returns {{width: number, height: number}} the size with that ratio, the one that changed more decides
 */
export function constrain_ratio(width, height, ratio) {
	if (!(ratio > 0) || !isFinite(ratio)) {
		return {width: width, height: height};
	}
	var width_new = Math.round(height * ratio);
	var height_new = Math.round(width / ratio);
	if (width_new === 0 || height_new === 0) {
		return {width: width, height: height};
	}
	if (Math.abs(width * 100 / width_new) > Math.abs(height * 100 / height_new)) {
		return {width: width, height: height_new};
	}
	return {width: width_new, height: height};
}
