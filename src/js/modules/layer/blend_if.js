import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { is_default, range_from_settings, settings_from_range } from './../../libs/blend-if.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Blend If - the layer is shown only where its own brightness and / or the brightness of what is below it
 * is in a range (for example "only the dark parts of the layer" or "only over the bright sky"). The softness
 * makes the edge of the range fade. The change shows while the dialog is open.
 */
class Layer_blend_if_class {

	blend_if() {
		var layer = config.layer;
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		if (config.layers.length < 2) {
			alertify.warning(t('There is no layer below.'));
		}
		var original = layer.blend_if;
		var current = {
			this: settings_from_range(original ? original.this : null),
			below: settings_from_range(original ? original.below : null),
		};
		var restore = () => {
			layer.blend_if = original;
			config.need_render = true;
		};
		var build = (params) => ({
			this: range_from_settings(params.this_dark, params.this_dark_soft, params.this_light, params.this_light_soft),
			below: range_from_settings(params.below_dark, params.below_dark_soft, params.below_light, params.below_light_soft),
		});

		new Dialog_class().show({
			title: 'Blend If',
			params: [
				{heading: 'This Layer'},
				{name: "this_dark", title: "Dark from:", value: current.this.dark, range: [0, 255]},
				{name: "this_dark_soft", title: "Dark softness:", value: current.this.dark_soft, range: [0, 255]},
				{name: "this_light", title: "Light to:", value: current.this.light, range: [0, 255]},
				{name: "this_light_soft", title: "Light softness:", value: current.this.light_soft, range: [0, 255]},
				{heading: 'Underlying Layer'},
				{name: "below_dark", title: "Dark from:", value: current.below.dark, range: [0, 255]},
				{name: "below_dark_soft", title: "Dark softness:", value: current.below.dark_soft, range: [0, 255]},
				{name: "below_light", title: "Light to:", value: current.below.light, range: [0, 255]},
				{name: "below_light_soft", title: "Light softness:", value: current.below.light_soft, range: [0, 255]},
			],
			on_change: (params) => {
				layer.blend_if = build(params);
				config.need_render = true;
			},
			on_finish: (params) => {
				restore();
				var next = build(params);
				return app.State.do_action(
					new app.Actions.Bundle_action('blend_if', 'Blend If', [
						new app.Actions.Update_layer_action(layer.id, {blend_if: is_default(next) ? null : next}),
					])
				);
			},
			on_cancel: restore,
		});
	}
}

export default Layer_blend_if_class;
