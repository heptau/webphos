/**
 * Pattern for renaming many layers at once.
 */

/**
 * @param {string} pattern text with {n} (number), {name} (old name) and {type}
 * @param {{name: string, type: string}} layer
 * @param {number} index position of the layer in the list, starting from 0
 * @param {number} start number of the first layer
 * @returns {string} new name, at most 100 characters
 */
export function apply_name_pattern(pattern, layer, index, start) {
	const number = (parseInt(start, 10) || 0) + index;
	let name = String(pattern == undefined ? '' : pattern)
		.replace(/\{n\}/g, String(number))
		.replace(/\{nn\}/g, (`0${  number}`).slice(-2))
		.replace(/\{name\}/g, String(layer.name))
		.replace(/\{type\}/g, String(layer.type == null ? 'layer' : layer.type));
	name = name.replace(/[<>]/g, '').trim();
	return (name == '' ? String(layer.name) : name).slice(0, 100);
}
