import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';

class Layer_raster_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
	}

	raster() {
		if (config.layer.type == 'adjustment') {
			return; //it has no picture of its own
		}
		if (config.layer.type == null) {
			return this.raster_empty();
		}
		const canvas = this.Base_layers.convert_layer_to_canvas();
		const current_layer = config.layer;
		const current_id = current_layer.id;

		//show
		const params = {
			type: 'image',
			name: `${config.layer.name  } + raster`,
			data: canvas.toDataURL("image/png"),
			x: parseInt(canvas.dataset.x),
			y: parseInt(canvas.dataset.y),
			width: canvas.width,
			height: canvas.height,
			opacity: current_layer.opacity,
		};
		return app.State.do_action(
			new app.Actions.Bundle_action('convert_to_raster', 'Convert to Raster', [
				new app.Actions.Insert_layer_action(params, false),
				new app.Actions.Delete_layer_action(current_id)
			])
		);
	}

	/**
	 * The empty first layer has no type yet. Most tools need pixels, so it becomes a transparent picture of the size of
	 * the document.
	 */
	raster_empty() {
		return app.State.do_action(new app.Actions.Bundle_action('convert_to_raster', 'Convert to Raster', this.empty_actions()));
	}

	/**
	 * The actions that make the empty active layer a transparent picture (for a history step of their own or together
	 * with the choice of a tool, so one Undo takes back both)
	 *
	 * @returns {object[]}
	 */
	empty_actions() {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, config.WIDTH);
		canvas.height = Math.max(1, config.HEIGHT);
		const params = {
			type: 'image',
			data: canvas.toDataURL('image/png'),
			x: 0,
			y: 0,
			width: canvas.width,
			height: canvas.height,
		};
		const actions = [new app.Actions.Insert_layer_action(params, false)];
		//the only layer of the document, when empty, is replaced by a new one by itself (Insert_layer_action); an empty
		//layer among others has to be removed
		if (config.layers.length > 1) {
			actions.push(new app.Actions.Delete_layer_action(config.layer.id));
		}
		return actions;
	}

}

export default Layer_raster_class;
