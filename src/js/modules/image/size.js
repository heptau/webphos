import { UNIT_NAMES, is_unit, to_pixels, from_pixels, clamp_dpi } from './../../libs/units.js';
import { link_unit_fields } from './../../libs/dialog-units.js';
import app from './../../app.js';
import config from './../../config.js';
import Base_gui_class from './../../core/base-gui.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Tools_settings_class from './../tools/settings.js';
import Helper_class from './../../libs/helpers.js';
import { t } from '../tools/translate.js';

class Image_size_class {

	constructor() {
		this.Base_gui = new Base_gui_class();
		this.POP = new Dialog_class();
		this.Tools_settings = new Tools_settings_class();
		this.Helper = new Helper_class();
	}

	size() {
		var _this = this;
		var common_dimensions = this.Base_gui.common_dimensions;
		var units = this.Tools_settings.get_setting('default_units');
		var resolution = this.Tools_settings.get_setting('resolution');
		var enable_autoresize = this.Tools_settings.get_setting('enable_autoresize');

		var resolutions = ['Custom'];
		for (var i in common_dimensions) {
			var value = common_dimensions[i];
			resolutions.push(value[0] + 'x' + value[1] + ' - ' + value[2]);
		}

		//convert units
		var width = from_pixels(config.WIDTH, units, resolution);
		var height = from_pixels(config.HEIGHT, units, resolution);

		var settings = {
			title: 'Canvas Size',
			params: [
				{name: "w", title: "Width:", value: width, placeholder: width},
				{name: "h", title: "Height:", value: height, placeholder: height},
				{name: "units", title: "Units:", type: "select", values: UNIT_NAMES, value: units},
				{name: "dpi", title: "Resolution (dpi):", value: parseInt(resolution, 10) || 72},
				{title: "Pixels:", html: '<span id="size_pixels">-</span>'},
				{name: "resolution", title: "Preset:", values: resolutions},
				{name: "layout", title: "Layout:", value: "Custom", values: ["Custom", "Landscape", "Portrait"]},
				{name: "enable_autoresize", title: "Enable autoresize:", value: enable_autoresize},
				{name: "in_proportion", title: "In proportion:", value: false},
			],
			on_finish: function (params) {
				_this.size_handler(params);
			},
		};
		this.POP.show(settings);
		link_unit_fields({width: 'w', height: 'h', units: 'units', dpi: 'dpi'}, 'size_pixels');
	}

	size_handler(data) {
		var width = parseFloat(data.w);
		var height = parseFloat(data.h);
		var ratio = config.WIDTH / config.HEIGHT;
		var units = is_unit(data.units) ? data.units : this.Tools_settings.get_setting('default_units');
		var resolution = clamp_dpi(data.dpi);

		if (width < 0){
			width = 1;
		}
		if (height < 0){
			height = 1;
		}

		this.Tools_settings.save_setting('enable_autoresize', data.enable_autoresize);
		
		//aspect ratio
		if (isNaN(width) && isNaN(height)){
			alertify.error(t('Wrong dimensions'));
			return;
		}
		if (isNaN(width)){
			width = height * ratio;
		}
		if (isNaN(height)){
			height = width / ratio;
		}
		
		if (data.resolution != 'Custom') {
			var dim = data.resolution.split(" ");
			dim = dim[0].split("x");
			width = parseInt(dim[0]);
			height = parseInt(dim[1]);

			if(data.layout == 'Portrait'){
				var tmp = width;
				width = height;
				height = tmp;
			}
		}
		else{
			//convert units
			width = to_pixels(width, units, resolution);
			height = to_pixels(height, units, resolution);
		}

		var actions = [
			new app.Actions.Prepare_canvas_action('undo'),
			new app.Actions.Update_config_action({
				WIDTH: parseInt(width),
				HEIGHT: parseInt(height),
				RESOLUTION: resolution,
				UNITS: units,
			}),
		];

		if(data.in_proportion == true) {
			//resize object and change coordinates
			var width_ratio =  config.WIDTH / width;
			var height_ratio = config.HEIGHT / height;
			var ratio = Math.max(width_ratio, height_ratio);

			for (var i in config.layers) {
				var layer = config.layers[i];
				if(layer.x != null && layer.y != null) {
					var data_new = {
						x: Math.round(layer.x / width_ratio),
						y: Math.round(layer.y / height_ratio),
					};
					actions.push(new app.Actions.Update_layer_action(layer.id, data_new));
				}
				if(layer.width != null && layer.height != null) {
					var data_new = {
						width: Math.round(layer.width / ratio),
						height: Math.round(layer.height / ratio),
					};
					actions.push(new app.Actions.Update_layer_action(layer.id, data_new));
				}
			}
		}

		actions.push(new app.Actions.Prepare_canvas_action('do'));

		//execute
		app.State.do_action(
			new app.Actions.Bundle_action('set_image_size', 'Set Image Size', actions)
		);
	}
}

export default Image_size_class;
