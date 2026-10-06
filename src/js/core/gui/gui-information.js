/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../base-layers.js';
import Tools_settings_class from './../../modules/tools/settings.js';
import Helper_class from './../../libs/helpers.js';
import Tools_translate_class, { t } from './../../modules/tools/translate.js';

var template = `
	<span class="status_item status_zoom_item">
		<span class="trn label">Zoom:</span>
		<input type="number" id="status_zoom" min="1" max="5000" step="1" aria-label="Zoom" />
		<span>%</span>
	</span>
	<span class="status_item">
		<span class="trn label">Size:</span>
		<span id="mouse_info_size">-</span>
		<span class="id-mouse_info_units"></span>
	</span>
	<span class="status_item">
		<span class="trn label">Mouse:</span>
		<span class="status_value_mouse" id="mouse_info_mouse">-</span>
		<span class="id-mouse_info_units"></span>
	</span>
	<span class="status_item" id="status_measure_item" hidden>
		<span class="trn label">Measure:</span>
		<span id="status_measure">-</span>
	</span>
	<span class="status_item" id="status_selection_item" hidden>
		<span class="trn label">Selection:</span>
		<span id="status_selection">-</span>
	</span>
	<span class="status_item status_color_item">
		<span class="trn label">Color:</span>
		<span class="status_swatch" id="status_color_swatch"></span>
		<span class="status_value_color" id="status_color">-</span>
	</span>
	<span class="status_item">
		<span class="trn label">Resolution:</span>
		<span id="mouse_info_resolution">-</span>
	</span>
	<span class="status_item status_autosave" id="status_autosave_item" hidden>
		<span id="status_autosave"></span>
	</span>
`;

/**
 * GUI class responsible for rendering information in the status bar (footer)
 */
class GUI_information_class {

	constructor(ctx) {
		this.Base_layers = new Base_layers_class();
		this.Tools_settings = new Tools_settings_class();
		this.Helper = new Helper_class();
		this.Tools_translate = new Tools_translate_class();
		this.last_width = null;
		this.last_height = null;
		this.last_color_read = 0;
		this.units = this.Tools_settings.get_setting('default_units');
		this.resolution = this.Tools_settings.get_setting('resolution');
	}

