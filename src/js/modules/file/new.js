import app from './../../app.js';
import config from './../../config.js';
import Base_gui_class from './../../core/base-gui.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import Dialog_class from './../../libs/popup.js';
import Tools_settings_class from './../tools/settings.js';
import { UNIT_NAMES, is_unit, to_pixels, from_pixels, clamp_dpi } from './../../libs/units.js';
import { link_unit_fields } from './../../libs/dialog-units.js';

/**
 * manages files / new
 *
 * @author ViliusL
 */
class File_new_class {

	constructor() {
		this.Base_gui = new Base_gui_class();
		this.Base_layers = new Base_layers_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
		this.Tools_settings = new Tools_settings_class();
	}

	new () {
		let transparency;
		let width = config.WIDTH;
		let height = config.HEIGHT;
		const common_dimensions = this.Base_gui.common_dimensions;
		const resolution_types = ['Custom'];
		//a new document starts with the defaults from Settings
		const units = this.Tools_settings.get_setting('default_units', true);
		const resolution = this.Tools_settings.get_default_resolution();

		for (const i in common_dimensions) {
			const value = common_dimensions[i];
			resolution_types.push(`${value[0]  }x${value[1]} - ${  value[2]}`);
		}
		for (const j in this.Base_gui.preset_dimensions) {
			const preset = this.Base_gui.preset_dimensions[j];
			resolution_types.push(`${preset[0]  }x${preset[1]} - ${  preset[2]}`);
		}

		let transparency_cookie = this.Helper.getCookie('transparency');
		if (transparency_cookie === null) {
			//default
			transparency_cookie = false;
		}
		if (transparency_cookie) {
			transparency = true;
		}
		else {
			transparency = false;
		}

		//convert units
		width = from_pixels(width, units, resolution);
		height = from_pixels(height, units, resolution);

		const settings = {
			title: 'New file',
			params: [
				{name: "resolution_type", title: "Preset:", type: "select", values: resolution_types},
				{name: "layout", title: "Layout:", type: "select", value: "Custom", values: ["Custom", "Landscape", "Portrait"]},
				{name: "width", title: "Width:", value: width},
				{name: "height", title: "Height:", value: height},
				{name: "units", title: "Units:", type: "select", values: UNIT_NAMES, value: units},
				{name: "dpi", title: "Resolution (dpi):", value: parseInt(resolution, 10) || 72},
				{title: "Pixels:", html: '<span id="new_pixels">-</span>'},
				{name: "transparency", title: "Transparent:", value: transparency},
			],
			on_finish: (params) => {
				this.new_handler(params);
			},
		};
		this.POP.show(settings);
		this.link_fields();
	}

	/**
	 * preset and layout fill the width / height fields (like in Photoshop), typing a size selects "Custom"
	 */
	link_fields() {
		const field = function (name) {
			return document.getElementById(`pop_data_${  name}`);
		};
		const linked = link_unit_fields({width: 'width', height: 'height', units: 'units', dpi: 'dpi'}, 'new_pixels');
		const preset_size = function () {
			const match = /^(\d+)x(\d+)/.exec(field('resolution_type').value);
			return match ? [parseInt(match[1], 10), parseInt(match[2], 10)] : null;
		};
		const apply_layout = function (w, h) {
			const layout = field('layout').value;
			if ((layout == 'Portrait' && w > h) || (layout == 'Landscape' && h > w)) {
				return [h, w];
			}
			return [w, h];
		};

		field('resolution_type').addEventListener('change', () => {
			const size = preset_size();
			if (size) {
				const oriented = apply_layout(size[0], size[1]);
				linked.set_pixels(oriented[0], oriented[1]);
			}
		});
		field('layout').addEventListener('change', () => {
			const size = preset_size() || linked.get_pixels();
			if (isNaN(size[0]) || isNaN(size[1])) {
				return;
			}
			const oriented = apply_layout(size[0], size[1]);
			linked.set_pixels(oriented[0], oriented[1]);
		});
		['width', 'height', 'dpi', 'units'].forEach((name) => {
			field(name).addEventListener('input', () => {
				if (name != 'units' && name != 'dpi') {
					field('resolution_type').value = 'Custom';
				}
			});
		});
	}

	/**
	 * replaces the current project by a new empty one; the old project stays in its own document tab
	 *
	 * @param {number} width pixels
	 * @param {number} height pixels
	 * @param {boolean} transparency
	 */
	async create_document(width, height, transparency, physical) {
		//the current project stays in its own document tab
		const rollback = app.GUI.GUI_documents.before_new();

		try {
			await app.State.do_action(
			new app.Actions.Bundle_action('new_file', 'New File', [
				new app.Actions.Refresh_action_attributes_action('undo'),
				new app.Actions.Prepare_canvas_action('undo'),
				new app.Actions.Update_config_action({
					TRANSPARENCY: !!transparency,
					WIDTH: parseInt(width),
					HEIGHT: parseInt(height),
					ALPHA: 255,
					RESOLUTION: physical && physical.dpi > 0 ? physical.dpi : null,
					UNITS: physical && is_unit(physical.units) ? physical.units : null,
					COLOR: '#008000',
					mouse: {},
					visible_width: null,
					visible_height: null,
					user_fonts: {}
				}),
				new app.Actions.Prepare_canvas_action('do'),
				new app.Actions.Refresh_action_attributes_action('do'),
				new app.Actions.Reset_layers_action(),
				new app.Actions.Init_canvas_zoom_action(),
				new app.Actions.Insert_layer_action({})
			])
			);
		}
		catch (error) {
			rollback();
			throw error;
		}

		//undo of the new project must not bring the previous document back
		await app.GUI.GUI_documents.clear_history();
		//creating the document is not a change of the document
		const created = app.GUI.GUI_documents.documents[app.GUI.GUI_documents.active];
		if (created) {
			created.dirty = false;
			app.GUI.GUI_documents.render();
		}

		//sleep, lets wait till DOM is finished
		await new Promise(r => setTimeout(r, 10));

		//fit to screen?
		this.Base_gui.GUI_preview.zoom_auto(true);
	}

	async new_handler(response) {
		const transparency = response.transparency;
		const units = is_unit(response.units) ? response.units : this.Tools_settings.get_setting('default_units');
		const dpi = clamp_dpi(response.dpi);

		//the preset and layout already filled the fields, so the fields are the single source of the size
		const width = to_pixels(response.width, units, dpi);
		const height = to_pixels(response.height, units, dpi);

		if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
			return;
		}

		await this.create_document(width, height, transparency, {dpi, units});

		// Save transparency
		if (transparency) {
			this.Helper.setCookie('transparency', 1);
		}
		else {
			this.Helper.setCookie('transparency', 0);
		}
	}

}

export default File_new_class;
