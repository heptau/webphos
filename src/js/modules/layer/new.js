import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import GUI_tools_class from './../../core/gui/gui-tools.js';
import Base_selection_class from './../../core/base-selection.js';
import Selection_class from './../../tools/selection.js';
import Edit_selection_class from './../edit/selection.js';
import { erase_with_mask } from './../../libs/selection-mask.js';
import Helper_class from './../../libs/helpers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Layer_new_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.Selection = new Selection_class();
		this.Base_selection = new Base_selection_class(this.Base_layers.ctx);
		this.GUI_tools = new GUI_tools_class();
		this.Helper = new Helper_class();
		this.Edit_selection = null; //created on first use

		this.set_events();
	}

	set_events() {
		document.addEventListener('keydown', (event) => {
			var code = event.keyCode;
			if (this.Helper.is_input(event.target))
				return;

			if (code == 78 && event.ctrlKey != true && event.metaKey != true) {
				//N
				this.new();
			}
		}, false);
	}

	new() {
		app.State.do_action(
			new app.Actions.Insert_layer_action()
		);
	}

	/**
	 * New layer from the selection (also from non rectangular masks)
	 *
	 * @param {string|null} [mode] 'merged' takes the pixels from all visible layers instead of the active layer,
	 *   'cut' also removes the selected pixels from the active layer (Layer via Cut)
	 */
	new_selection(mode) {
		var merged = mode === 'merged';
		var cut = mode === 'cut';
		var layer = config.layer;
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		var part = (merged || layer.type == 'image') ? this.Edit_selection.get_selection_canvas(layer, merged) : null;
		if (part == null) {
			alertify.error(t('Empty selection or type not image.'));
			return;
		}

		var params = {
			x: part.x,
			y: part.y,
			width: part.width,
			height: part.height,
			width_original: part.width_original,
			height_original: part.height_original,
			type: 'image',
			data: part.canvas.toDataURL("image/png"),
		};
		if (merged) {
			params.name = t('Merged');
		}
		var actions = [];
		if (cut) {
			//remove the selected pixels from the source layer
			var canvas = this.Base_layers.convert_layer_to_canvas(layer.id, true);
			var ctx = canvas.getContext('2d');
			var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
			ctx.putImageData(erase_with_mask(image, this.Edit_selection.get_mask().mask, layer), 0, 0);
			actions.push(new app.Actions.Update_layer_image_action(canvas, layer.id));
		}
		actions.push(
			new app.Actions.Insert_layer_action(params, false),
			...this.Selection.on_leave(),
			new app.Actions.Activate_tool_action('select')
		);
		app.State.do_action(
			new app.Actions.Bundle_action('new_layer', cut ? 'Layer via Cut' : 'New Layer', actions)
		);
	}

}

export default Layer_new_class;