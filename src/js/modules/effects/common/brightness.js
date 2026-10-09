import Effects_common_class from '../abstract/css.js';
import Base_layers_class from './../../../core/base-layers.js';
import config from "../../../config";
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

class Effects_brightness_class extends Effects_common_class {

	constructor() {
		super();
		this.Base_layers = new Base_layers_class();
	}

	brightness(filter_id) {
		if (config.layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		const filter = this.Base_layers.find_filter_by_id(filter_id, 'brightness');

		const params = [
			{name: "value", title: "Percentage:", value: filter.value ??= 50, range: [-100, 100]},
		];
		this.show_dialog('brightness', params, filter_id);
	}

	convert_value(value) {
		let system_value;
		if (value > 0) {
			system_value = value / 100 + 1;
		}
		else if (value < 0) {
			system_value = value / 100 + 1;
		}
		else {
			system_value = 1;
		}

		return system_value;
	}

	demo(canvas_id, canvas_thumb){
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");

		//draw
		const size = this.convert_value(30, null, 'preview');
		ctx.filter = `brightness(${size})`;
		ctx.drawImage(canvas_thumb, 0, 0);
		ctx.filter = 'none';
	}

	render_pre(ctx, data) {
		const value = this.convert_value(data.params.value, data.params, 'save');
		const filter = `brightness(${value})`;

		if(ctx.filter == 'none')
			ctx.filter = filter;
		else
			ctx.filter += ` ${  filter}`;
	}

	render_post(ctx){
		ctx.filter = 'none';
	}

}

export default Effects_brightness_class;
