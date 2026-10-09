import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

let instance = null;

class Image_autoAdjust_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();

		this.set_events();
	}

	set_events() {
	}

	auto_adjust() {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(null, true);
		const ctx = canvas.getContext("2d");

		//change data
		const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = this.get_adjust_data(img);
		ctx.putImageData(data, 0, 0);

		//save
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas)
		);
	}

	get_adjust_data(data) {
		//settings
		let i, j, c, x;
		const white = 240;	//white color min
		const black = 30;		//black color max
		const target_white = 1; 	//how much % white colors should take
		const target_black = 0.5;	//how much % black colors should take
		const modify = 1.1;	//color modify strength
		const cycles_count = 10; //how much iteration to change colors

		const imgData = data.data;

		let n = 0;	//pixels count without transparent

		//make sure we have white
		let n_valid = 0;
		for (i = 0; i < imgData.length; i += 4) {
			if (imgData[i + 3] == 0)
				continue;	//transparent
			if ((imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3 > white)
				n_valid++;
			n++;
		}
		let target = target_white;
		let done = false;
		for (j = 0; j < cycles_count; j++) {
			if (n_valid * 100 / n >= target)
				done = true;
			if (done == true)
				break;

			//adjust
			for (i = 0; i < imgData.length; i += 4) {
				if (imgData[i + 3] == 0)
					continue;	//transparent
				for (c = 0; c < 3; c++) {
					x = i + c;
					if (imgData[x] < 10)
						continue;
					//increase white
					imgData[x] *= modify;
					imgData[x] = Math.round(imgData[x]);
					if (imgData[x] > 255)
						imgData[x] = 255;
				}
			}

			//recheck
			n_valid = 0;
			for (i = 0; i < imgData.length; i += 4) {
				if (imgData[i + 3] == 0)
					continue;	//transparent
				if ((imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3 > white)
					n_valid++;
			}
		}

		//make sure we have black
		n_valid = 0;
		for (i = 0; i < imgData.length; i += 4) {
			if (imgData[i + 3] == 0)
				continue;	//transparent
			if ((imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3 < black)
				n_valid++;
		}
		target = target_black;
		done = false;
		for (j = 0; j < cycles_count; j++) {
			if (n_valid * 100 / n >= target)
				done = true;
			if (done == true)
				break;

			//adjust
			for (i = 0; i < imgData.length; i += 4) {
				if (imgData[i + 3] == 0)
					continue;	//transparent
				for (c = 0; c < 3; c++) {
					x = i + c;
					if (imgData[x] > 240)
						continue;
					//increase black
					imgData[x] -= (255 - imgData[x]) * modify - (255 - imgData[x]);
					imgData[x] = Math.round(imgData[x]);
				}
			}

			//recheck
			n_valid = 0;
			for (i = 0; i < imgData.length; i += 4) {
				if (imgData[i + 3] == 0)
					continue;	//transparent
				if ((imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3 < black)
					n_valid++;
			}
		}
		//log('Iterations: brighten='+n_fix_white+", darken="+n_fix_black);

		return data;
	}
}

export default Image_autoAdjust_class;
