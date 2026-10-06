/**
 * Layer groups. A group is a name stored in layer.group, layers with the same name belong together.
 * It does not change how the layers are rendered; it lets you show/hide or merge the whole group at once.
 */

/**
 * @param {{group?: string|null}[]} layers
 * @returns {string[]} names of all groups in the order of their first appearance
 */
export function group_names(layers) {
	var names = [];
	layers.forEach(function (layer) {
		if (typeof layer.group === 'string' && layer.group !== '' && names.indexOf(layer.group) < 0) {
			names.push(layer.group);
		}
	});
	return names;
}

/**
 * Layers of a group (real layers only, not the empty ones created for tools)
 *
 * @template {{group?: string|null, type?: string|null}} T
 * @param {T[]} layers
 * @param {string} name
 * @returns {T[]}
 */
export function layers_in_group(layers, name) {
	return layers.filter(function (layer) {
		return layer.group === name && layer.type != null;
	});
}

/**
 * Which layers have to be toggled to show or hide a whole group: if any layer of the group is visible the group
 * is hidden, otherwise it is shown.
 *
 * @param {{id: *, group?: string|null, type?: string|null, visible?: boolean}[]} layers
 * @param {string} name
 * @returns {{ids: *[], visible: boolean}} ids of the layers to toggle and the visibility they get
 */
export function group_visibility_toggles(layers, name) {
	var members = layers_in_group(layers, name);
	var any_visible = members.some(function (layer) { return layer.visible !== false; });
	var target = !any_visible;
	return {
		ids: members.filter(function (layer) { return (layer.visible !== false) !== target; }).map(function (layer) { return layer.id; }),
		visible: target,
	};
}

/**
 * Sanitizes a group name typed by the user
 *
 * @param {*} name
 * @returns {string} trimmed name, at most 60 characters, '' for anything unusable
 */
export function clean_group_name(name) {
	return typeof name === 'string' ? name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) : '';
}
