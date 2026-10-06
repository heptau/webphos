import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './base-tools.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * Base for tools that edit pixels of the active image layer along the mouse stroke
 * (healing, red eye, background eraser...). The stroke is interpolated, one "stamp" per step.
 * Result is one undo step (Update_layer_image_action).
 *
 * Subclass: set `this.name`, `this.history_name`, implement stamp(ctx, position, size, params)
 * and optionally begin(ctx, position, params) / end().
 */
class Base_pixel_tool_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
		this.started = false;
		this.last = null;
		this.history_name = 'Pixel Tool';
		this.spacing_factor = 4;
	}

	load() {
		this.default_events();
	}

	default_dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);

		var mouse = this.get_mouse_info(event);
		var params = this.getParams();
		if (params.size) {
			this.show_mouse_cursor(mouse.x, mouse.y, params.size, 'circle');
		}
	}

	/**
	 * mouse position in pixels of the layer image
	 */
	to_layer_position(mouse) {
		return {
			x: this.adaptSize(Math.round(mouse.x) - config.layer.x, 'width'),
			y: this.adaptSize(Math.round(mouse.y) - config.layer.y, 'height'),
		};
	}

	/**
	 * runs fn on the pixels around the position: fn(image, local_x, local_y) edits the image in place
	 *
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {{x: number, y: number}} position center in layer pixels
	 * @param {number} radius how far around the position the function needs the pixels
	 * @param {function} fn
	 */
	with_region(ctx, position, radius, fn) {
		var left = Math.max(0, Math.floor(position.x - radius));
		var top = Math.max(0, Math.floor(position.y - radius));
		var right = Math.min(ctx.canvas.width, Math.ceil(position.x + radius));
		var bottom = Math.min(ctx.canvas.height, Math.ceil(position.y + radius));
		if (right <= left || bottom <= top) {
			return;
		}
		var image = ctx.getImageData(left, top, right - left, bottom - top);
		fn(image, position.x - left, position.y - top);
		ctx.putImageData(image, left, top);
	}

	mousedown(e) {
		this.started = false;
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		if (config.layer.rotate || 0 > 0) {
			alertify.error(t('Erase on rotate object is disabled. Please rasterize first.'));
			return;
		}
		this.started = true;

		this.tmpCanvas = document.createElement('canvas');
		this.tmpCanvasCtx = this.tmpCanvas.getContext('2d', {willReadFrequently: true});
		this.tmpCanvas.width = config.layer.width_original;
		this.tmpCanvas.height = config.layer.height_original;
		this.tmpCanvasCtx.drawImage(config.layer.link, 0, 0);

		var params = this.getParams();
		this.last = this.to_layer_position(mouse);
		if (this.begin) {
			this.begin(this.tmpCanvasCtx, this.last, params);
		}
		//the first click already does something
		this.stamp(this.tmpCanvasCtx, this.last, Math.max(1, this.adaptSize(params.size || 20, 'width')), params);

		//register tmp canvas for faster redraw
		config.layer.link_canvas = this.tmpCanvas;
		config.need_render = true;
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false || this.started == false || this.single_click) {
			return;
		}
		var params = this.getParams();
		var position = this.to_layer_position(mouse);
		var size = Math.max(1, this.adaptSize(params.size || 20, 'width'));
		var spacing = Math.max(1, size / this.spacing_factor);
		var distance = Math.hypot(position.x - this.last.x, position.y - this.last.y);
		var steps = Math.floor(distance / spacing);
		for (var s = 1; s <= steps; s++) {
			var next = {
				x: this.last.x + (position.x - this.last.x) * s / steps,
				y: this.last.y + (position.y - this.last.y) * s / steps,
			};
			this.stamp(this.tmpCanvasCtx, next, size, params);
		}
		if (steps > 0) {
			this.last = position;
		}
		config.need_render = true;
	}

	mouseup() {
		if (this.started == false) {
			return;
		}
		this.started = false;
		delete config.layer.link_canvas;
		if (this.end) {
			this.end();
		}

		app.State.do_action(
			new app.Actions.Bundle_action(this.name + '_tool', this.history_name, [
				new app.Actions.Update_layer_image_action(this.tmpCanvas)
			])
		);

		this.tmpCanvas.width = 1;
		this.tmpCanvas.height = 1;
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
	}
}

export default Base_pixel_tool_class;
