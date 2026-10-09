import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Base_gui_class from './../../core/base-gui.js';
import Dialog_class from './../../libs/popup.js';
import ImageFilters_class from './../../libs/imagefilters.js';
import Hermite_class from 'hermite-resize';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Pica from './../../../../node_modules/pica/dist/pica.js';
import Helper_class from './../../libs/helpers.js';
import Tools_settings_class from './../tools/settings.js';
import { metaDefaults as textMetaDefaults } from '../../tools/text.js';
import { t } from '../tools/translate.js';
import { smoothing_for_mode } from './../../libs/resample.js';
import { UNIT_NAMES, is_unit, to_pixels, from_pixels, convert_size, dpi_for, clamp_dpi } from './../../libs/units.js';

let instance = null;

class Image_resize_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.Base_gui = new Base_gui_class();
		this.POP = new Dialog_class();
		this.ImageFilters = ImageFilters_class;
		this.Hermite = new Hermite_class();
		this.Tools_settings = new Tools_settings_class();
		this.pica = Pica();
		this.Helper = new Helper_class();

		this.set_events();
	}

	set_events() {
	}

	resize() {
		const units = this.Tools_settings.get_setting('default_units');
		const resolution = parseInt(this.Tools_settings.get_setting('resolution'), 10) || 72;

		//convert units
		const width = from_pixels(config.WIDTH, units, resolution);
		const height = from_pixels(config.HEIGHT, units, resolution);

		const settings = {
			title: 'Resize',
			params: [
				{name: "width", title: "Width:", value: width},
				{name: "height", title: "Height:", value: height},
				{name: "units", title: "Units:", type: "select", values: UNIT_NAMES, value: units},
				{name: "dpi", title: "Resolution (dpi):", value: resolution},
				{name: "width_percent", title: "Width (%):", value: 100, comment: "%"},
				{name: "height_percent", title: "Height (%):", value: 100, comment: "%"},
				{name: "constrain", title: "Constrain proportions:", value: true},
				{name: "resample", title: "Resample:", value: true},
				{title: "Pixels:", html: '<span id="resize_pixels">-</span>'},
				{name: "mode", title: "Mode:", values: ["Lanczos", "Hermite", "Bicubic", "Bilinear", "Nearest Neighbor", "Basic"]},

				{name: "sharpen", title: "Sharpen:", value: false},
				{name: "layers", title: "Layers:", values: ["All", "Active"], value: "All"},
			],
			on_finish: (params) => {
				this.do_resize(params);
			},
		};
		this.POP.show(settings);

		this.link_size_fields();
		document.getElementById("pop_data_width").select();
	}

	/**
	 * keeps width, height, resolution, unit and percent fields of the dialog consistent (like Image Size in Photoshop):
	 * with "Resample" the pixels change and the resolution stays, without it the pixels stay
	 * and the resolution (or the other dimension) is recalculated, so nothing is lost.
	 * "Constrain proportions" keeps the aspect ratio
	 */
	link_size_fields() {
		const field = (name) => document.getElementById(`pop_data_${  name}`);
		const orig_w = config.WIDTH;
		const orig_h = config.HEIGHT;
		let unit = field('units').value;
		const number = (name) => parseFloat(field(name).value);
		const locked = () => field('constrain').checked;
		const resample = () => field('resample').checked;
		const dpi = () => clamp_dpi(field('dpi').value);
		const format = (value, u) => String(u == 'pixels' ? Math.round(value) : parseFloat(value.toFixed(3)));
		const set_dpi = (value) => {
			field('dpi').value = String(parseFloat(value.toFixed(2)));
		};
		const pixels = () => resample() ? [to_pixels(number('width'), unit, dpi()), to_pixels(number('height'), unit, dpi())] : [orig_w, orig_h];
		const refresh = () => {
			const px = pixels();
			if (!isNaN(px[0])) field('width_percent').value = String(Math.round(px[0] / orig_w * 100));
			if (!isNaN(px[1])) field('height_percent').value = String(Math.round(px[1] / orig_h * 100));
			document.getElementById('resize_pixels').textContent = (isNaN(px[0]) || isNaN(px[1])) ? '-' : `${px[0]  } x ${px[1]} px`;
		};
		//fields from pixels at the current resolution
		const set_fields = (w, h) => {
			field('width').value = format(from_pixels(w, unit, dpi()), unit);
			field('height').value = format(from_pixels(h, unit, dpi()), unit);
		};
		//the user typed one dimension: `typed` is its name
		const typed_dimension = (typed) => {
			const value = number(typed);
			if (!(value > 0)) return;
			const other = typed == 'width' ? 'height' : 'width';
			const orig_typed = typed == 'width' ? orig_w : orig_h;
			const orig_other = typed == 'width' ? orig_h : orig_w;
			if (resample()) {
				if (locked()) {
					const px = to_pixels(value, unit, dpi());
					const other_px = Math.max(1, Math.round(orig_other * px / orig_typed));
					field(other).value = format(from_pixels(other_px, unit, dpi()), unit);
				}
			}
			else if (unit != 'pixels') {
				//pixels stay: the resolution changes and the other dimension follows
				const new_dpi = dpi_for(orig_typed, value, unit);
				if (!isNaN(new_dpi)) {
					set_dpi(new_dpi);
					field(other).value = format(from_pixels(orig_other, unit, dpi()), unit);
				}
			}
			refresh();
		};

		field('width').addEventListener('input', () => typed_dimension('width'));
		field('height').addEventListener('input', () => typed_dimension('height'));
		field('width_percent').addEventListener('input', () => {
			const value = number('width_percent');
			if (isNaN(value) || value <= 0 || !resample()) return;
			const h_percent = locked() ? value : (number('height_percent') || value);
			set_fields(orig_w * value / 100, orig_h * h_percent / 100);
			refresh();
			field('width_percent').value = String(Math.round(value));
		});
		field('height_percent').addEventListener('input', () => {
			const value = number('height_percent');
			if (isNaN(value) || value <= 0 || !resample()) return;
			const w_percent = locked() ? value : (number('width_percent') || value);
			set_fields(orig_w * w_percent / 100, orig_h * value / 100);
			refresh();
			field('height_percent').value = String(Math.round(value));
		});
		field('units').addEventListener('change', () => {
			const next = field('units').value;
			['width', 'height'].forEach((name) => {
				field(name).value = format(convert_size(number(name), unit, next, dpi()), next);
			});
			unit = next;
			refresh();
		});
		field('dpi').addEventListener('input', () => {
			if (!resample()) {
				//pixels stay, the physical size follows the resolution
				set_fields(orig_w, orig_h);
			}
			refresh();
		});
		field('resample').addEventListener('change', () => {
			if (!resample()) {
				//back to the pixels of the picture
				set_fields(orig_w, orig_h);
			}
			refresh();
		});
		field('constrain').addEventListener('change', () => {
			if (locked() && isNaN(number('width')) == false) {
				typed_dimension('width');
			}
		});
		refresh();
	}

	async do_resize(params) {
		//validate
		if (isNaN(params.width) && isNaN(params.height) && isNaN(params.width_percent) && isNaN(params.height_percent)) {
			alertify.error(t('Missing at least 1 size parameter.'));
			return false;
		}

		if (params.resample === false) {
			//no resampling: only the physical size (unit and resolution) of the same pixels changes
			return app.State.do_action(
				new app.Actions.Update_config_action({
					RESOLUTION: clamp_dpi(params.dpi),
					UNITS: is_unit(params.units) ? params.units : config.UNITS,
				})
			).then(() => this.Base_gui.GUI_information.update_units());
		}

		// Build a list of actions to execute for resize
		let actions = [];

		if (params.layers == 'All') {
			//resize all layers
			let skips = 0;
			for (const i in config.layers) {
				try {
					actions = actions.concat(await this.resize_layer(config.layers[i], params));
				} catch {
					skips++;
				}
			}
			if (skips > 0) {
				alertify.error(`${skips  } layer(s) were skipped.`);
			}
			actions = actions.concat(this.resize_gui(params));
		}
		else {
			//only active
			actions = actions.concat(await this.resize_layer(config.layer, params));
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('resize_layers', 'Resize Layers', actions)
		);
	}

	/**
	 * Generates actions that will resize layer (image, text, vector), returns a promise that rejects on failure.
	 *
	 * @param {object} layer
	 * @param {object} params
	 * @returns {Promise<object>} Returns array of actions to perform
	 */
	async resize_layer(layer, params) {
		let tmp_data;
		const units = is_unit(params.units) ? params.units : this.Tools_settings.get_setting('default_units');
		const resolution = clamp_dpi(params.dpi || this.Tools_settings.get_setting('resolution'));
		let mode = params.mode;
		let width = parseFloat(params.width);
		let height = parseFloat(params.height);
		const width_100 = parseInt(params.width_percent);
		const height_100 = parseInt(params.height_percent);
		const sharpen = params.sharpen;

		//convert units
		if (isNaN(width) == false){
			width = this.Helper.get_internal_unit(width, units, resolution);
		}
		if (isNaN(height) == false){
			height = this.Helper.get_internal_unit(height, units, resolution);
		}

		//if dimension with percent provided
		if (isNaN(width) && isNaN(height)) {
			if (isNaN(width_100) == false) {
				width = Math.round(config.WIDTH * width_100 / 100);
			}
			if (isNaN(height_100) == false) {
				height = Math.round(config.HEIGHT * height_100 / 100);
			}
		}

		//if only 1 dimension was provided
		if (isNaN(width) || isNaN(height)) {
			const ratio = layer.width / layer.height;
			if (isNaN(width))
				width = Math.round(height * ratio);
			if (isNaN(height))
				height = Math.round(width / ratio);
		}

		const new_x = params.layers == 'All' ? Math.round(layer.x * width / config.WIDTH) : layer.x;
		const new_y = params.layers == 'All' ? Math.round(layer.y * height / config.HEIGHT) : layer.y;
		const xratio = width / config.WIDTH;
		const yratio = height / config.HEIGHT;

		//is text
		if (layer.type == 'text') {
			const data = JSON.parse(JSON.stringify(layer.data));
			for (const line of data) {
				for (const span of line) {
					span.meta.size = Math.ceil((span.meta.size || textMetaDefaults.size) * xratio);
					span.meta.stroke_size = parseFloat((0.1 * Math.round((span.meta.stroke_size != null ? span.meta.stroke_size : textMetaDefaults.stroke_size) * xratio / 0.1)).toFixed(1));
					span.meta.kerning = Math.ceil((span.meta.kerning || textMetaDefaults.kerning) * xratio);
				}
			}

			// Return actions
			return [
				new app.Actions.Update_layer_action(layer.id, {
					x: new_x,
					y: new_y,
					data,
					width: layer.width * xratio,
					height: layer.height * yratio
				})
			];
		}

		//is vector
		else if (layer.is_vector == true && layer.width != null && layer.height != null) {
			// Return actions
			return [
				new app.Actions.Update_layer_action(layer.id, {
					x: new_x,
					y: new_y,
					width: layer.width * xratio,
					height: layer.height * yratio
				})
			];
		}

		//only images supported at this point
		else if (layer.type != 'image') {
			//error - no support
			alertify.error(t('Layer must be vector or image (convert it to raster).'));
			throw new Error('Layer is not compatible with resize');
		}

		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(layer.id, true, false);
		const ctx = canvas.getContext("2d");

		//validate
		if (mode == "Hermite" && (width > canvas.width || height > canvas.height)) {
			alertify.warning(t('Scaling up is not supported in Hermite, using Lanczos.'));
			mode = "Lanczos";
		}

		//resize
		if (mode == "Lanczos") {
			//Pica resize with max quality

			tmp_data = document.createElement("canvas");
			tmp_data.width = width;
			tmp_data.height = height;

			await this.pica.resize(canvas, tmp_data, {
				alpha: true,
			})
			.then(() => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				canvas.width = width;
				canvas.height = height;
				ctx.drawImage(tmp_data, 0, 0, width, height);
			});
		}
		else if (mode == "Hermite") {
			//Hermite resample
			this.Hermite.resample_single(canvas, width, height, true);
		}
		else {
			//simple resize
			tmp_data = document.createElement("canvas");
			tmp_data.width = canvas.width;
			tmp_data.height = canvas.height;
			tmp_data.getContext("2d").drawImage(canvas, 0, 0);

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			canvas.width = width;
			canvas.height = height;

			//Bicubic, Bilinear, Nearest Neighbor or the default of the browser
			const smoothing = smoothing_for_mode(mode);
			ctx.imageSmoothingEnabled = smoothing.enabled;
			ctx.imageSmoothingQuality = smoothing.quality;
			ctx.drawImage(tmp_data, 0, 0, width, height);
		}

		if (sharpen == true) {
			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const filtered = this.ImageFilters.Sharpen(imageData, 1);	//add effect
			ctx.putImageData(filtered, 0, 0);
		}

		// Return actions
		return [
			new app.Actions.Update_layer_image_action(canvas, layer.id),
			new app.Actions.Update_layer_action(layer.id, {
				x: new_x,
				y: new_y,
				width: canvas.width,
				height: canvas.height,
				width_original: canvas.width,
				height_original: canvas.height
			})
		];
	}

	resize_gui(params) {
		const units = is_unit(params.units) ? params.units : this.Tools_settings.get_setting('default_units');
		const resolution = clamp_dpi(params.dpi || this.Tools_settings.get_setting('resolution'));

		let width = parseFloat(params.width);
		let height = parseFloat(params.height);
		const width_100 = parseInt(params.width_percent);
		const height_100 = parseInt(params.height_percent);

		//convert units
		if (isNaN(width) == false){
			width = this.Helper.get_internal_unit(width, units, resolution);
		}
		if (isNaN(height) == false){
			height = this.Helper.get_internal_unit(height, units, resolution);
		}

		//if dimension with percent provided
		if (isNaN(width) && isNaN(height)) {
			if (isNaN(width_100) == false) {
				width = Math.round(config.WIDTH * width_100 / 100);
			}
			if (isNaN(height_100) == false) {
				height = Math.round(config.HEIGHT * height_100 / 100);
			}
		}

		//if only 1 dimension was provided
		if (isNaN(width) || isNaN(height)) {
			const ratio = config.WIDTH / config.HEIGHT;
			if (isNaN(width))
				width = Math.round(height * ratio);
			if (isNaN(height))
				height = Math.round(width / ratio);
		}

		return [
			new app.Actions.Prepare_canvas_action('undo'),
			new app.Actions.Update_config_action({
				WIDTH: parseInt(width),
				HEIGHT: parseInt(height),
				RESOLUTION: resolution,
				UNITS: units,
			}),
			new app.Actions.Prepare_canvas_action('do')
		];
	}

}

export default Image_resize_class;
