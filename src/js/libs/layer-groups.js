/**
 * Layer groups. A group is a name stored in layer.group, layers with the same name belong together.
 * It does not change how the layers are rendered; it lets you show/hide or merge the whole group at once.
 */

/**
 * @param {{group?: string|null}[]} layers
 * @returns {string[]} names of all groups in the order of their first appearance
 */
export function group_names(layers) {
	const names = [];
	layers.forEach((layer) => {
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
	return layers.filter((layer) => {
		return in_group(layer, name) && layer.type != null;
	});
}

/**
 * @param {{group?: string|null}} layer
 * @param {string} name path of a group ('A' or 'A/B')
 * @returns {boolean} the layer is in the group or in a group inside of it
 */
export function in_group(layer, name) {
	return typeof layer.group === 'string' && (layer.group === name || layer.group.indexOf(`${name  }/`) === 0);
}

/**
 * @param {string|null|undefined} group path of the group of a layer
 * @returns {string[]} the group and the groups around it, outermost first ('A/B' -> ['A', 'A/B'])
 */
export function group_ancestors(group) {
	if (typeof group !== 'string' || group === '') {
		return [];
	}
	const parts = group.split('/');
	return parts.map((part, index) => { return parts.slice(0, index + 1).join('/'); });
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
	const members = layers_in_group(layers, name);
	const any_visible = members.some((layer) => { return layer.visible !== false; });
	const target = !any_visible;
	return {
		ids: members.filter((layer) => { return (layer.visible !== false) !== target; }).map((layer) => { return layer.id; }),
		visible: target,
	};
}

/**
 * Sanitizes a group name typed by the user. A slash makes a group inside of a group ('Faces/Eyes').
 *
 * @param {*} name
 * @returns {string} segments trimmed (at most 60 letters each, at most 5 levels), '' for anything unusable
 */
export function clean_group_name(name) {
	if (typeof name !== 'string') {
		return '';
	}
	return name.replace(/[\r\n\t]+/g, ' ').split('/').map((part) => { return part.trim().slice(0, 60); })
		.filter((part) => { return part !== ''; }).slice(0, 5).join('/');
}

/**
 * @typedef {{opacity: number, composition: string, mask: object|null}} Group_props `mask` is a stored layer mask (libs/layer-mask.js) in the pixels of the document
 */

/**
 * The opacity and the blend mode of a group, as they are stored on a layer of the group (`layer.group_props`, a map
 * from the path of a group to its properties; layers made before it only know `group_opacity` of their own group)
 *
 * @param {{group?: string|null, group_opacity?: number|null, group_props?: Object<string, any>|null}} layer a layer of the group
 * @param {string} name path of the group
 * @returns {Group_props}
 */
export function group_props_of(layer, name) {
	const stored = layer && layer.group_props && typeof layer.group_props === 'object' ? layer.group_props[name] : null;
	let opacity = 100;
	let composition = 'source-over';
	let mask = null;
	if (stored && typeof stored === 'object') {
		const candidate = stored.mask;
		if (candidate && typeof candidate === 'object' && candidate.width > 0 && candidate.height > 0
			&& Array.isArray(candidate.values) && Array.isArray(candidate.counts)) {
			mask = candidate;
		}
		const value = parseFloat(String(stored.opacity));
		opacity = isNaN(value) ? 100 : Math.min(100, Math.max(0, value));
		composition = typeof stored.composition === 'string' && /^[a-z-]{1,20}$/.test(stored.composition) ? stored.composition : 'source-over';
	}
	else if (layer && layer.group === name && layer.group_opacity !== undefined && layer.group_opacity !== null) {
		const old = parseFloat(String(layer.group_opacity));
		opacity = isNaN(old) ? 100 : Math.min(100, Math.max(0, old));
	}
	return {opacity, composition, mask};
}

/**
 * A group that is drawn on its own and then put on the picture with its opacity, blend mode and mask. A group with the
 * default properties is not (its layers are just drawn in their places, as Photoshop does with Pass Through).
 *
 * @param {Group_props} props
 * @returns {boolean}
 */
export function is_isolated(props) {
	return props.opacity < 100 || props.composition !== 'source-over' || props.mask != null;
}

/**
 * What a layer is drawn with: its own opacity (the opacity of its groups is applied when the group is put together)
 *
 * @param {{opacity?: number}} layer
 * @returns {number} 0-1, for `ctx.globalAlpha`
 */
export function effective_alpha(layer) {
	const own = layer.opacity === undefined || layer.opacity === null ? 100 : layer.opacity;
	return own / 100;
}

/**
 * @typedef {{kind: 'group', name: string, props: Group_props, entries: any[]}} Group_entry
 */

/**
 * The layers (top first) the way they are drawn: a group that has to be drawn on its own is one entry at the place of
 * its topmost layer, with the plan of its layers inside; all the other layers stay as they are.
 *
 * @template {{group?: string|null}} T
 * @param {T[]} layers top first
 * @param {number} [depth] how many of the outer groups of a layer are already taken care of
 * @returns {(T|Group_entry)[]}
 */
export function plan_groups(layers, depth) {
	const start = depth || 0;
	const result = [];
	/** @type {Object<string, Group_entry & {members: T[]}>} */
	const nodes = {};
	layers.forEach((layer) => {
		const chain = group_ancestors(layer.group).slice(start);
		let outer = null;
		for (let i = 0; i < chain.length; i++) {
			const props = group_props_of(layer, chain[i]);
			if (is_isolated(props)) {
				outer = {name: chain[i], props, level: start + i + 1};
				break;
			}
		}
		if (outer == null) {
			result.push(layer);
			return;
		}
		if (!nodes[outer.name]) {
			nodes[outer.name] = {kind: 'group', name: outer.name, props: outer.props, entries: [], members: []};
			result.push(nodes[outer.name]);
		}
		nodes[outer.name].members.push(layer);
		nodes[outer.name].level = outer.level;
	});
	Object.keys(nodes).forEach((name) => {
		nodes[name].entries = plan_groups(nodes[name].members, nodes[name].level);
		delete nodes[name].members;
		delete nodes[name].level;
	});
	return result;
}

/**
 * The rows of the layer list, top to bottom: a group gets a header row in front of its first layer (the layers of a
 * group are listed together, groups inside a group are indented), and the layers of a folded group are left out.
 *
 * @template {{group?: string|null}} T
 * @param {T[]} layers in the order of the panel (top first)
 * @param {string[]} collapsed paths of the groups that are folded
 * @returns {({kind: 'header', group: string, label: string, depth: number, members: T[], collapsed: boolean}|{kind: 'layer', layer: T, depth: number})[]}
 */
export function panel_rows(layers, collapsed) {
	const rows = [];
	const seen = {};
	//the layers of a group are listed together, at the place of its first layer
	const ordered = [];
	const placed = [];
	layers.forEach((layer) => {
		if (placed.indexOf(layer) >= 0) {
			return;
		}
		const top = group_ancestors(layer.group)[0];
		if (top === undefined) {
			ordered.push(layer);
			placed.push(layer);
			return;
		}
		layers.forEach((other) => {
			if (placed.indexOf(other) < 0 && in_group(other, top)) {
				ordered.push(other);
				placed.push(other);
			}
		});
	});
	ordered.forEach((layer) => {
		const chain = group_ancestors(layer.group);
		let hidden = false;
		chain.forEach((name, index) => {
			if (hidden) {
				return;
			}
			const folded = collapsed.indexOf(name) >= 0;
			if (!seen[name]) {
				seen[name] = true;
				rows.push({
					kind: 'header',
					group: name,
					label: name.split('/').pop(),
					depth: index,
					members: layers.filter((other) => { return in_group(other, name); }),
					collapsed: folded,
				});
			}
			if (folded) {
				hidden = true;
			}
		});
		if (!hidden) {
			rows.push({kind: 'layer', layer, depth: chain.length});
		}
	});
	return rows;
}

/**
 * The groups a layer goes into when it joins a group: the properties (opacity, blend mode) of the group and of the
 * groups around it, taken from a layer that is in them already. A group nobody is in yet starts with the defaults.
 *
 * @param {{id: *, group?: string|null, group_opacity?: number|null, group_props?: Object<string, any>|null}[]} layers
 * @param {*} layer_id the layer that joins (its old groups do not count)
 * @param {string} name path of the group it joins
 * @returns {Object<string, Group_props>|null} null when everything is default
 */
export function props_for_join(layers, layer_id, name) {
	/** @type {Object<string, Group_props>} */
	const map = {};
	group_ancestors(name).forEach((path) => {
		const member = layers.find((item) => { return item.id != layer_id && in_group(item, path); });
		if (member) {
			const props = group_props_of(member, path);
			if (is_isolated(props)) {
				map[path] = props;
			}
		}
	});
	return Object.keys(map).length > 0 ? map : null;
}

/**
 * New `group_props` of a layer when the properties of one of its groups change
 *
 * @param {{group_props?: Object<string, any>|null}} layer
 * @param {string} name path of the group
 * @param {Group_props} props
 * @returns {Object<string, Group_props>|null} null when everything is default again
 */
export function with_group_props(layer, name, props) {
	/** @type {Object<string, Group_props>} */
	const map = {};
	const old = layer.group_props && typeof layer.group_props === 'object' ? layer.group_props : {};
	Object.keys(old).forEach((key) => {
		if (key !== name && old[key] && typeof old[key] === 'object') {
			const other = group_props_of({group: key, group_props: old}, key);
			map[key] = {opacity: other.opacity, composition: other.composition, mask: other.mask};
		}
	});
	if (is_isolated(props)) {
		map[name] = {opacity: props.opacity, composition: props.composition, mask: props.mask || null};
	}
	return Object.keys(map).length > 0 ? map : null;
}

/**
 * @typedef {{kind: 'layer', layer: any}} Nest_layer
 * @typedef {{kind: 'group', name: string, label: string, items: (Nest_layer|Nest_group)[]}} Nest_group
 */

/**
 * The layers as a tree of groups, top first: the layers of a group are together at the place of its first layer, groups
 * inside a group are inside it.
 *
 * @template {{group?: string|null}} T
 * @param {T[]} layers top first
 * @param {string} [prefix] path of the group whose layers these are ('' for the top)
 * @returns {(Nest_layer|Nest_group)[]}
 */
export function nest_layers(layers, prefix) {
	const depth = prefix ? prefix.split('/').length : 0;
	/** @type {(Nest_layer|Nest_group)[]} */
	const items = [];
	const placed = [];
	layers.forEach((layer) => {
		if (placed.indexOf(layer) >= 0) {
			return;
		}
		const inside = group_ancestors(layer.group).slice(depth);
		if (inside.length == 0) {
			placed.push(layer);
			items.push({kind: 'layer', layer});
			return;
		}
		const name = inside[0];
		const members = layers.filter((other) => { return placed.indexOf(other) < 0 && in_group(other, name); });
		members.forEach((member) => { placed.push(member); });
		items.push({kind: 'group', name, label: name.split('/').pop(), items: nest_layers(members, name)});
	});
	return items;
}
