import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import ImageFilters from './../../libs/imagefilters.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_boxBlur_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
	}

	box_blur() {

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const settings = {
			title: 'Box blur',
			preview: true,
			effects: true,
			params: [
				{name: "param1", title: "H Radius:", value: 3, range: [1, 20]},
				{name: "param2", title: "V Radius:", value: 3, range: [1, 20]},
				{name: "param3", title: "Quality:", value: 3, range: [1, 20]},
			],
			on_change: (params, canvas_preview, w, h) => {
				const img = canvas_preview.getImageData(0, 0, w, h);
				const data = this.change(img, params);
				canvas_preview.putImageData(data, 0, 0);
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
		const ctx = canvas.getContext("2d");

		//change data
		const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = this.change(img, params);
		ctx.putImageData(data, 0, 0);

		//save
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas)
		);
	}

	change(data, params) {
		const param1 = params.param1;
		const param2 = params.param2;
		const param3 = params.param3;

		const filtered = ImageFilters.BoxBlur(data, param1, param2, param3);

		return filtered;
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(canvas_thumb, 0, 0);

		//now update
		const img = ctx.getImageData(0, 0, canvas_thumb.width, canvas_thumb.height);
		const params = {
			param1: 20,
			param2: 1,
			param3: 1,
		}
		const data = this.change(img, params);
		ctx.putImageData(data, 0, 0);
	}

}

export default Effects_boxBlur_class;
