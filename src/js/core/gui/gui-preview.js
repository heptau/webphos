/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import { fit_zoom_percent } from './../../libs/zoom-fit.js';
import { is_transformed, screen_delta_to_picture } from './../../libs/view-transform.js';
import config from './../../config.js';
import Base_layers_class from './../base-layers.js';
import zoomView from './../../libs/zoomView.js';
import Helper_class from './../../libs/helpers.js';

let instance = null;

const template = `
	<div class="canvas_preview_wrapper">
		<div class="transparent-grid" id="canvas_preview_background"></div>
		<canvas width="176" height="100" class="transparent" id="canvas_preview"></canvas>
	</div>
	<div class="canvas_preview_details">
		<div class="details">
			<button title="Zoom out" class="layer_add trn" id="zoom_less"">-</button>
			<button title="Reset zoom level"  class="layer_add trn" id="zoom_100">100%</button>
			<button title="Zoom in" class="layer_add trn" id="zoom_more"">+</button>
			<button title="Fit window" class="layer_add trn" id="zoom_fit">Fit</button>
		</div>
		<input id="zoom_range" type="range" value="100" min="50" max="1000" step="50" />
	</div>
`;

/**
 * GUI class responsible for rendering preview on right sidebar
 */
class GUI_preview_class {

	constructor(GUI_class) {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;
		document.getElementById('toggle_preview').innerHTML = template;

		// preview mini window size on right sidebar
		this.PREVIEW_BOX = {w: 176, h: 100};
		this.PREVIEW_SIZE = {w: 176, h: 100};
		this.size_for = null;

		this.canvas_offset = {x: 0, y: 0};

		this.zoom_data = {
			x: 0,
			y: 0,
			move_pos: null,
		};

		this.mouse_pressed = false;
		this.canvas_preview = null;
		if (GUI_class != undefined) {
			this.GUI = GUI_class;
		}
		this.Base_layers = new Base_layers_class();
	}

	render_main_preview() {
		this.canvas_preview = document.getElementById("canvas_preview")
			.getContext("2d");

		this.prepare_canvas();
		config.need_render = true;
		this.set_events();
	}

