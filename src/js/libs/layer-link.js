/**
 * Linked layers (Photoshop): layers with the same `link_id` move together with the active one.
 * Pure functions - they only say which layers should get which link_id.
 *
 * @typedef {{id: number, link_id?: number|null}} Linkable
 * @typedef {{id: number, link_id: number|null}} Link_change
 */

/**
 * @param {Linkable[]} layers
 * @returns {number} a link id nobody uses yet
 */
export function next_link_id(layers) {
	let max = 0;
	layers.forEach((layer) => {
		if (layer.link_id > max) {
			max = layer.link_id;
		}
	});
	return max + 1;
}

/**
 * @param {Linkable[]} layers all layers
 * @param {Linkable} layer
 * @returns {Linkable[]} the other layers linked with the layer
 */
export function linked_with(layers, layer) {
	if (!layer || layer.link_id == null) {
		return [];
	}
	return layers.filter((other) => {
		return other.id != layer.id && other.link_id === layer.link_id;
	});
}

/**
 * Changes between the current state and the wanted one. A group of one layer is no group, so it is removed.
 *
 * @param {Linkable[]} layers
 * @param {Object<number, number|null>} wanted link ids by layer id (layers that are not mentioned stay as they are)
 * @returns {Link_change[]}
 */
function diff_links(layers, wanted) {
	const next = {};
	layers.forEach((layer) => {
		next[layer.id] = wanted[layer.id] !== undefined ? wanted[layer.id] : (layer.link_id == null ? null : layer.link_id);
	});
	const counts = {};
	Object.keys(next).forEach((id) => {
		if (next[id] != null) {
			counts[next[id]] = (counts[next[id]] || 0) + 1;
		}
	});
	const changes = [];
	layers.forEach((layer) => {
		let value = next[layer.id];
		if (value != null && counts[value] < 2) {
			value = null;
		}
		const before = layer.link_id == null ? null : layer.link_id;
		if (value !== before) {
			changes.push({id: layer.id, link_id: value});
		}
	});
	return changes;
}

/**
 * The active layer and the chosen layers become one group (layers of the active group that are not chosen leave it).
 *
 * @param {Linkable[]} layers
 * @param {Linkable} active
 * @param {number[]} chosen ids of the other layers that should be linked with the active one
 * @returns {Link_change[]}
 */
export function link_changes(layers, active, chosen) {
	const group = active.link_id == null ? next_link_id(layers) : active.link_id;
	const wanted = {};
	layers.forEach((layer) => {
		if (layer.link_id === group && layer.id != active.id) {
			wanted[layer.id] = null;
		}
	});
	wanted[active.id] = group;
	chosen.forEach((id) => {
		wanted[id] = group;
	});
	return diff_links(layers, wanted);
}

/**
 * Shift+click on a layer: links it with the active layer, or removes it from the group when it is already there
 *
 * @param {Linkable[]} layers
 * @param {Linkable} active
 * @param {number} target_id
 * @returns {Link_change[]}
 */
export function toggle_link_changes(layers, active, target_id) {
	if (active.id == target_id) {
		return [];
	}
	const target = layers.find((layer) => { return layer.id == target_id; });
	if (!target) {
		return [];
	}
	const chosen = linked_with(layers, active).map((layer) => { return layer.id; });
	const index = chosen.indexOf(target_id);
	if (index >= 0) {
		chosen.splice(index, 1);
	}
	else {
		chosen.push(target_id);
	}
	return link_changes(layers, active, chosen);
}

/**
 * @param {Linkable[]} layers
 * @param {Linkable} layer
 * @returns {Link_change[]} the layer leaves its group
 */
export function unlink_changes(layers, layer) {
	const wanted = {};
	wanted[layer.id] = null;
	return diff_links(layers, wanted);
}

/**
 * @typedef {{x: number, y: number, width: number, height: number, rotate?: number|null}} Layer_frame
 */

/**
 * Where a linked layer goes when the active layer is resized and / or turned: the whole group is transformed as one,
 * so the layer keeps its place relative to the active layer (position and distance scale, the turn is around the
 * center of the active layer).
 *
 * @param {Layer_frame} from the active layer before
 * @param {Layer_frame} to the active layer after
 * @param {Layer_frame} follower the linked layer before
 * @returns {{x: number, y: number, width: number, height: number, rotate: number}} the linked layer after
 */
export function follow_transform(from, to, follower) {
	const before = from.rotate || 0;
	const after = to.rotate || 0;
	const scale_x = from.width > 0 && to.width > 0 ? to.width / from.width : 1;
	const scale_y = from.height > 0 && to.height > 0 ? to.height / from.height : 1;

	const turn = function (x, y, degrees) {
		const radians = degrees * Math.PI / 180;
		return {x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians)};
	};

	//the center of the linked layer in the frame of the active layer, scaled, and back to the picture
	const from_center = {x: from.x + from.width / 2, y: from.y + from.height / 2};
	const to_center = {x: to.x + to.width / 2, y: to.y + to.height / 2};
	const local = turn(follower.x + follower.width / 2 - from_center.x, follower.y + follower.height / 2 - from_center.y, -before);
	const moved = turn(local.x * scale_x, local.y * scale_y, after);
	const center = {x: to_center.x + moved.x, y: to_center.y + moved.y};

	//size: along the axes of the active layer when the layer is turned the same way (or a quarter turn away), else evenly
	const own = follower.rotate || 0;
	const difference = (((own - before) % 180) + 180) % 180;
	let width = follower.width;
	let height = follower.height;
	if (difference < 1 || difference > 179) {
		width *= scale_x;
		height *= scale_y;
	}
	else if (Math.abs(difference - 90) < 1) {
		width *= scale_y;
		height *= scale_x;
	}
	else {
		const even = Math.sqrt(scale_x * scale_y);
		width *= even;
		height *= even;
	}
	width = Math.max(1, Math.round(width));
	height = Math.max(1, Math.round(height));

	return {
		x: Math.round(center.x - width / 2),
		y: Math.round(center.y - height / 2),
		width,
		height,
		rotate: ((Math.round(own + after - before) % 360) + 360) % 360,
	};
}
