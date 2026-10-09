import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import ImageFilters from './../../libs/imagefilters.js';
import glfx from './../../libs/glfx.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_tiltShift_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.fx_filter = false;
	}

	tilt_shift() {

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const settings = {
			title: 'Tilt Shift',
			preview: true,
			effects: true,
			params: [
				//extra
				{name: "param7", title: "Saturation:", value: "3", range: [0, 20]},
				{name: "param8", title: "Sharpen:", value: "1", range: [0, 5]},
				//main
				{name: "param1", title: "Blur Radius:", value: 10, range: [0, 30]},
				{name: "param2", title: "Gradient Radius:", value: 70, range: [40, 100]},
				//startX, startY, endX, endY
				{name: "param3", title: "X start:", value: 0, range: [0, 100]},
				{name: "param4", title: "Y start:", value: 50, range: [0, 100]},
				{name: "param5", title: "X end:", value: 100, range: [0, 100]},
				{name: "param6", title: "Y end:", value: 50, range: [0, 100]},
			],
			on_change: (params, canvas_preview, w, h, canvas_) => {
				//recalc param by size
				this.change(canvas_, params);

				//convert % to px for line
				params.param3 = canvas_.width * params.param3 / 100;
				params.param4 = canvas_.height * params.param4 / 100;
				params.param5 = canvas_.width * params.param5 / 100;
				params.param6 = canvas_.height * params.param6 / 100;

				//draw line
				canvas_preview.beginPath();
				canvas_preview.strokeStyle = "#ff0000";
				canvas_preview.lineWidth = 1;
				canvas_preview.moveTo(params.param3 + 0.5, params.param4 + 0.5);
				canvas_preview.lineTo(params.param5 + 0.5, params.param6 + 0.5);
				canvas_preview.stroke();
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
		if (this.fx_filter == false) {
			//init glfx lib
			this.fx_filter = glfx.canvas();
		}

		let param1 = parseInt(params.param1);
		let param2 = parseInt(params.param2);
		let param3 = parseInt(params.param3);
		let param4 = parseInt(params.param4);
		let param5 = parseInt(params.param5);
		let param6 = parseInt(params.param6);
		const param7 = parseInt(params.param7);
		const param8 = parseInt(params.param8);

		//convert % to px
		param1 = canvas.height * param1 / 100;
		param2 = canvas.height * param2 / 100;
		param3 = canvas.width * param3 / 100;
		param4 = canvas.height * param4 / 100;
		param5 = canvas.width * param5 / 100;
		param6 = canvas.height * param6 / 100;

		const ctx = canvas.getContext("2d");

		//main effect
		const texture = this.fx_filter.texture(canvas);
		this.fx_filter.draw(texture).tiltShift(param3, param4, param5, param6, param1, param2).update();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(this.fx_filter, 0, 0);

		//saturation
		let data = ctx.getImageData(0, 0, canvas.width, canvas.height);
		data = ImageFilters.HSLAdjustment(data, 0, param7, 0);
		ctx.putImageData(data, 0, 0);

		//sharpen
		data = ctx.getImageData(0, 0, canvas.width, canvas.height);
		data = ImageFilters.Sharpen(data, param8);
		ctx.putImageData(data, 0, 0);
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(canvas_thumb, 0, 0);

		//now update
		const params = {
			param7: 3,
			param8: 1,
			param1: 10,
			param2: 70,
			param3: 0,
			param4: 50,
			param5: 100,
			param6: 50,
		}
		this.change(canvas, params);
	}

}

export default Effects_tiltShift_class;
