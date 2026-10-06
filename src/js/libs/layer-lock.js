/**
 * Layer lock: a locked layer keeps its pixels and its place (position, size, rotation, parameters).
 * Visibility, opacity, name, order, filters and the lock itself can still be changed.
 */

export var LOCKED_PROPERTIES = ['x', 'y', 'width', 'height', 'rotate', 'width_original', 'height_original', 'params', 'data'];

/**
 * @param {object} layer
 * @param {object} settings properties an action wants to change
 * @returns {boolean} true when the layer is locked and the change would touch something protected
 */
export function blocks_update(layer, settings) {
	if (!layer || layer.locked !== true || !settings) {
		return false;
	}
	return Object.keys(settings).some(function (key) {
		return LOCKED_PROPERTIES.indexOf(key) >= 0;
	});
}