	set_events() {
		let is_touch = false;

		document.addEventListener('mousedown', () => {
			this.mouse_pressed = true;
		}, false);
		document.addEventListener('mouseup', () => {
			this.mouse_pressed = false;
		}, false);
		document.addEventListener('touchstart', () => {
			this.mouse_pressed = true;
		}, false);
		document.addEventListener('touchend', () => {
			this.mouse_pressed = false;
		}, false);
		document.getElementById('zoom_range').addEventListener('input', (event) => {
			this.set_center_zoom();
			this.zoom(event.currentTarget.value);
		}, false);
		document.getElementById('zoom_range').addEventListener('change', (event) => {
			//IE11
			if (event.currentTarget.value != config.ZOOM * 100) {
				this.set_center_zoom();
				this.zoom(event.currentTarget.value);
			}
		}, false);
		document.getElementById('zoom_less').addEventListener('click', () => {
			this.set_center_zoom();
			this.zoom(-1);
		}, false);
		document.getElementById('zoom_100').addEventListener('click', () => {
			this.zoom(100);
		}, false);
		document.getElementById('zoom_more').addEventListener('click', () => {
			this.set_center_zoom();
			this.zoom(+1);
		}, false);
		document.getElementById('zoom_fit').addEventListener('click', () => {
			this.zoom_auto();
		}, false);
		document.getElementById('main_wrapper').addEventListener('wheel', (e) => {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey || e.altKey) {
				//Ctrl/Cmd/Alt + scroll (or trackpad pinch) - zoom, as in Photoshop
				this.zoom_data.x = e.offsetX;
				this.zoom_data.y = e.offsetY;
				const delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail || -e.deltaY)));
				if (delta > 0)
					this.zoom(+1, e);
				else
					this.zoom(-1, e);
			}
			else {
				//plain scroll - move the image (line / page delta modes are converted to pixels)
				const unit = e.deltaMode == 1 ? 16 : (e.deltaMode == 2 ? config.visible_height || 600 : 1);
				let dx = e.deltaX * unit;
				let dy = e.deltaY * unit;
				if (e.shiftKey && dx == 0) {
					dx = dy;
					dy = 0;
				}
				this.pan(-dx, -dy);
			}
		}, {passive: false});
		this.set_hand_events();
		window.addEventListener('resize', () => {
			//resize
			config.need_render = true;
		}, false);
		document.getElementById("canvas_preview").addEventListener('mousedown', (e) => {
			if(is_touch)
				return;
			this.set_zoom_position(e);
		}, false);
		document.getElementById("canvas_preview").addEventListener('mousemove', (e) => {
			if(is_touch)
				return;
			if (this.mouse_pressed == false)
				return;
			this.set_zoom_position(e);
		}, false);

		document.getElementById("canvas_preview").addEventListener('touchstart', (e) => {
			is_touch = true;

			//calc canvas position offset
			const bodyRect = document.body.getBoundingClientRect();
			const canvas_el = document.getElementById("canvas_preview").getBoundingClientRect();
			this.canvas_offset.x = canvas_el.left - bodyRect.left;
			this.canvas_offset.y = canvas_el.top - bodyRect.top;

			//change zoom offset
			this.set_zoom_position(e);
		});
		document.getElementById("canvas_preview").addEventListener('touchmove', (e) => {
			//change zoom offset
			if (this.mouse_pressed == false)
				return;
			this.set_zoom_position(e);
		});
	}

	/**
	 * moves the visible area
	 *
	 * @param {number} dx screen pixels
	 * @param {number} dy screen pixels
	 */
	pan(dx, dy) {
		if (is_transformed(config.view)) {
			//the mouse moves on the screen, the picture is turned: the movement is turned back
			const moved = screen_delta_to_picture(dx, dy, config.view);
			dx = moved.x;
			dy = moved.y;
		}
		zoomView.move(dx, dy);
		config.need_render = true;
	}

	/**
	 * hold Space and drag to move the image (hand tool, as in Photoshop)
	 */
	set_hand_events() {
		const helper = new Helper_class();
		const wrapper = document.getElementById('main_wrapper');
		let space = false;
		let dragging = null;

		document.addEventListener('keydown', (e) => {
			if (e.code != 'Space' || e.repeat && space) {
				if (e.code == 'Space' && space) {
					e.preventDefault();
				}
				return;
			}
			const target = e.target;
			const on_canvas_area = target === document.body || (target.closest && target.closest('#main_wrapper'));
			const interactive = target.closest && target.closest('button, a, select, [role="button"], [role="tab"], [role="menuitem"], [contenteditable="true"]');
			if (!on_canvas_area || interactive || helper.is_input(target) || e.ctrlKey || e.metaKey || e.altKey
				|| document.getElementById('popups').children.length > 0) {
				return;
			}
			space = true;
			wrapper.classList.add('hand_mode');
			e.preventDefault();
		}, false);
		document.addEventListener('keyup', (e) => {
			if (e.code == 'Space') {
				space = false;
				wrapper.classList.remove('hand_mode');
			}
		}, false);
		window.addEventListener('blur', () => {
			space = false;
			dragging = null;
			wrapper.classList.remove('hand_mode', 'hand_dragging');
		}, false);

		wrapper.addEventListener('mousedown', (e) => {
			if (space == false || e.button !== 0) {
				return;
			}
			//capture phase: tools must not receive this click
			e.preventDefault();
			e.stopPropagation();
			dragging = {x: e.clientX, y: e.clientY};
			wrapper.classList.add('hand_dragging');
		}, true);
		document.addEventListener('mousemove', (e) => {
			if (dragging == null) {
				return;
			}
			this.pan(e.clientX - dragging.x, e.clientY - dragging.y);
			dragging.x = e.clientX;
			dragging.y = e.clientY;
		}, false);
		document.addEventListener('mouseup', () => {
			dragging = null;
			wrapper.classList.remove('hand_dragging');
		}, false);
	}

	/**
	 * the preview has the proportions of the image (fits into 176 x 100 and is centered), so the image is not stretched
	 */
	update_preview_size() {
		if (this.size_for && this.size_for[0] == config.WIDTH && this.size_for[1] == config.HEIGHT) {
			return false;
		}
		this.size_for = [config.WIDTH, config.HEIGHT];
		const scale = Math.min(this.PREVIEW_BOX.w / config.WIDTH, this.PREVIEW_BOX.h / config.HEIGHT);
		const w = Math.max(1, Math.round(config.WIDTH * scale));
		const h = Math.max(1, Math.round(config.HEIGHT * scale));
		this.PREVIEW_SIZE = {w, h};

		const canvas = document.getElementById('canvas_preview');
		const background = document.getElementById('canvas_preview_background');
		if (canvas) {
			canvas.width = w;
			canvas.height = h;
			canvas.style.display = 'block';
			canvas.style.margin = `${Math.round((this.PREVIEW_BOX.h - h) / 2)  }px auto 0`;
		}
		if (background) {
			background.style.width = `${w  }px`;
			background.style.height = `${h  }px`;
			background.style.left = '50%';
			background.style.top = `${Math.round((this.PREVIEW_BOX.h - h) / 2)  }px`;
			background.style.transform = 'translateX(-50%)';
		}
		config.need_render = true;
		return true;
	}

	prepare_canvas() {
		this.canvas_preview.webkitImageSmoothingEnabled = false;
		this.canvas_preview.msImageSmoothingEnabled = false;
		this.canvas_preview.imageSmoothingEnabled = false;
		this.GUI.render_canvas_background('canvas_preview', 8);
	}

	render_preview_active_zone() {
		if (this.canvas_preview == undefined) {
			this.canvas_preview = document.getElementById("canvas_preview")
				.getContext("2d");
		}

		//active zone
		const visible_w = config.visible_width / config.ZOOM;
		const visible_h = config.visible_height / config.ZOOM;

		let mini_rect_w = this.PREVIEW_SIZE.w * visible_w / config.WIDTH;
		let mini_rect_h = this.PREVIEW_SIZE.h * visible_h / config.HEIGHT;

		const start_pos = this.Base_layers.get_world_coords(0, 0);
		let mini_rect_x = start_pos.x / config.WIDTH * this.PREVIEW_SIZE.w;
		let mini_rect_y = start_pos.y / config.HEIGHT * this.PREVIEW_SIZE.h;

		//validate
		mini_rect_x = Math.max(0, mini_rect_x);
		mini_rect_y = Math.max(0, mini_rect_y);
		mini_rect_w = Math.min(this.PREVIEW_SIZE.w - 1, mini_rect_w);
		mini_rect_h = Math.min(this.PREVIEW_SIZE.h - 1, mini_rect_h);
		if (mini_rect_x + mini_rect_w > this.PREVIEW_SIZE.w)
			mini_rect_x = this.PREVIEW_SIZE.w - mini_rect_w;
		if (mini_rect_y + mini_rect_h > this.PREVIEW_SIZE.h)
			mini_rect_y = this.PREVIEW_SIZE.h - mini_rect_h;

		if (mini_rect_x == 0 && mini_rect_y == 0 && mini_rect_w == this.PREVIEW_SIZE.w - 1
			&& mini_rect_h == this.PREVIEW_SIZE.h - 1) {
			//everything is visible
			return;
		}

		//draw selected area in preview canvas
		this.canvas_preview.lineWidth = 1;
		this.canvas_preview.beginPath();
		this.canvas_preview.rect(
			Math.round(mini_rect_x) + 0.5,
			Math.round(mini_rect_y) + 0.5,
			mini_rect_w,
			mini_rect_h
			);
		//thin red frame like the Navigator panel in Photoshop
		this.canvas_preview.strokeStyle = "#ff3b30";
		this.canvas_preview.lineWidth = 1.5;
		this.canvas_preview.stroke();
	}

	async zoom(recalc) {
		if (recalc != undefined) {
			//zoom-in or zoom-out
			if (recalc == 1 || recalc == -1) {
				//fix
				if (config.ZOOM > 1 && config.ZOOM < 1.5) {
					config.ZOOM = 1;
				}
				if (config.ZOOM > 0.9 && config.ZOOM < 1) {
					config.ZOOM = 1;
				}

				//calc step
				if (recalc < 0) {
					//down
					if (config.ZOOM > 3) {
						//infinity -> 300%
						config.ZOOM -= 1;
					}
					else if (config.ZOOM > 1) {
						//300% -> 100%
						config.ZOOM -= 0.5;
					}
					else if (config.ZOOM > 0.1) {
						//100% -> 10%
						config.ZOOM -= 0.1;
					}
					else {
						//10% -> 1%
						config.ZOOM -= 0.01;
					}
				}
				else {
					//up
					if (config.ZOOM < 0.1) {
						//1% -> 10%
						config.ZOOM += 0.01;
					}
					else if (config.ZOOM < 1) {
						//10% -> 100%
						config.ZOOM += 0.1;
					}
					else if (config.ZOOM < 3) {
						//100% -> 300%
						config.ZOOM += 0.5;
					}
					else {
						//300% -> more
						config.ZOOM += 1;
					}
				}
			}
			else {
				//zoom using exact value
				config.ZOOM = recalc / 100;
			}
			config.ZOOM = Math.round(config.ZOOM * 100) / 100;
			config.ZOOM = Math.max(config.ZOOM, 0.01);
			config.ZOOM = Math.min(config.ZOOM, 500);
		}

		document.getElementById("zoom_100").innerHTML = `${Math.round(config.ZOOM * 100)  }%`;
		document.getElementById("zoom_range").value = (config.ZOOM * 100);
		const status_zoom = document.getElementById('status_zoom');
		if (status_zoom && document.activeElement !== status_zoom) {
			status_zoom.value = Math.round(config.ZOOM * 100);
		}

		config.need_render = true;
		this.GUI.prepare_canvas();

		//sleep after last image import, it maybe not be finished yet
		await new Promise(r => setTimeout(r, 10));

		return true;
	}

	zoom_auto(only_increase) {
		const container = document.getElementById('main_wrapper');
		const page_w = container.clientWidth;
		const page_h = container.clientHeight;

		//the next smaller whole percent: rather a little smaller than a few pixels too big
		const percent = fit_zoom_percent(page_w, page_h, config.WIDTH, config.HEIGHT);

		if (only_increase != undefined && percent > 100) {
			return false;
		}

		this.zoom(percent);
	}

	set_center_zoom() {
		this.zoom_data.x = config.visible_width / 2;
		this.zoom_data.y = config.visible_height / 2;
	}

	set_zoom_position(event) {
		let mouse_x = event.offsetX;
		let mouse_y = event.offsetY;
		if (event.changedTouches) {
			//touch events
			event = event.changedTouches[0];

			mouse_x = event.pageX - this.canvas_offset.x;
			mouse_y = event.pageY - this.canvas_offset.y;
		}

		const visible_w = config.visible_width / config.ZOOM;
		const visible_h = config.visible_height / config.ZOOM;
		const mini_w = this.PREVIEW_SIZE.w * visible_w / config.WIDTH;
		const mini_h = this.PREVIEW_SIZE.h * visible_h / config.HEIGHT;

		const change_x = (mouse_x - mini_w / 2) / this.PREVIEW_SIZE.w * config.WIDTH;
		const change_y = (mouse_y - mini_h / 2) / this.PREVIEW_SIZE.h * config.HEIGHT;

		const zoom_data = this.zoom_data;
		zoom_data.move_pos = {};
		zoom_data.move_pos.x = change_x;
		zoom_data.move_pos.y = change_y;

		config.need_render = true;
	}

	/**
	 * moves visible area to new position.
	 *
	 * @param {int} x global offset
	 * @param {int} y global offset
	 */
	zoom_to_position(x, y) {
		const zoom_data = this.zoom_data;
		zoom_data.move_pos = {};
		zoom_data.move_pos.x = parseInt(x);
		zoom_data.move_pos.y = parseInt(y);

		config.need_render = true;
	}

}

export default GUI_preview_class;
