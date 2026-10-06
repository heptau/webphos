import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';

export const LABELS = ['None', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray'];

/**
 * Layer > Color Label - colors help to find layers in a long list
 */
class Layer_label_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	label() {
		var current = config.layer.color_label;
		var value = LABELS.find((name) => name.toLowerCase() == current) || 'None';
		this.POP.show({
			title: 'Color Label',
			params: [
				{name: 'label', title: 'Color:', type: 'select', values: LABELS, value: value},
			],
			on_finish: (params) => {
				var label = params.label == 'None' ? null : String(params.label).toLowerCase();
				app.State.do_action(
					new app.Actions.Bundle_action('layer_label', 'Layer Color Label', [
						new app.Actions.Update_layer_action(config.layer.id, {color_label: label}),
					])
				);
			},
		});
	}
}

export default Layer_label_class;
