import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { dodgeBurn } from './../libs/adjustments.js';
import Helper_class from './../libs/helpers.js';
import { t } from '../modules/tools/translate.js';

/**
 * Dodge / Burn tool - paints lighter (dodge) or darker (burn) areas; every dab adds a little exposure.
 */
class Dodge_burn_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'dodge_burn';
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
		this.started = false;
		this.last = null; //last dab position in canvas coordinates
	}

	load() {
		this.default_events();
	}

	default_dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);

		//mouse cursor
		var mouse = this.get_mouse_info(event);
		var params = this.getParams();
		this.show_mouse_cursor(mouse.x, mouse.y, params.size, 'circle');
	}

	mousedown(e) {
		this.started = false;
		var mouse = this.get_mouse_info(e);
		var params = this.getParams();
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
		this.tmpCanvasCtx = this.tmpCanvas.getContext("2d");
		this.tmpCanvas.width = config.layer.width_original;
		this.tmpCanvas.height = config.layer.height_original;
		this.tmpCanvasCtx.drawImage(config.layer.link, 0, 0);

		this.last = {x: mouse.x, y: mouse.y};
		this.dab(mouse, params);

		//register tmp canvas for faster redraw
		config.layer.link_canvas = this.tmpCanvas;
		config.need_render = true;
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		var params = this.getParams();
		if (mouse.is_drag == false || mouse.click_valid == false || this.started == false) {
			return;
		}
		//interpolate between the last and the current position, so fast movements leave no gaps
		var spacing = Math.max(1, params.size / 4);
		var distance = Math.hypot(mouse.x - this.last.x, mouse.y - this.last.y);
		var steps = Math.max(1, Math.ceil(distance / spacing));
		var from = this.last;
		for (var s = 1; s <= steps; s++) {
			var next = {x: from.x + (mouse.x - from.x) * s / steps, y: from.y + (mouse.y - from.y) * s / steps};
			this.dab(next, params);
			this.last = next;
		}
		config.need_render = true;
	}

	mouseup(e) {
		if (this.started == false) {
			return;
		}
		this.started = false;
		delete config.layer.link_canvas;

		app.State.do_action(
			new app.Actions.Bundle_action('dodge_burn_tool', 'Dodge/Burn Tool', [
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
	 * One brush dab at the mouse position
	 */
	dab(mouse, params) {
		var ctx = this.tmpCanvasCtx;
		var mouse_x = this.adaptSize(Math.round(mouse.x) - config.layer.x, 'width');
		var mouse_y = this.adaptSize(Math.round(mouse.y) - config.layer.y, 'height');
		var size_w = this.adaptSize(params.size, 'width');
		var size_h = this.adaptSize(params.size, 'height');

		var center_x = Math.round(mouse_x - Math.round(size_w / 2));
		var center_y = Math.round(mouse_y - Math.round(size_h / 2));
		mouse_x = Math.round(mouse_x);
		mouse_y = Math.round(mouse_y);

		var imageData = ctx.getImageData(center_x, center_y, size_w, size_h);
		var filtered = dodgeBurn(imageData, {
			mode: params.burn ? 'burn' : 'dodge',
			exposure: params.exposure,
		});
		this.Helper.image_round(ctx, mouse_x, mouse_y, size_w, size_h, filtered, params.anti_aliasing);
	}

}
export default Dodge_burn_class;
