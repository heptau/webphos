/**
 * Auto-select of the Move tool: pressing the mouse picks the layer under the pointer. Pure functions, no DOM.
 */

/**
 * @param {{x: number, y: number, width: number, height: number}} layer
 * @param {{x: number, y: number}} point
 * @returns {boolean} the point is in the frame of the layer (where the move cursor shows)
 */
export function inside_frame(layer, point) {
	return point.x > layer.x && point.x < layer.x + layer.width && point.y > layer.y && point.y < layer.y + layer.height;
}

/**
 * The layer a press of the mouse selects: the topmost one that has a visible pixel under the pointer. The active layer
 * counts as hit anywhere in its frame, because there the pointer shows the move cursor: a thin stroke has many
 * transparent places in its frame, and a press there must not pick the picture below it.
 *
 * @param {{id: *, x: number, y: number, width: number, height: number}[]} layers top first
 * @param {*} active_id id of the active layer
 * @param {{x: number, y: number}} point
 * @param {function(object): boolean} hit tells if a layer has a visible pixel under the pointer
 * @returns {*} id of the layer, null when nothing is there
 */
export function pick_layer(layers, active_id, point, hit) {
	for (var i = 0; i < layers.length; i++) {
		var layer = layers[i];
		if ((layer.id == active_id && inside_frame(layer, point)) || hit(layer)) {
			return layer.id;
		}
	}
	return null;
}
