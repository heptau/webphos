/**
 * Tools that work only with pixels of an image layer. On other (vector) layers - text, shapes, brush strokes -
 * they would only show an error, so the toolbar disables them.
 */
export const RASTER_TOOLS = [
	'selection', 'lasso', 'quick_select', 'magic_wand', 'quick_mask',
	'clone', 'heal', 'red_eye', 'background_eraser', 'liquify',
	'erase', 'magic_erase', 'fill',
	'blur', 'sharpen', 'smudge', 'dodge_burn', 'desaturate', 'bulge_pinch',
];

//these refuse also an image that is still a vector (opened SVG) until it is converted to raster
export const STRICT_RASTER_TOOLS = ['erase', 'magic_erase', 'fill'];

/**
 * @param {string} tool_name
 * @param {{type: string|null, is_vector: boolean}|null} layer active layer
 * @returns {boolean} the tool can not be used on the layer
 */
export function is_tool_disabled(tool_name, layer) {
	if (!layer || RASTER_TOOLS.includes(tool_name) == false) {
		return false;
	}
	//the empty first layer has no type yet and every tool can start on it
	if (layer.type != null && layer.type != 'image') {
		return true;
	}
	return STRICT_RASTER_TOOLS.includes(tool_name) && layer.is_vector === true;
}

/**
 * @param {{type: string|null, is_vector: boolean}|null} layer
 * @returns {boolean} the layer is drawn from vector data (text, shapes, strokes, opened SVG), not from pixels
 */
export function is_vector_layer(layer) {
	if (!layer || layer.type == null) {
		return false;
	}
	return layer.type != 'image' || layer.is_vector === true;
}
