/**
 * File names for File > Export Layers.
 */

/**
 * @param {string} name layer name
 * @returns {string} safe part of a file name
 */
export function safe_layer_name(name) {
	var clean = String(name == null ? '' : name)
		.replace(/\.[a-z0-9]{2,4}$/i, '') //"photo.jpg" -> "photo"
		.replace(/[^\p{L}\p{N}\-_. ]+/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/^\.+/, '')
		.slice(0, 60);
	return clean == '' ? 'layer' : clean;
}

/**
 * Names of the files, in the order of the layers (bottom first), numbered so the order is kept and no two are the same.
 *
 * @param {{name: string}[]} layers
 * @returns {string[]} like "01-background.png"
 */
export function layer_file_names(layers) {
	var width = String(layers.length).length;
	return layers.map(function (layer, index) {
		return String(index + 1).padStart(Math.max(2, width), '0') + '-' + safe_layer_name(layer.name) + '.png';
	});
}
