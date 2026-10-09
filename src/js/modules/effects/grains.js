import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_grains_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
	}

	grains() {

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const settings = {
			title: 'Grains',
			preview: true,
			effects: true,
			params: [
				{name: "level", title: "Level:", value: "30", range: [0, 50]},
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
		if (params.level == 0)
			return data;
		const imgData = data.data;

		const H = data.height;
		const W = data.width;

		for (let j = 0; j < H; j++) {
			for (let i = 0; i < W; i++) {
				const x = (i + j * W) * 4;
				if (imgData[x + 3] == 0)
					continue;	//transparent
				//increase it's lightness
				const delta = this.Helper.getRandomInt(0, params.level);
				if (delta == 0)
					continue;

				if (imgData[x] - delta < 0)
					imgData[x] = -(imgData[x] - delta);
				else
					imgData[x] = imgData[x] - delta;
				if (imgData[x + 1] - delta < 0)
					imgData[x + 1] = -(imgData[x + 1] - delta);
				else
					imgData[x + 1] = imgData[x + 1] - delta;
				if (imgData[x + 2] - delta < 0)
					imgData[x + 2] = -(imgData[x + 2] - delta);
				else
					imgData[x + 2] = imgData[x + 2] - delta;
			}
		}

		return data;
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(canvas_thumb, 0, 0);

		//now update
		const img = ctx.getImageData(0, 0, canvas_thumb.width, canvas_thumb.height);
		const params = {
			level: 30,
		}
		const data = this.change(img, params);
		ctx.putImageData(data, 0, 0);
	}

}

export default Effects_grains_class;
