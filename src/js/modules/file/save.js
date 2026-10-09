import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Tools_settings_class from "../tools/settings";
import { t } from '../tools/translate.js';
import { export_as_json as build_json_export, fill_canvas_background, disable_canvas_smooth } from './save-helpers.js';
import File_save_action_class from './save-action.js';
import File_save_size_class from './save-size.js';
import { filter_supported_types } from './../../libs/export-formats.js';

let instance = null;

/**
 * manages files / save
 *
 * @author ViliusL
 */
class File_save_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.POP = new Dialog_class();
		this.Tools_settings = new Tools_settings_class();

		this.set_events();

		//save types config
		this.SAVE_TYPES = {
			PNG: "Portable Network Graphics",
			JPG: "JPG/JPEG Format",
			AVIF: "AV1 Image File Format",
			JSON: "Full layers data",
			WEBP: "Weppy File Format",
			GIF: "Graphics Interchange Format",
			BMP: "Windows Bitmap",
			TIFF: "Tag Image File Format",
			PDF: "Portable Document Format",
		};

		this.default_extension = 'PNG';

		//sub modules
		this.action_ops = new File_save_action_class(this);
		this.size_ops = new File_save_size_class(this);
	}

	set_events() {
	}

	/**
	 * saves as non destructive mode (including layers, RAW)
	 */
	save(){
		const types = JSON.parse(JSON.stringify(this.SAVE_TYPES));
		for(const i in types){
			if(i != 'JSON'){
				delete types[i];
			}
		}

		this.save_general(types, 'Save as');

	}

	/**
	 * save as encoded image
	 */
	export(){
		const types = JSON.parse(JSON.stringify(this.SAVE_TYPES));
		delete types.JSON;

		//only formats this browser can encode
		this.save_general(filter_supported_types(types), 'Export');
	}

	/**
	 * saves the image at once without a dialog - in the format used last time (PNG by default)
	 */
	quick_export() {
		const types = filter_supported_types(this.SAVE_TYPES);
		delete types.JSON;
		let type = this.Helper.getCookie('save_default');
		if (!types[type]) {
			type = 'PNG';
		}
		let file_name = String(config.layers[0].name).split('.');
		if (file_name.length > 1) {
			file_name.pop();
		}
		file_name = file_name.join('.').replace(/ /g, '-');
		this.action_ops.save_action({
			name: file_name,
			type,
			layers: 'All',
			quality: 90,
			delay: 400,
		}, false);
	}

	save_general(file_types, title) {
		let i;

		//find default format
		let save_default = null;
		const save_default_cookie = this.Helper.getCookie('save_default');

		for(i in file_types) {
			if(save_default_cookie == i){
				save_default = i;
				break;
			}
		}
		if(save_default == null){
			save_default = Object.keys(file_types)[0];
		}
		save_default = `${save_default  } - ${  file_types[save_default]}`;

		let calc_size_value = false;
		let calc_size = false;
		if (config.WIDTH * config.HEIGHT < 1000000) {
			calc_size_value = true;
			calc_size = true;
		}

		let file_name = config.layers[0].name;
		const parts = file_name.split('.');
		if (parts.length > 1)
			file_name = parts[parts.length - 2];
		file_name = file_name.replace(/ /g, "-");
		file_name = this.Helper.escapeHtml(file_name);

		const save_types = [];
		for(i in file_types) {
			save_types.push(`${i  } - ${  file_types[i]}`);
		}

		const save_layers_types = [
			'All',
			'Selected',
			'Separated',
			'Separated (original types)',
		];
		const resolution = this.Tools_settings.get_setting('resolution');

		const settings = {
			title,
			params: [
				{name: "name", title: "File name:", value: file_name},
				{name: "type", title: "Save as type:", type: "select", values: save_types, value: save_default},
				{name: "quality", title: "Quality:", value: 90, range: [1, 100]},
				{title: "File size:", html: '<span id="file_size">-</span>'},
				{title: "Resolution (dpi):",  value: resolution},
				{name: "calc_size", title: "Show file size:", value: calc_size_value},
				{name: "layers", title: "Save layers:", values: save_layers_types},
				{name: "delay", title: "Gif delay:", value: 400},
			],
			on_change: () => {
				this.save_dialog_onchange(true);
			},
			on_finish: (params) => {
				if (params.layers == 'Separated' || params.layers == 'Separated (original types)') {
					const active_layer = config.layer.id;
					const original_layer_type = params.layers;

					//alter params
					params.layers = 'Selected';

					for (const i in config.layers) {
						if (config.layers[i].visible == false)
							continue;

						//detect type
						if (original_layer_type == 'Separated (original types)') {
							//detect type from file name
							params.type = this.SAVE_TYPES[this.default_extension];
							for (const j in this.SAVE_TYPES) {
								if (this.Helper.strpos(config.layers[i].name.toLowerCase(), `.${  j.toLowerCase()}`) !== false) {
									params.type = j;
									break;
								}
							}
						}

						new app.Actions.Select_layer_action(config.layers[i].id, true).do();
						this.save_action(params, true);
					}
					new app.Actions.Select_layer_action(active_layer, true).do();
				}
				else {
					this.save_action(params);
				}
			},
		};
		this.POP.show(settings);

		document.getElementById("pop_data_name").select();

		if (calc_size == true) {
			//calc size once
			this.save_dialog_onchange(true);
		}
		else{
			this.save_dialog_onchange(false);
		}
	}

	save_data_url() {
		let max = 10 * 1000 * 1000;
		if (config.WIDTH * config.WIDTH > 10 * 1000 * 1000) {
			alertify.error(`${t('Size is too big, max ') + this.Helper.number_format(max, 0)  } pixels.`);
			return;
		}

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext("2d");
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;

		disable_canvas_smooth(ctx);

		//ask data
		this.Base_layers.convert_layers_to_canvas(ctx, null, false);
		const data_url = canvas.toDataURL();

		max = 1000 * 1000;
		if (data_url.length > max) {
			alertify.error(`${t('Size is too big, max ') + this.Helper.number_format(max, 0)  } bytes.`);
			return;
		}

		const settings = {
			title: 'Data URL',
			params: [
				{name: "url", title: "URL:", type: "textarea", value: data_url},
			],
		};
		this.POP.show(settings);
	}

	/**
	 * sub module delegates
	 */
	save_action(user_response, autoname) {
		return this.action_ops.save_action(user_response, autoname);
	}

	save_dialog_onchange(calculate_file_size) {
		return this.size_ops.save_dialog_onchange(calculate_file_size);
	}

	export_as_json() {
		return build_json_export();
	}

	fillCanvasBackground(ctx, color, width, height) {
		return fill_canvas_background(ctx, color, width, height);
	}

}

export default File_save_class;
