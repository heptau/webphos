import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { smudgeBlend } from './../libs/adjustments.js';
import Helper_class from './../libs/helpers.js';
import { t } from '../modules/tools/translate.js';

/**
 * Smudge tool - drags the colors along the stroke, like a finger in wet paint.
 * Between mouse events the stroke is interpolated, so fast movements stay smooth.
 */
class Smudge_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'smudge';
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
		this.started = false;
		this.last = null; //last position in layer pixels
	}

	load() {
		this.default_events();
	}

	default_dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);

		//mouse cursor
		const mouse = this.get_mouse_info(event);
		const params = this.getParams();
		this.show_mouse_cursor(mouse.x, mouse.y, params.size, 'circle');
	}

	/**
	 * Mouse position in pixels of the layer image
	 */
	to_layer_position(mouse) {
		return {
			x: this.adaptSize(Math.round(mouse.x) - config.layer.x, 'width'),
			y: this.adaptSize(Math.round(mouse.y) - config.layer.y, 'height'),
		};
	}

	mousedown(e) {
		this.started = false;
		const mouse = this.get_mouse_info(e);
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

		//get canvas from layer
		this.tmpCanvas = document.createElement('canvas');
		this.tmpCanvasCtx = this.tmpCanvas.getContext("2d", {willReadFrequently: true});
		this.tmpCanvas.width = config.layer.width_original;
		this.tmpCanvas.height = config.layer.height_original;
		this.tmpCanvasCtx.drawImage(config.layer.link, 0, 0);

		this.last = this.to_layer_position(mouse);

		//register tmp canvas for faster redraw
		config.layer.link_canvas = this.tmpCanvas;
		config.need_render = true;
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false || this.started == false) {
			return;
		}
		const params = this.getParams();
		const position = this.to_layer_position(mouse);

		//interpolate between the last and the current position
		const size = Math.max(1, this.adaptSize(params.size, 'width'));
		const spacing = Math.max(1, size / 4);
		const distance = Math.hypot(position.x - this.last.x, position.y - this.last.y);
		const steps = Math.max(1, Math.ceil(distance / spacing));
		for (let s = 1; s <= steps; s++) {
			const next = {
				x: this.last.x + (position.x - this.last.x) * s / steps,
				y: this.last.y + (position.y - this.last.y) * s / steps,
			};
			this.smudge(this.last, next, params);
			this.last = next;
		}
		config.need_render = true;
	}

	mouseup() {
		if (this.started == false) {
			return;
		}
		this.started = false;
		delete config.layer.link_canvas;

		app.State.do_action(
			new app.Actions.Bundle_action('smudge_tool', 'Smudge Tool', [
				new app.Actions.Update_layer_image_action(this.tmpCanvas)
			])
		);

		//decrease memory
		this.tmpCanvas.width = 1;
		this.tmpCanvas.height = 1;
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
	}

	/**
	 * One step: the colors from the previous position are carried to the next one
	 */
	smudge(from, to, params) {
		const ctx = this.tmpCanvasCtx;
		const size_w = Math.max(1, this.adaptSize(params.size, 'width'));
		const size_h = Math.max(1, this.adaptSize(params.size, 'height'));
		const from_x = Math.round(from.x - Math.round(size_w / 2));
		const from_y = Math.round(from.y - Math.round(size_h / 2));
		const to_x = Math.round(to.x - Math.round(size_w / 2));
		const to_y = Math.round(to.y - Math.round(size_h / 2));

		const source = ctx.getImageData(from_x, from_y, size_w, size_h);
		const target = ctx.getImageData(to_x, to_y, size_w, size_h);
		smudgeBlend(target, source, params.strength);
		this.Helper.image_round(ctx, Math.round(to.x), Math.round(to.y), size_w, size_h, target, params.anti_aliasing);
	}

}
export default Smudge_class;
