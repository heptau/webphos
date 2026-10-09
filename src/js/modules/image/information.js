import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import Base_layers_class from './../../core/base-layers.js';
import Tools_settings_class from './../tools/settings.js';
import Base_gui_class from './../../core/base-gui.js';
import { UNIT_NAMES, is_unit, clamp_dpi } from './../../libs/units.js';
import app from './../../app.js';

let instance = null;

class Image_information_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
		this.Tools_settings = new Tools_settings_class();
		this.Base_gui = new Base_gui_class();

		this.set_events();
	}

	set_events() {
	}

	information() {
		let pixels = config.WIDTH * config.HEIGHT;
		pixels = this.Helper.number_format(pixels, 0);

		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		const width = this.Helper.get_user_unit(config.WIDTH, units, resolution);
		const height = this.Helper.get_user_unit(config.HEIGHT, units, resolution);

		const settings = {
			title: 'Information',
			params: [
				{title: "Width:", value: `${width  } ${  units}`},
				{title: "Height:", value: `${height  } ${  units}`},
				{title: "Pixels:", value: pixels},
				{name: "dpi", title: "Resolution (dpi):", value: parseInt(resolution, 10) || 72},
				{name: "units", title: "Units:", type: "select", values: UNIT_NAMES, value: units},
				{title: "Layers:", value: config.layers.length},
				{title: "Unique colors:", value: '...'},
			],
			on_finish: (params) => {
				let dpi = Math.round(parseFloat(params.dpi));
				if (isNaN(dpi)) {
					return;
				}
				dpi = clamp_dpi(dpi);
				const new_units = is_unit(params.units) ? params.units : units;
				if (dpi != (parseInt(resolution, 10) || 72) || new_units != units) {
					app.State.do_action(new app.Actions.Update_config_action({RESOLUTION: dpi, UNITS: new_units})).then(() => {
						this.Base_gui.GUI_information.update_units();
					});
				}
			},
		};
		if(units != 'pixels'){
			settings.params[0].value += ` (${config.WIDTH} pixels)`;
			settings.params[1].value += ` (${config.HEIGHT} pixels)`;
		}

		//exif data
		if (config.layer._exif != undefined) {
			//show exif and general data
			let i;
			const exif_data = config.layer._exif;

			//show general data
			for (i in exif_data.general) {
				settings.params.push({title: `${i  }:`, value: exif_data.general[i]});
			}

			//show exif data
			let n = 0;
			for (i in exif_data.exif) {
				if (i == 'undefined')
					continue;
				if (n == 0)
					settings.params.push({title: "==== EXIF ====", value: ''});
				settings.params.push({title: `${i  }:`, value: exif_data.exif[i]});
				n++;
			}
		}

		this.POP.show(settings);

		//calc colors
		setTimeout(() => {
			let colors = this.unique_colors_count();
			colors = this.Helper.number_format(colors, 0);
			document.getElementById('pop_data_uniquecolo').innerHTML = colors;
		}, 50);
	}

	unique_colors_count() {
		let n, i, key;
		const method = 'v2'; //v1 or v2

		if (config.WIDTH * config.HEIGHT > 20 * 1000 * 1000) {
			return '-';
		}

		const canvas = this.Base_layers.convert_layer_to_canvas();
		const ctx = canvas.getContext("2d");
		const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const imgData = img.data;

		//v1 - simple, slow
		if (method == 'v1') {
			const colors = [];
			n = 0;
			for (i = 0; i < imgData.length; i += 4) {
				if (imgData[i + 3] == 0)
					continue;	//transparent
				key = `${imgData[i]  }.${imgData[i + 1]}.${  imgData[i + 2]}`;
				if (colors[key] == undefined) {
					colors[key] = 1;
					n++;
				}
			}
		}

		//v2 - 30% faster
		else if (method == 'v2') {
			const buffer32 = new Uint32Array(imgData.buffer);
			const len = buffer32.length;
			const stats = {};
			n = 0;

			for (i = 0; i < len; i++) {
				key = `${  buffer32[i] & 0xffffff}`;
				if (stats[key] == undefined) {
					stats[key] = 0;
					n++;
				}
			}
		}

		return n;
	}
}

export default Image_information_class;
