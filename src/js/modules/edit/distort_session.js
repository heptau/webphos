import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Base_tools_class from './../../core/base-tools.js';
import {
	quad_bounds, warp_to_quad, is_valid_quad, handles_for, handle_position, find_handle, drag_handle, DISTORT_MODES,
} from './../../libs/perspective.js';
import { t } from '../tools/translate.js';

const MAX_SIDE = 8192;
const HANDLE_SIZE = 8; //screen pixels
const REACH = 12; //screen pixels

let instance = null;

/**
 * Skew, Perspective and Distort with the mouse (Edit > Skew / Perspective / Distort): handles lie on the picture of the
 * layer; drag a corner (or, for Skew, an edge) and the picture follows. A bar at the top changes the mode and ends the
 * session: Enter or Apply makes it, Escape or Cancel throws it away. The picture is shown on a smaller copy while
 * the handles are dragged and made in the full size at the end.
 */
class Edit_distort_session_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;
		this.active = false;
		this.pointer = new Base_tools_class(); //only for the position of the mouse on the picture
	}

	/**
	 * @param {'skew'|'perspective'|'distort'} mode
	 */
	start(mode) {
		if (this.active) {
			this.set_mode(mode);
			return;
		}
		const layer = config.layer;
		if (layer == null || layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		if (layer.rotate) {
			alertify.error(t('This does not work on a rotated layer. Turn it back to 0° first.'));
			return;
		}
		if (layer.mask) {
			alertify.error(t('Apply or delete the layer mask first.'));
			return;
		}
		this.layer = layer;
		this.w = Math.max(1, Math.round(layer.width));
		this.h = Math.max(1, Math.round(layer.height));

		//the picture as it is shown on the canvas (also when the layer was stretched)
		this.full = document.createElement('canvas');
		this.full.width = this.w;
		this.full.height = this.h;
		this.full.getContext('2d').drawImage(layer.link, 0, 0, this.w, this.h);

		//a smaller copy for the preview
		this.scale = Math.min(1, 500 / Math.max(this.w, this.h));
		const small = document.createElement('canvas');
		small.width = Math.max(1, Math.round(this.w * this.scale));
		small.height = Math.max(1, Math.round(this.h * this.scale));
		small.getContext('2d').drawImage(this.full, 0, 0, small.width, small.height);
		this.small_image = small.getContext('2d').getImageData(0, 0, small.width, small.height);

		this.saved = {x: layer.x, y: layer.y, width: layer.width, height: layer.height, link_canvas: layer.link_canvas};
		this.origin = {x: layer.x, y: layer.y}; //the shape is measured from here
		this.mode = DISTORT_MODES.includes(mode) ? mode : 'distort';
		this.reset_quad();
		this.dragging = null;
		this.active = true;

		this.on_down = (event) => this.pointer_down(event);
		this.on_move = (event) => this.pointer_move(event);
		this.on_up = () => this.pointer_up();
		this.on_key = (event) => this.key_down(event);
		document.addEventListener('mousedown', this.on_down, true);
		document.addEventListener('mousemove', this.on_move, true);
		document.addEventListener('mouseup', this.on_up, true);
		document.addEventListener('keydown', this.on_key, true);
		config.view_overlay = (ctx) => this.draw(ctx);

		this.show_bar();
		config.need_render = true;
	}

	reset_quad() {
		this.quad = [[0, 0], [this.w, 0], [this.w, this.h], [0, this.h]];
		this.show_preview();
	}

	set_mode(mode) {
		if (DISTORT_MODES.includes(mode)) {
			this.mode = mode;
			this.update_bar();
			config.need_render = true;
		}
	}

	/**
	 * The layer shows the shape (made from the smaller copy)
	 */
	show_preview() {
		const layer = this.layer;
		if (is_valid_quad(this.quad) == false) {
			return;
		}
		const scaled = this.quad.map((c) => [c[0] * this.scale, c[1] * this.scale]);
		const result = warp_to_quad(this.small_image, scaled);
		if (result == null) {
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.width = result.image.width;
		canvas.height = result.image.height;
		canvas.getContext('2d').putImageData(new ImageData(result.image.data, canvas.width, canvas.height), 0, 0);
		layer.link_canvas = canvas;
		layer.x = this.origin.x + result.x / this.scale;
		layer.y = this.origin.y + result.y / this.scale;
		layer.width = canvas.width / this.scale;
		layer.height = canvas.height / this.scale;
		config.need_render = true;
	}

	/**
	 * @returns {{x: number, y: number}} the position of the mouse on the picture, measured from the layer's own corner
	 */
	local_point(event) {
		const point = this.pointer.get_mouse_coordinates_from_event(event);
		return {x: point.x - this.origin.x, y: point.y - this.origin.y};
	}

	on_canvas(event) {
		return event.target && (event.target.id == 'canvas_minipaint' || event.target.id == 'main_wrapper');
	}

	pointer_down(event) {
		if (!this.on_canvas(event) || event.button !== 0) {
			return;
		}
		//the tools do not get the click while the session is on
		event.stopImmediatePropagation();
		event.preventDefault();
		const point = this.local_point(event);
		const handle = find_handle(this.quad, this.mode, point, REACH / (config.ZOOM || 1));
		if (handle) {
			this.dragging = {handle, point, quad: this.quad.map((c) => [c[0], c[1]])};
		}
	}

	pointer_move(event) {
		if (this.dragging == null) {
			return;
		}
		event.stopImmediatePropagation();
		const point = this.local_point(event);
		const next = drag_handle(this.dragging.quad, this.mode, this.dragging.handle, point.x - this.dragging.point.x, point.y - this.dragging.point.y);
		if (is_valid_quad(next)) {
			this.quad = next;
			if (!this.scheduled) {
				this.scheduled = true;
				requestAnimationFrame(() => {
					this.scheduled = false;
					if (this.active) {
						this.show_preview();
					}
				});
			}
		}
		config.need_render = true;
	}

	pointer_up() {
		if (this.dragging) {
			this.dragging = null;
			this.show_preview();
		}
	}

	key_down(event) {
		if (document.getElementById('popups').children.length > 0) {
			return;
		}
		if (event.key == 'Enter') {
			event.preventDefault();
			event.stopImmediatePropagation();
			this.apply();
		}
		else if (event.key == 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			this.cancel();
		}
	}

	/**
	 * the outline of the shape and its handles
	 */
	draw(ctx) {
		if (!this.active) {
			return;
		}
		const scale = 1 / (config.ZOOM || 1);
		const points = this.quad.map((c) => ({x: this.origin.x + c[0], y: this.origin.y + c[1]}));
		ctx.save();
		ctx.beginPath();
		points.forEach((p, i) => (i == 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.lineWidth = 3 * scale;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.stroke();
		ctx.lineWidth = scale;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		handles_for(this.mode).forEach((handle) => {
			const p = handle_position(this.quad, handle);
			const size = HANDLE_SIZE * scale;
			const x = this.origin.x + p.x - size / 2;
			const y = this.origin.y + p.y - size / 2;
			ctx.fillStyle = this.dragging && this.dragging.handle == handle ? '#0a84ff' : '#ffffff';
			ctx.fillRect(x, y, size, size);
			ctx.lineWidth = scale;
			ctx.strokeStyle = '#222222';
			ctx.strokeRect(x, y, size, size);
		});
		ctx.restore();
	}

	finish() {
		this.active = false;
		document.removeEventListener('mousedown', this.on_down, true);
		document.removeEventListener('mousemove', this.on_move, true);
		document.removeEventListener('mouseup', this.on_up, true);
		document.removeEventListener('keydown', this.on_key, true);
		config.view_overlay = null;
		this.dragging = null;
		if (this.bar) {
			this.bar.remove();
			this.bar = null;
		}
	}

	restore() {
		const layer = this.layer;
		layer.x = this.saved.x;
		layer.y = this.saved.y;
		layer.width = this.saved.width;
		layer.height = this.saved.height;
		if (this.saved.link_canvas) {
			layer.link_canvas = this.saved.link_canvas;
		}
		else {
			delete layer.link_canvas;
		}
		config.need_render = true;
	}

	cancel() {
		if (!this.active) {
			return;
		}
		this.finish();
		this.restore();
	}

	/**
	 * The numbers dialog of the same mode (the shape made so far is dropped)
	 */
	numbers() {
		const mode = this.mode;
		this.cancel();
		app.GUI.run_target(`edit/transform.${mode}_numbers`);
	}

	apply() {
		if (!this.active) {
			return;
		}
		const quad = this.quad;
		const layer = this.layer;
		const origin = this.origin;
		const full = this.full;
		const title = this.mode == 'skew' ? 'Skew' : (this.mode == 'perspective' ? 'Perspective' : 'Distort');
		this.finish();
		this.restore();
		const bounds = quad_bounds(quad);
		if (bounds.width > MAX_SIDE || bounds.height > MAX_SIDE) {
			alertify.error(t('The result would be too big.'));
			return;
		}
		const result = warp_to_quad(full.getContext('2d').getImageData(0, 0, full.width, full.height), quad);
		if (result == null) {
			alertify.error(t('The corners make a shape that folds over itself.'));
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.width = result.image.width;
		canvas.height = result.image.height;
		canvas.getContext('2d').putImageData(new ImageData(result.image.data, canvas.width, canvas.height), 0, 0);
		return app.State.do_action(
			new app.Actions.Bundle_action('distort_layer', title, [
				new app.Actions.Update_layer_image_action(canvas, layer.id),
				new app.Actions.Update_layer_action(layer.id, {
					x: Math.round(origin.x + result.x),
					y: Math.round(origin.y + result.y),
					width: canvas.width,
					height: canvas.height,
					width_original: canvas.width,
					height_original: canvas.height,
				}),
			])
		);
	}

	/**
	 * the bar at the top: the three modes and the buttons that end the session
	 */
	show_bar() {
		const bar = document.createElement('div');
		bar.className = 'distort_bar';
		bar.setAttribute('role', 'toolbar');
		bar.setAttribute('aria-label', t('Distort'));
		const button = (text, handler, mode) => {
			const element = document.createElement('button');
			element.type = 'button';
			element.textContent = t(text);
			if (mode) {
				element.dataset.mode = mode;
				element.setAttribute('aria-pressed', 'false');
			}
			element.addEventListener('click', handler);
			bar.appendChild(element);
			return element;
		};
		button('Distort', () => this.set_mode('distort'), 'distort');
		button('Perspective', () => this.set_mode('perspective'), 'perspective');
		button('Skew', () => this.set_mode('skew'), 'skew');
		const divider = document.createElement('span');
		divider.className = 'distort_bar_divider';
		bar.appendChild(divider);
		button('Reset', () => this.reset_quad());
		button('Numbers', () => this.numbers());
		button('Cancel', () => this.cancel());
		const apply = button('Apply', () => this.apply());
		apply.className = 'primary';
		document.body.appendChild(bar);
		this.bar = bar;
		this.update_bar();
	}

	update_bar() {
		if (!this.bar) {
			return;
		}
		this.bar.querySelectorAll('button[data-mode]').forEach((element) => {
			element.setAttribute('aria-pressed', element.dataset.mode == this.mode ? 'true' : 'false');
		});
	}
}

export default Edit_distort_session_class;
