import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import { apply_name_pattern } from './../../libs/layer-names.js';

/**
 * Layer > Rename All - names of all layers from a pattern ("Layer {n}"), from the top layer down
 */
class Layer_rename_all_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	rename_all() {
		this.POP.show({
			title: 'Rename All Layers',
			params: [
				{name: "pattern", title: "Name:", value: "Layer {n}"},
				{name: "start", title: "First number:", value: 1},
				{html: '<span class="field_comment">{n} {nn} {name} {type}</span>'},
			],
			on_finish: (params) => {
				const layers = config.layers.slice().sort((a, b) => b.order - a.order);
				const actions = [new app.Actions.Refresh_layers_gui_action('undo')].concat(layers.map((layer, index) => new app.Actions.Update_layer_action(layer.id, {
					name: apply_name_pattern(params.pattern, layer, index, params.start),
				})));
				actions.push(new app.Actions.Refresh_layers_gui_action('do'));
				app.State.do_action(new app.Actions.Bundle_action('rename_all', 'Rename Layer', actions));
			},
		});
	}
}

export default Layer_rename_all_class;
