import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import Vintage_class from './../../libs/vintage.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_vintage_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Vintage = new Vintage_class(config.WIDTH, config.HEIGHT);
	}

	vintage() {

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		this.Vintage.reset_random_values(config.WIDTH, config.HEIGHT);

		const settings = {
			title: 'Vintage',
			preview: true,
			effects: true,
			params: [
				{name: "level", title: "Level:", value: 50, range: [0, 100]},
			],
			on_change: (params, canvas_preview, w, h, canvas_) => {
				this.change(canvas_, params);
			},
			on_finish: (params) => {
				this.save(params);
			},
		};
		this.POP.show(settings);
	}

	save(params) {
		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(null, true);

		//change data
		this.change(canvas, params);

		//save
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas)
		);
	}

	change(canvas, params) {
		const level = parseInt(params.level);

		this.Vintage.apply_all(canvas, level);
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(canvas_thumb, 0, 0);

		//now update
		const params = {
			level: 50,
		};
		this.change(canvas, params);
	}

}

export default Effects_vintage_class;
