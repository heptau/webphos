import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Edit_selection_class from './../edit/selection.js';
import { ADJUSTMENTS, is_adjustment, default_settings, clean_settings } from './../../libs/adjustment-layers.js';
import { layer_mask_from_selection, serialize_layer_mask } from './../../libs/layer-mask.js';
import { build_curve_editor } from './../image/curve_editor.js';
import { t } from '../tools/translate.js';

/**
 * Layer > New Adjustment Layer > ..., Layer > Edit Adjustment Layer (also a double click on the layer).
 * An adjustment layer changes the colors of all the layers below it and keeps its settings, so it can be edited,
 * hidden or deleted at any time. With a selection the layer starts with a layer mask made from it.
 */
class Layer_adjustment_class {

	/**
	 * @param {string} key one of the adjustments of libs/adjustment-layers.js
	 */
	async new(key) {
		if (!is_adjustment(key)) {
			return;
		}
		var definition = ADJUSTMENTS[key];
		var geometry = {x: 0, y: 0, width: config.WIDTH, height: config.HEIGHT};
		var settings = Object.assign({
			name: t(definition.title),
			type: 'adjustment',
			width_original: config.WIDTH,
			height_original: config.HEIGHT,
			rotate: 0,
			is_vector: true,
			render_function: ['adjustment', 'render'],
			params: {adjustment: key, settings: default_settings(key)},
		}, geometry);

		var actions = [new app.Actions.Insert_layer_action(settings, false)];
		var selection = new Edit_selection_class().get_mask();
		if (selection != null) {
			//the new layer gets the next free id
			actions.push(new app.Actions.Update_layer_action(app.Layers.auto_increment, {
				mask: serialize_layer_mask(layer_mask_from_selection(selection.mask, geometry)),
				mask_enabled: true,
			}));
		}
		await app.State.do_action(new app.Actions.Bundle_action('new_adjustment_layer', 'New Adjustment Layer', actions));
		if (definition.params.length > 0) {
			this.open_dialog(config.layer, true);
		}
	}

	edit() {
		var layer = config.layer;
		if (layer == null || layer.type != 'adjustment' || !is_adjustment(layer.params && layer.params.adjustment)) {
			alertify.warning(t('Select an adjustment layer first.'));
			return;
		}
		this.open_dialog(layer, false);
	}

	/**
	 * The dialog changes the layer while it is open (so the picture shows the result); Cancel puts everything back,
	 * and for a layer that was just made it also takes the layer away.
	 */
	open_dialog(layer, is_new) {
		var key = layer.params.adjustment;
		var definition = ADJUSTMENTS[key];
		var original = layer.params;
		var current = clean_settings(key, original.settings);
		//settings that have their own editor (the curves graph) are edited in place and added to the dialog values
		var state = definition.state;
		var state_value = state ? JSON.parse(JSON.stringify(current[state.name])) : null;
		var build = (values) => clean_settings(key, state ? Object.assign({}, values, {[state.name]: state_value}) : values);

		new Dialog_class().show({
			title: definition.title,
			params: definition.params.map((param) => (param.name ? Object.assign({}, param, {value: current[param.name]}) : param)),
			on_load: state ? (values, popup) => build_curve_editor(popup, state_value) : undefined,
			on_change: (values) => {
				layer.params = Object.assign({}, original, {settings: build(values)});
				config.need_render = true;
			},
			on_finish: (values) => {
				layer.params = original;
				var next = Object.assign({}, original, {settings: build(values)});
				return app.State.do_action(
					new app.Actions.Bundle_action('edit_adjustment_layer', 'Edit Adjustment Layer', [
						new app.Actions.Update_layer_action(layer.id, {params: next}),
					]),
					{merge_with_history: is_new ? 'new_adjustment_layer' : undefined}
				);
			},
			on_cancel: () => {
				layer.params = original;
				config.need_render = true;
				if (is_new) {
					app.State.undo();
				}
			},
		});
	}
}

export default Layer_adjustment_class;
