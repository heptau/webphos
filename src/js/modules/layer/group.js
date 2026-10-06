import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import { group_names, layers_in_group, group_visibility_toggles, clean_group_name } from './../../libs/layer-groups.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Group - layers with the same group name belong together (layer.group, see libs/layer-groups.js).
 * Groups do not change how layers are rendered; the whole group can be shown/hidden or merged at once.
 */
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
				this.update(layer.id, {group: name}, 'Set Group');
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
		return this.update(layer.id, {group: null}, 'Clear Group');
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
		var toggles = group_visibility_toggles(config.layers, layer.group);
		if (toggles.ids.length == 0) {
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('group_visibility', toggles.visible ? 'Show Group' : 'Hide Group',
				toggles.ids.map((id) => new app.Actions.Toggle_layer_visibility_action(id)))
		);
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

		var canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		var ctx = canvas.getContext('2d');
		for (var i = ordered.length - 1; i >= 0; i--) {
			var item = ordered[i];
			if (item.visible == false) {
				continue;
			}
			ctx.globalAlpha = item.opacity / 100;
			ctx.globalCompositeOperation = item.composition;
			this.Base_layers.render_object(ctx, item);
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';

		var actions = [
			new app.Actions.Insert_layer_action({
				type: 'image',
				name: name,
				data: canvas.toDataURL('image/png'),
				x: 0,
				y: 0,
				width: canvas.width,
				height: canvas.height,
			}),
		];
		ordered.forEach((item) => {
			actions.push(new app.Actions.Delete_layer_action(item.id));
		});
		return app.State.do_action(new app.Actions.Bundle_action('merge_group', 'Merge Group', actions));
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
