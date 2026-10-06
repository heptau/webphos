import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import Edit_selection_class from './../edit/selection.js';
import { has_modifier } from './../../libs/shortcuts.js';

var instance = null;

class Layer_duplicate_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.Edit_selection = null; //created on first use

		this.set_events();
	}

	set_events() {
		document.addEventListener('keydown', (event) => {
			var code = event.keyCode;
			if (this.Helper.is_input(event.target))
				return;

			if (code == 68 && has_modifier(event) == false) {
				//D - duplicate
				this.duplicate();
				event.preventDefault();
			}
		}, false);
	}

	/**
	 * Layer via Copy (Ctrl+J) - copy selection to new layer, or duplicate layer if nothing is selected
	 */
	via_copy() {
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		if (config.layer.type == 'image' && this.Edit_selection.has_selection()) {
			return app.GUI.run_target('layer/new.new_selection');
		}
		return this.duplicate();
	}

	duplicate() {
		var params = JSON.parse(JSON.stringify(config.layer));
		delete params.id;
		delete params.order;

		//generate name
		var name_number = params.name.match(/^(.*) #([0-9]+)$/);
		if(name_number == null){
			//first duplicate
			params.name = params.name + " #2";
		}
		else{
			//nth duplicate - name like "query #17"
			params.name = name_number[1] + " #" + (parseInt(name_number[2]) + 1)
		}

		if(params.x != 0 || params.y != 0 || params.width != config.WIDTH || params.height != config.HEIGHT){
			params.x += 10;
			params.y += 10;
		}

		for (var i in params) {
			//remove private attributes
			if (i[0] == '_')
				delete params[i];
		}

		if (params.type == 'image') {
			//image
			params.link = config.layer.link.cloneNode(true);
		}

		app.State.do_action(
			new app.Actions.Bundle_action('duplicate_layer', 'Duplicate Layer', [
				new app.Actions.Insert_layer_action(params)
			])
		);
	}

}

export default Layer_duplicate_class;