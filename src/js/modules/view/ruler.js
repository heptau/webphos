import config from './../../config.js';
import Helper_class from './../../libs/helpers.js';
import Base_gui_class from './../../core/base-gui.js';
import Base_layers_class from './../../core/base-layers.js';
import Tools_settings_class from './../tools/settings.js';

let instance = null;

class View_ruler_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.GUI = new Base_gui_class();
		this.Base_layers = new Base_layers_class();
		this.Tools_settings = new Tools_settings_class();
		this.Helper = new Helper_class();

		this.set_events();
	}

	set_events() {

		window.addEventListener('resize', () => {
			//resize
			this.prepare_ruler();
			this.render_ruler();
		}, false);

		this.set_marker_events();

		//drag from a ruler to create a guide (as in Photoshop)
		const ruler_top = document.getElementById('ruler_top');
		const ruler_left = document.getElementById('ruler_left');
		if (ruler_top && ruler_left) {
			ruler_top.addEventListener('mousedown', (event) => {
				this.drag_guide(event, true);
			});
			ruler_left.addEventListener('mousedown', (event) => {
				this.drag_guide(event, false);
			});
		}
	}

	/**
	 * A line on each ruler shows where the mouse is (as the rulers of Photoshop do)
	 */
	set_marker_events() {
		const middle_area = document.getElementById('middle_area');
		if (!middle_area) {
			return;
		}
		const make = (name) => {
			const marker = document.createElement('div');
			marker.className = `ruler_marker ${  name}`;
			marker.setAttribute('aria-hidden', 'true');
			middle_area.appendChild(marker);
			return marker;
		};
		this.marker_x = make('ruler_marker_x');
		this.marker_y = make('ruler_marker_y');

		document.addEventListener('mousemove', (event) => this.update_markers(event.clientX, event.clientY));
		document.addEventListener('mouseleave', () => this.hide_markers());
		window.addEventListener('blur', () => this.hide_markers());
	}

	hide_markers() {
		if (this.marker_x) {
			this.marker_x.style.display = 'none';
			this.marker_y.style.display = 'none';
		}
	}

	/**
	 * @param {number} client_x position of the mouse in the window
	 * @param {number} client_y
	 */
	update_markers(client_x, client_y) {
		const ruler_top = document.getElementById('ruler_top');
		const ruler_left = document.getElementById('ruler_left');
		const middle_area = document.getElementById('middle_area');
		if (config.ruler_active == false || !this.marker_x || !ruler_top || !ruler_left || !middle_area) {
			this.hide_markers();
			return;
		}
		//the rulers start 20 pixels from the corner of the work area, like the picture does (see layout.css)
		const rect = middle_area.getBoundingClientRect();
		const x = client_x - rect.left - 20;
		const y = client_y - rect.top - 20;
		const inside_x = x >= 0 && x <= ruler_top.width && client_y >= rect.top && client_y <= rect.bottom;
		const inside_y = y >= 0 && y <= ruler_left.height && client_x >= rect.left && client_x <= rect.right;
		this.marker_x.style.display = inside_x ? 'block' : 'none';
		this.marker_y.style.display = inside_y ? 'block' : 'none';
		if (inside_x) {
			this.marker_x.style.transform = `translateX(${Math.round(20 + x)}px)`;
		}
		if (inside_y) {
			this.marker_y.style.transform = `translateY(${Math.round(20 + y)}px)`;
		}
	}

	/**
	 * creates a guide and moves it with the mouse until the button is released,
	 * releasing over the ruler removes it again
	 *
	 * @param {MouseEvent} event
	 * @param {boolean} horizontal true for the top ruler (horizontal guide)
	 */
	drag_guide(event, horizontal) {
		let stop = null, up = null;
		if (config.ruler_active == false || event.button !== 0) {
			return;
		}
		event.preventDefault();
		const canvas = document.getElementById('canvas_minipaint');
		let guide = null;

		const position = (e) => {
			const rect = canvas.getBoundingClientRect();
			const world = this.Base_layers.get_world_coords(e.clientX - rect.left, e.clientY - rect.top);
			return Math.round(horizontal ? world.y : world.x);
		};
		const move = (e) => {
			const value = position(e);
			if (guide == null) {
				guide = horizontal ? {x: null, y: value} : {x: value, y: null};
				config.guides.push(guide);
				if (config.guides_enabled == false) {
					config.guides_enabled = true;
					this.Helper.setCookie('guides', 1);
				}
			}
			if (horizontal) {
				guide.y = value;
			}
			else {
				guide.x = value;
			}
			config.need_render = true;
		};
		const cancel = () => {
			stop();
			if (guide != null) {
				const index = config.guides.indexOf(guide);
				if (index >= 0) {
					config.guides.splice(index, 1);
				}
				config.need_render = true;
			}
		};
		const on_key = (e) => {
			if (e.key == 'Escape') {
				cancel();
			}
		};
		stop = () => {
			document.removeEventListener('mousemove', move);
			document.removeEventListener('mouseup', up);
			document.removeEventListener('keydown', on_key);
			window.removeEventListener('blur', cancel);
		};
		up = (e) => {
			stop();
			if (guide == null) {
				return;
			}
			const over = document.elementFromPoint(e.clientX, e.clientY);
			const value = horizontal ? guide.y : guide.x;
			const limit = horizontal ? config.HEIGHT : config.WIDTH;
			if ((over && (over.id == 'ruler_top' || over.id == 'ruler_left')) || value <= 0 || value > limit) {
				const index = config.guides.indexOf(guide);
				if (index >= 0) {
					config.guides.splice(index, 1);
				}
			}
			config.need_render = true;
		};
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
		document.addEventListener('keydown', on_key);
		window.addEventListener('blur', cancel);
	}

	ruler() {
		const ruler_left = document.getElementById('ruler_left');
		const ruler_top = document.getElementById('ruler_top');

		if(config.ruler_active == false){
			//activate
			config.ruler_active = true;
			document.getElementById('middle_area').classList.add('has-ruler');
			ruler_left.style.display = 'block';
			ruler_top.style.display = 'block';

			this.prepare_ruler();
			this.render_ruler();
		}
		else{
			//deactivate
			config.ruler_active = false;
			document.getElementById('middle_area').classList.remove('has-ruler');
			ruler_left.style.display = 'none';
			ruler_top.style.display = 'none';
			this.hide_markers();
		}

		this.GUI.prepare_canvas();

		config.need_render = true;
	}

	prepare_ruler(){
		if(config.ruler_active == false)
			return;

		const ruler_left = document.getElementById('ruler_left');
		const ruler_top = document.getElementById('ruler_top');
		const middle_area = document.getElementById('middle_area');

		const middle_area_width = middle_area.clientWidth;
		const middle_area_height = middle_area.clientHeight;

		ruler_left.width = 15;
		ruler_left.height = middle_area_height - 20;

		ruler_top.width = middle_area_width - 20;
		ruler_top.height = 15;
	}

	render_ruler(){
		let i, global_pos, value, text;
		if(config.ruler_active == false)
			return;

		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		const ruler_left = document.getElementById('ruler_left');
		const ruler_top = document.getElementById('ruler_top');

		const ctx_left = ruler_left.getContext("2d");
		const ctx_top = ruler_top.getContext("2d");

		const color = getComputedStyle(document.body).getPropertyValue('--text-color-muted').trim() || '#111';
		const size = 15;

		//calc step
		let step = Math.ceil(10 * config.ZOOM);
		while (step < 5) {
			step = step * 2;
		}
		while (step > 10) {
			step = Math.ceil(step / 2);
		}
		const step_big = step * 10;

		//calc begin/end point
		const begin_x = Math.max(0, ruler_top.width / 2 - config.WIDTH * config.ZOOM / 2);
		const begin_y = Math.max(0, ruler_left.height / 2 - config.HEIGHT * config.ZOOM / 2);

		const end_x = Math.min(ruler_top.width, ruler_top.width / 2 + config.WIDTH * config.ZOOM / 2);
		const end_y = Math.min(ruler_left.height, ruler_left.height / 2 + config.HEIGHT * config.ZOOM / 2);

		//left
		ctx_left.strokeStyle = color;
		ctx_left.fillStyle = color;
		ctx_left.lineWidth = 1;
		ctx_left.font = "11px Arial";

		ctx_left.clearRect(0, 0, ruler_left.width, ruler_left.height);

		ctx_left.beginPath();
		for (i = begin_y; i < end_y; i += step) {
			ctx_left.moveTo(10, i + 0.5);
			ctx_left.lineTo(size, i + 0.5);
		}
		ctx_left.stroke();

		ctx_left.beginPath();
		for (i = begin_y; i <= end_y; i += step_big) {
			ctx_left.moveTo(0, i + 0.5);
			ctx_left.lineTo(size, i + 0.5);

			global_pos = this.Base_layers.get_world_coords(0, i - begin_y);
			value = this.Helper.get_user_unit(global_pos.y, units, resolution);

			if(units == 'inches'){
				//more decimals value
				text = this.Helper.number_format(value, 1);
			}
			else{
				text = Math.ceil(value);
			}
			text = text.toString();

			//text
			for (let j = 0; j < text.length; j++) {
				const letter = text.charAt(j);
				const line_height = 10;
				ctx_left.fillText(letter, 1, i + 11 + j * line_height);
			}
		}
		ctx_left.stroke();

		//top
		ctx_top.strokeStyle = color;
		ctx_top.fillStyle = color;
		ctx_top.lineWidth = 1;
		ctx_top.font = "11px Arial";

		ctx_top.clearRect(0, 0, ruler_top.width, ruler_top.height);

		ctx_top.beginPath();
		for (i = begin_x; i < end_x; i += step) {
			ctx_top.moveTo(i + 0.5, 10);
			ctx_top.lineTo(i + 0.5, size);
		}
		ctx_top.stroke();

		ctx_top.beginPath();
		for (i = begin_x; i <= end_x; i += step_big) {
			ctx_top.moveTo(i + 0.5, 0);
			ctx_top.lineTo(i + 0.5, size);

			global_pos = this.Base_layers.get_world_coords(i - begin_x, 0);
			value = this.Helper.get_user_unit(global_pos.x, units, resolution);

			if(units == 'inches'){
				//more decimals value
				text = this.Helper.number_format(value, 1);
			}
			else{
				text = Math.ceil(value);
			}
			text = text.toString();

			//text
			ctx_top.fillText(text, i + 3, 9);
		}
		ctx_top.stroke();
	}

}

export default View_ruler_class;
