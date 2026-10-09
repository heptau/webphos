import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';

class Image_opacity_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	opacity() {
		const initial_opacity = config.layer.opacity;

		const settings = {
			title: 'Opacity',
			params: [
				{name: "opacity", title: "Alpha:", value: config.layer.opacity, range: [0, 100]},
			],
			on_change: (params) => {
				this.opacity_handler(params, false);
			},
			on_finish: (params) => {
				config.layer.opacity = initial_opacity;
				this.opacity_handler(params);
			},
			on_cancel () {
				config.layer.opacity = initial_opacity;
				config.need_render = true;
			},
		};
		this.POP.show(settings);
	}

	opacity_handler(data, is_final = true) {
		let value = parseInt(data.opacity);
		if (value < 0)
			value = 0;
		if (value > 100)
			value = 100;
		if (is_final) {
			app.State.do_action(
				new app.Actions.Bundle_action('change_opacity', 'Change Opacity', [
					new app.Actions.Update_layer_action(config.layer.id, {
						opacity: value
					})
				])
			);
		} else {
			config.layer.opacity = value;
			config.need_render = true;
		}
	}
}

export default Image_opacity_class;
