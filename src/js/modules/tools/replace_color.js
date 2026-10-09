import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from './translate.js';

class Tools_replaceColor_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
	}

	replace_color() {

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const settings = {
			title: 'Replace color',
			preview: true,
			on_change: (params, canvas_preview, w, h) => {
				const img = canvas_preview.getImageData(0, 0, w, h);
				const data = this.do_replace(img, params);
				canvas_preview.putImageData(data, 0, 0);
			},
			params: [
				{name: "target", title: "Target:", value: config.COLOR, type: 'color'},
				{name: "replacement", title: "Replacement:", value: '#ff0000', type: 'color'},
				{name: "power", title: "Power:", value: "20", range: [0, 255]},
				{name: "alpha", title: "Alpha:", value: "255", range: [0, 255]},
				{name: "mode", title: "Mode:", values: ['Advanced', 'Simple']},
			],
			on_finish: (params) => {
				this.save_alpha(params);
			},
		};
		this.POP.show(settings);
	}

	save_alpha(params) {
		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(null, true);
		const ctx = canvas.getContext("2d");

		//change data
		const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = this.do_replace(img, params);
		ctx.putImageData(data, 0, 0);

		//save
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas)
		);
	}

	do_replace(data, params) {
		let diff;
		const target = params.target;
		const replacement = params.replacement;
		const power = params.power;
		const alpha = params.alpha;
		const mode = params.mode;

		const imgData = data.data;
		const target_rgb = this.Helper.hexToRgb(target);
		const target_hsl = this.Helper.rgbToHsl(target_rgb.r, target_rgb.g, target_rgb.b);
		const target_normalized = this.Helper.hslToRgb(target_hsl.h, target_hsl.s, 0.5);

		const replacement_rgb = this.Helper.hexToRgb(replacement);
		const replacement_hsl = this.Helper.rgbToHsl(replacement_rgb.r, replacement_rgb.g, replacement_rgb.b);

		for (let i = 0; i < imgData.length; i += 4) {
			if (imgData[i + 3] == 0)
				continue;	//transparent

			if (mode == 'Simple') {
				//simple replace

				//calculate difference from requested color, and change alpha
				diff = (Math.abs(imgData[i] - target_rgb.r)
					+ Math.abs(imgData[i + 1] - target_rgb.g)
					+ Math.abs(imgData[i + 2] - target_rgb.b)) / 3;
				if (diff > power)
					continue;

				imgData[i] = replacement_rgb.r;
				imgData[i + 1] = replacement_rgb.g;
				imgData[i + 2] = replacement_rgb.b;
				if (alpha < 255)
					imgData[i + 3] = alpha;
			}
			else {
				//advanced replace using HSL

				const hsl = this.Helper.rgbToHsl(imgData[i], imgData[i + 1], imgData[i + 2]);
				const normalized = this.Helper.hslToRgb(hsl.h, hsl.s, 0.5);
				diff = (Math.abs(normalized.r - target_normalized.r)
					+ Math.abs(normalized.g - target_normalized.g)
					+ Math.abs(normalized.b - target_normalized.b)) / 3;
				if (diff > power)
					continue;

				//change to new color with existing luminance
				const normalized_final = this.Helper.hslToRgb(
					replacement_hsl.h,
					replacement_hsl.s,
					hsl.l * (replacement_hsl.l)
				);

				imgData[i] = normalized_final.r;
				imgData[i + 1] = normalized_final.g;
				imgData[i + 2] = normalized_final.b;
				if (alpha < 255)
					imgData[i + 3] = alpha;
			}
		}
		return data;
	}

}

export default Tools_replaceColor_class;