	render_main_information() {
		var container = document.getElementById('status_bar');
		container.innerHTML = template;
		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, container);
		}
		this.set_events();
		this.show_size();
		this.init_zoom_field();
		//time of the last automatic save
		document.addEventListener('minipaint:autosaved', (event) => {
			var time = new Date(event.detail || Date.now());
			var text = String(time.getHours()).padStart(2, '0') + ':' + String(time.getMinutes()).padStart(2, '0');
			document.getElementById('status_autosave').textContent = t('Autosaved') + ' ' + text;
			document.getElementById('status_autosave_item').hidden = false;
		});
		//size of the selection while it is shown (hidden again when it stops being drawn)
		window.report_selection_size = (w, h) => {
			this.selection_seen = Date.now();
			document.getElementById('status_selection_item').hidden = false;
			var text = Math.round(Math.abs(w)) + ' x ' + Math.round(Math.abs(h));
			var target = document.getElementById('status_selection');
			if (target.textContent != text) {
				target.textContent = text;
			}
		};
		setInterval(() => {
			if (this.selection_seen && Date.now() - this.selection_seen > 400) {
				this.selection_seen = 0;
				document.getElementById('status_selection_item').hidden = true;
			}
		}, 300);
		//the size changes with a new / opened / resized document, not only with the mouse
		document.addEventListener('minipaint:history', () => this.show_size());
	}

	//editable zoom percentage in the status bar
	init_zoom_field() {
		var input = document.getElementById('status_zoom');
		input.value = Math.round(config.ZOOM * 100);
		var apply = () => {
			var value = parseFloat(input.value);
			if (isNaN(value)) {
				input.value = Math.round(config.ZOOM * 100);
				return;
			}
			var preview = app.GUI.GUI_preview;
			preview.set_center_zoom();
			//1 and -1 mean "one step" for zoom(), so the smallest typed value is 2 %
			preview.zoom(Math.min(5000, Math.max(2, value)));
		};
		input.addEventListener('change', apply);
		input.addEventListener('keydown', (event) => {
			if (event.key == 'Enter') {
				apply();
				input.blur();
			}
			else if (event.key == 'Escape') {
				input.value = Math.round(config.ZOOM * 100);
				input.blur();
			}
			if (event.key != 'Tab') {
				event.stopPropagation();
			}
		});
	}

	set_events() {
		var _this = this;
		var target = document.getElementById('mouse_info_mouse');

		//show width and height
		//should use canvas resize API in future
		document.addEventListener('mousemove', function (e) {
			_this.show_size();
		}, false);

		//show current mouse position
		document.getElementById('canvas_minipaint').addEventListener('mousemove', function (e) {
			var global_pos = _this.Base_layers.get_world_coords(e.offsetX, e.offsetY);
			var mouse_x = Math.ceil(global_pos.x);
			var mouse_y = Math.ceil(global_pos.y);

			mouse_x = _this.Helper.get_user_unit(mouse_x, _this.units, _this.resolution);
			mouse_y = _this.Helper.get_user_unit(mouse_y, _this.units, _this.resolution);

			target.innerHTML = mouse_x + ', ' + mouse_y;

			//color under the pointer (reading pixels is slow, so at most every 60 ms)
			var now = Date.now();
			if (now - _this.last_color_read > 60) {
				_this.last_color_read = now;
				_this.show_color(e.offsetX, e.offsetY);
			}
		}, false);
		document.getElementById('canvas_minipaint').addEventListener('mouseleave', function () {
			document.getElementById('status_color').textContent = '-';
			document.getElementById('status_color_swatch').style.background = 'transparent';
		}, false);
	}

	/**
	 * shows the color of the canvas pixel under the pointer
	 */
	show_color(x, y) {
		var canvas = document.getElementById('canvas_minipaint');
		if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
			return;
		}
		try {
			var pixel = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
			document.getElementById('status_color').textContent = pixel[0] + ', ' + pixel[1] + ', ' + pixel[2];
			document.getElementById('status_color_swatch').style.background = 'rgb(' + pixel[0] + ',' + pixel[1] + ',' + pixel[2] + ')';
		}
		catch (error) {
			//tainted canvas or no context - the value just stays unknown
		}
	}

	update_units(){
		this.units = this.Tools_settings.get_setting('default_units');
		this.resolution = this.Tools_settings.get_setting('resolution');
		this.show_size(true);
	}

	show_size(force) {
		var dpi = this.Tools_settings.get_setting('resolution');
		var current_units = this.Tools_settings.get_setting('default_units');
		if(force == undefined && this.last_width == config.WIDTH && this.last_height == config.HEIGHT && this.last_dpi == dpi && this.last_units == current_units) {
			return;
		}
		this.last_dpi = dpi;
		this.last_units = current_units;
		this.resolution = dpi;
		this.units = current_units;

		var width = this.Helper.get_user_unit(config.WIDTH, this.units, this.resolution);
		var height = this.Helper.get_user_unit(config.HEIGHT, this.units, this.resolution);

		document.getElementById('mouse_info_size').innerHTML = width + ' x ' + height;

		var resolution = this.Tools_settings.get_setting('resolution');
		document.getElementById('mouse_info_resolution').innerHTML = resolution + ' dpi';

		//show units
		var default_units = this.Tools_settings.get_setting('default_units_short');
		var targets = document.querySelectorAll('.id-mouse_info_units');
		for (var i = 0; i < targets.length; i++) {
			targets[i].innerHTML = default_units;
		}

		this.last_width = config.WIDTH;
		this.last_height = config.HEIGHT;
	}

}

export default GUI_information_class;
