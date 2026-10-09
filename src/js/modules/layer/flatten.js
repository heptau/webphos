import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';

class Layer_flatten_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
	}

	flatten() {
		//create tmp canvas
		const canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		const ctx = canvas.getContext("2d");

		//paint layers the same way the canvas is drawn: clipping masks, Blend If and adjustment layers count
		this.Base_layers.convert_layers_to_canvas(ctx, null, false);

		//create requested layer
		const params = [];
		params.type = 'image';
		params.name = 'Merged';
		params.data = canvas.toDataURL("image/png");

		//remove rest of layers
		const delete_actions = [];
		for (let i = config.layers.length - 1; i >= 0; i--) {
			delete_actions.push(new app.Actions.Delete_layer_action(config.layers[i].id));
		}
		// Run actions
		app.State.do_action(
			new app.Actions.Bundle_action('flatten_image', 'Flatten Image', [
				new app.Actions.Insert_layer_action(params),
				...delete_actions
			])
		);

		canvas.width = 1;
		canvas.height = 1;
	}

}

export default Layer_flatten_class;
