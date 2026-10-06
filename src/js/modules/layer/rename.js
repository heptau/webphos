import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import { validate_layer_name } from './../../libs/input-validator.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';

class Layer_rename_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
	}

	rename(id = null) {
		var _this = this;

		var name_ = this.Helper.escapeHtml(config.layer.name);

		var settings = {
			title: 'Rename',
			params: [
				{name: "name", title: "Name:", value: name_},
			],
			on_load: function () {
				document.querySelector('#pop_data_name').select();
			},
			on_finish: function (params) {
				var validation = validate_layer_name(params.name);
				if (!validation.valid) {
					alertify.error(validation.error);
					return;
				}
				app.State.do_action(
					new app.Actions.Bundle_action('rename_layer', 'Rename Layer', [
						new app.Actions.Refresh_layers_gui_action('undo'),
						new app.Actions.Update_layer_action(id || config.layer.id, {
							name: validation.sanitized
						}),
						new app.Actions.Refresh_layers_gui_action('do')
					])
				);
			},
		};
		this.POP.show(settings);
	}
}

export default Layer_rename_class;
