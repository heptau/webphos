import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { WARP_STYLES, warp_settings } from './../../libs/text-warp.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Warp Text - bends the text of the active text layer (arc, bulge, flag, wave, rise, squeeze).
 * The text stays editable, the bend is part of the layer.
 */
class Layer_warp_text_class {

	warp_text() {
		var layer = config.layer;
		if (layer == null || layer.type != 'text') {
			alertify.error(t('Warp Text works only on a text layer.'));
			return;
		}
		var initial = warp_settings(layer.params);
		var original = {warp_style: layer.params.warp_style, warp_bend: layer.params.warp_bend};
		var restore = () => {
			layer.params.warp_style = original.warp_style;
			layer.params.warp_bend = original.warp_bend;
			config.need_render = true;
		};

		new Dialog_class().show({
			title: 'Warp Text',
			params: [
				{name: "style", title: "Style:", values: WARP_STYLES, value: initial.style},
				{name: "bend", title: "Bend:", value: initial.bend, range: [-100, 100]},
			],
			//the text bends while the dialog is open
			on_change: (params) => {
				layer.params.warp_style = params.style;
				layer.params.warp_bend = parseFloat(params.bend) || 0;
				config.need_render = true;
			},
			on_finish: (params) => {
				restore();
				var next = Object.assign({}, layer.params, {warp_style: params.style, warp_bend: parseFloat(params.bend) || 0});
				return app.State.do_action(
					new app.Actions.Bundle_action('warp_text', 'Warp Text', [
						new app.Actions.Update_layer_action(layer.id, {params: next}),
					])
				);
			},
			on_cancel: restore,
		});
	}
}

export default Layer_warp_text_class;
