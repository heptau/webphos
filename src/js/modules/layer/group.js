import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import { group_names, layers_in_group, group_visibility_toggles, clean_group_name, group_ancestors, plan_groups, group_props_of, props_for_join, with_group_props } from './../../libs/layer-groups.js';
import Edit_selection_class from './../edit/selection.js';
import { serialize_layer_mask, layer_mask_from_selection } from './../../libs/layer-mask.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Group - layers with the same group name belong together (layer.group, see libs/layer-groups.js).
 * Groups do not change how layers are rendered; the whole group can be shown/hidden or merged at once.
 */
//blend modes a group can have (Pass Through is the default 'source-over': the layers are drawn in their places)
const GROUP_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

class Layer_group_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.Dialog = new Dialog_class();
	}

	/**
	 * Layer > Group > Set Group - puts the active layer into a group (a new one or an existing one)
	 */
	set_group() {
		var layer = config.layer;
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		var names = group_names(config.layers);
		var settings = {
			title: 'Set Group',
			params: [
				{name: "name", title: "Group name:", value: layer.group || (names.length ? names[0] : 'Group 1')},
			],
			on_finish: (params) => {
				var name = clean_group_name(params.name);
				if (name === '') {
					alertify.error(t('Name is required.'));
					return;
				}
				//the layer takes the opacity and blend mode of the groups it joins
				this.update(layer.id, {group: name, group_opacity: 100, group_props: props_for_join(config.layers, layer.id, name)}, 'Set Group');
			},
		};
		if (names.length) {
			settings.comment = t('Existing groups:') + ' ' + names.join(', ');
		}
		this.Dialog.show(settings);
	}

	/**
	 * Layer > Group > Clear Group - takes the active layer out of its group
	 */
	clear_group() {
		var layer = config.layer;
		if (layer == null || !layer.group) {
			alertify.error(t('This layer is not in a group.'));
			return;
		}
		return this.update(layer.id, {group: null, group_opacity: 100, group_props: null}, 'Clear Group');
	}

	/**
	 * Layer > Group > Show / Hide Group - toggles the visibility of all layers of the active layer's group
	 */
	toggle_visibility() {
		var layer = config.layer;
		if (layer == null || !layer.group) {
			alertify.error(t('This layer is not in a group.'));
			return;
		}
		return this.set_visibility(layer.group);
	}

	/**
	 * Shows or hides the layers of the group with this name (the eye on the group row of the layer list)
	 *
	 * @param {string} name
	 */
	set_visibility(name) {
		var toggles = group_visibility_toggles(config.layers, name);
		if (toggles.ids.length == 0) {
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('group_visibility', toggles.visible ? 'Show Group' : 'Hide Group',
				toggles.ids.map((id) => new app.Actions.Toggle_layer_visibility_action(id)))
		);
	}

	/**
	 * Layer > Group > Group Settings (also a double click on the row of a group) - the opacity and the blend mode of the
	 * whole group. A group with other settings than the default is drawn on its own and then put on the picture.
	 *
	 * @param {string} [path] path of the group, the group of the active layer when missing
	 */
	group_settings(path) {
		var name = typeof path == 'string' && path !== '' ? path : (config.layer ? config.layer.group : null);
		var members = name ? layers_in_group(config.layers, name) : [];
		if (!name || members.length == 0) {
			alertify.error(t('This layer is not in a group.'));
			return;
		}
		var current = group_props_of(members[0], name);
		var apply = (values, final) => {
			var props = {
				opacity: Math.min(100, Math.max(0, parseInt(values.opacity, 10) || 0)),
				composition: GROUP_MODES.includes(values.mode) ? values.mode : 'source-over',
				mask: current.mask,
			};
			if (final) {
				return members.map((item) => new app.Actions.Update_layer_action(item.id, {group_props: with_group_props(item, name, props)}));
			}
			members.forEach((item) => {
				item.group_props = with_group_props(item, name, props);
			});
			config.need_render = true;
		};
		var before = members.map((item) => item.group_props);
		var restore = () => {
			members.forEach((item, index) => {
				item.group_props = before[index];
			});
			config.need_render = true;
		};
		this.Dialog.show({
			title: 'Group Settings',
			params: [
				{name: "opacity", title: "Opacity:", value: current.opacity, range: [0, 100]},
				{name: "mode", title: "Blend mode:", values: GROUP_MODES, value: current.composition},
			],
			on_change: (values) => apply(values, false),
			on_finish: (values) => {
				restore();
				return app.State.do_action(new app.Actions.Bundle_action('group_settings', 'Group Settings', apply(values, true)));
			},
			on_cancel: restore,
		});
	}

	/**
	 * @param {string} [path] path of the group, the group of the active layer when missing
	 * @returns {{name: string, members: object[]}|null}
	 */
	target_group(path) {
		var name = typeof path == 'string' && path !== '' ? path : (config.layer ? config.layer.group : null);
		var members = name ? layers_in_group(config.layers, name) : [];
		if (!name || members.length == 0) {
			alertify.error(t('This layer is not in a group.'));
			return null;
		}
		return {name: name, members: members};
	}

	/**
	 * Layer > Group > Group Mask from Selection - the selected part of the picture stays visible, the rest of the
	 * group is hidden (the layers of the group are not touched)
	 *
	 * @param {string} [path]
	 */
	mask_from_selection(path) {
		var target = this.target_group(path);
		if (target == null) {
			return;
		}
		var selection = new Edit_selection_class().get_mask();
		if (selection == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		var stored = serialize_layer_mask(layer_mask_from_selection(selection.mask, {x: 0, y: 0, width: config.WIDTH, height: config.HEIGHT}));
		return this.set_group_mask(target, stored, 'Group Mask');
	}

	/**
	 * Layer > Group > Delete Group Mask
	 *
	 * @param {string} [path]
	 */
	delete_mask(path) {
		var target = this.target_group(path);
		if (target == null) {
			return;
		}
		if (group_props_of(target.members[0], target.name).mask == null) {
			alertify.error(t('This group has no mask.'));
			return;
		}
		return this.set_group_mask(target, null, 'Delete Group Mask');
	}

	set_group_mask(target, stored, label) {
		return app.State.do_action(
			new app.Actions.Bundle_action('group_mask', label,
				target.members.map((item) => {
					var props = group_props_of(item, target.name);
					return new app.Actions.Update_layer_action(item.id, {
						group_props: with_group_props(item, target.name, {opacity: props.opacity, composition: props.composition, mask: stored}),
					});
				}))
		);
	}

	/**
	 * A layer goes into a group (dropped on the row of the group in the layer list) or out of every group (path null).
	 * It takes the settings of the groups it joins.
	 *
	 * @param {[number|string, string|null]} arguments_ the id of the layer and the path of the group
	 */
	move_into_group(arguments_) {
		var layer_id = arguments_[0];
		var path = arguments_[1];
		var layer = config.layers.find((item) => item.id == layer_id);
		if (layer == null || layer.type == null || (layer.group || null) === path) {
			return;
		}
		return this.update(layer.id, {group: path, group_opacity: 100, group_props: path ? props_for_join(config.layers, layer.id, path) : null}, path ? 'Set Group' : 'Clear Group');
	}

	/**
	 * Layer > Group > Merge Group - merges the visible layers of the group into one new layer
	 */
	merge_group() {
		var layer = config.layer;
		if (layer == null || !layer.group) {
			alertify.error(t('This layer is not in a group.'));
			return;
		}
		var name = layer.group;
		var members = layers_in_group(config.layers, name);
		var ordered = this.Base_layers.get_sorted_layers().filter((item) => members.indexOf(item) >= 0);
		if (ordered.length < 2) {
			alertify.error(t('At least 2 layers are needed.'));
			return;
		}

		//the layers of the group, drawn the way they look in the picture (inner groups with their settings too)
		var canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		var ctx = canvas.getContext('2d');
		var inner = plan_groups(ordered, group_ancestors(name).length);
		var merged = this.Base_layers.create_new_canvas(ctx);
		this.Base_layers.render_objects_flat(ctx, merged, inner, () => {
			ctx.save();
		}, (item) => item.visible == false || item.type == null);

		//the merged layer keeps the opacity and blend mode of the group
		var props = group_props_of(members[0], name);
		var actions = [
			new app.Actions.Insert_layer_action({
				type: 'image',
				name: name.split('/').pop(),
				data: canvas.toDataURL('image/png'),
				x: 0,
				y: 0,
				width: canvas.width,
				height: canvas.height,
				opacity: props.opacity,
				composition: props.composition,
				group: group_ancestors(name).slice(0, -1).pop() || null,
			}),
		];
		ordered.forEach((item) => {
			actions.push(new app.Actions.Delete_layer_action(item.id));
		});
		return app.State.do_action(new app.Actions.Bundle_action('merge_group', 'Merge Group', actions));
	}

	/**
	 * Fold / unfold a group in the layer list (only the list changes, nothing in the document)
	 *
	 * @param {string} name
	 */
	toggle_collapsed(name) {
		var list = config.collapsed_groups || [];
		var index = list.indexOf(name);
		if (index >= 0) {
			list.splice(index, 1);
		}
		else {
			list.push(name);
		}
		config.collapsed_groups = list;
		app.GUI.GUI_layers.render_layers();
	}

	update(layer_id, settings, name) {
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_group', name, [
				new app.Actions.Update_layer_action(layer_id, settings),
			])
		);
	}

}

export default Layer_group_class;
