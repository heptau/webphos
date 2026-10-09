import config from './../config.js';
import Base_mask_tool_class from './../core/base-mask-tool.js';
import Edit_selection_class from './../modules/edit/selection.js';
import app from './../app.js';
import { create_mask, mask_bounds, paint_mask_line } from './../libs/selection-mask.js';
import { serialize_layer_mask, deserialize_layer_mask, uniform_layer_mask } from './../libs/layer-mask.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * Quick mask - paint the selection with a brush. The current selection is the starting point, a stroke adds
 * to it (or subtracts when "Subtract" is on or Alt is held). Toggle with Q (Select > Quick Mask).
 * The result is stored as a selection mask, see core/selection-mask-state.js.
 *
 * With the target "Layer mask" the same brush paints the mask of the active layer instead: a stroke reveals
 * the layer (Subtract or Alt hides it), and a layer without a mask gets one that reveals everything.
 */
class Quick_mask_class extends Base_mask_tool_class {

	constructor(ctx) {
		super(ctx, 'quick_mask');
		this.work = null; //mask being painted
		this.overlay = null; //canvas showing the mask while painting
		this.mode = 'add';
		this.last = null;
		this.painting = false;
		this.layer_target = null; //layer whose mask is being painted (target "Layer mask")
		this.original_mask = null;
		this.original_enabled = undefined;
	}

	load() {
		document.addEventListener('mousedown', (event) => {
			if (config.TOOL.name == this.name) {
				this.mousedown(event);
			}
		});
		document.addEventListener('mousemove', (event) => {
			if (config.TOOL.name == this.name) {
				this.mousemove(event);
			}
		});
		document.addEventListener('mouseup', (event) => {
			if (config.TOOL.name == this.name) {
				this.mouseup(event);
			}
		});
	}

	is_layer_mask_target(params) {
		const target = params.target && params.target.value !== undefined ? params.target.value : params.target;
		return target === 'Layer mask';
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || mouse.valid == false) {
			return;
		}
		if (this.is_layer_mask_target(this.getParams())) {
			this.start_layer_mask(e, mouse);
			return;
		}
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const params = this.getParams();
		const current = this.Selection_mask.get();
		this.work = current ? {width: current.mask.width, height: current.mask.height, data: new Uint8ClampedArray(current.mask.data)}
			: create_mask(config.WIDTH, config.HEIGHT);
		this.mode = (Boolean(params.subtract) != Boolean(e.altKey)) ? 'subtract' : 'add';
		this.painting = true;

		this.overlay = document.createElement('canvas');
		this.overlay.width = this.work.width;
		this.overlay.height = this.work.height;
		this.update_overlay({x: 0, y: 0, width: this.work.width, height: this.work.height});

		this.last = {x: mouse.x, y: mouse.y};
		this.paint(this.last, this.last);
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		config.need_render = true; //brush cursor
		if (this.painting == false || mouse.is_drag == false) {
			return;
		}
		if (this.layer_target) {
			this.paint_layer_mask({x: mouse.x, y: mouse.y});
			return;
		}
		const point = {x: mouse.x, y: mouse.y};
		this.paint(this.last, point);
		this.last = point;
	}

	async mouseup() {
		if (this.painting == false) {
			return;
		}
		if (this.layer_target) {
			this.finish_layer_mask();
			return;
		}
		this.painting = false;
		const work = this.work;
		this.work = null;
		this.overlay = null;
		this.last = null;

		if (mask_bounds(work) == null) {
			//everything was subtracted
			if (this.Edit_selection == null) {
				this.Edit_selection = new Edit_selection_class();
			}
			this.Edit_selection.deselect();
			return;
		}
		await this.commit_mask(work, {shiftKey: false, altKey: false});
	}

	/**
	 * Starts painting the mask of the active layer
	 */
	start_layer_mask(e, mouse) {
		const layer = config.layer;
		if (layer == null || layer.type == null || !(layer.width > 0) || !(layer.height > 0)) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		if (layer.rotate) {
			alertify.error(t('Rotate is not supported on this type of object. Convert to raster?'));
			return;
		}
		const params = this.getParams();
		this.layer_target = layer;
		this.original_mask = layer.mask;
		this.original_enabled = layer.mask_enabled;
		this.work = deserialize_layer_mask(layer.mask) || uniform_layer_mask(layer, 255);
		this.mode = (Boolean(params.subtract) != Boolean(e.altKey)) ? 'hide' : 'reveal';
		this.painting = true;
		this.last = this.to_layer_position(mouse, layer);
		this.paint_layer_mask({x: mouse.x, y: mouse.y}, true);
	}

	/**
	 * Canvas position -> position in the mask of the layer
	 */
	to_layer_position(point, layer) {
		return {
			x: (point.x - layer.x) * this.work.width / layer.width,
			y: (point.y - layer.y) * this.work.height / layer.height,
		};
	}

	paint_layer_mask(point, first) {
		const layer = this.layer_target;
		const params = this.getParams();
		const radius = Math.max(0.5, (parseFloat(params.size) || 30) / 2) * this.work.width / layer.width;
		const softness = (parseFloat(params.softness) || 0) / 100;
		const to = this.to_layer_position(point, layer);
		paint_mask_line(this.work, first ? to : this.last, to, radius, softness, this.mode == 'hide' ? 'subtract' : 'add');
		this.last = to;

		//live result: the layer is shown through the mask being painted
		layer.mask = serialize_layer_mask(this.work);
		layer.mask_enabled = true;
		config.need_render = true;
	}

	finish_layer_mask() {
		const layer = this.layer_target;
		const work = this.work;
		this.painting = false;
		this.layer_target = null;
		this.work = null;
		this.last = null;

		//put the original mask back, so undo returns to it
		const painted = serialize_layer_mask(work);
		layer.mask = this.original_mask;
		layer.mask_enabled = this.original_enabled;
		app.State.do_action(
			new app.Actions.Bundle_action('layer_mask', 'Paint Layer Mask', [
				new app.Actions.Update_layer_action(layer.id, {mask: painted, mask_enabled: true}),
			])
		);
	}

	paint(from, to) {
		const params = this.getParams();
		const radius = Math.max(0.5, (parseFloat(params.size) || 30) / 2);
		const softness = (parseFloat(params.softness) || 0) / 100;
		const dirty = paint_mask_line(this.work, from, to, radius, softness, this.mode);
		if (dirty) {
			this.update_overlay(dirty);
		}
		config.need_render = true;
	}

	/**
	 * Redraws a part of the overlay (green tint = selected) from the mask being painted
	 */
	update_overlay(rect) {
		const ctx = this.overlay.getContext('2d');
		const image = ctx.createImageData(rect.width, rect.height);
		for (let y = 0; y < rect.height; y++) {
			for (let x = 0; x < rect.width; x++) {
				const value = this.work.data[(rect.y + y) * this.work.width + rect.x + x];
				const i = (y * rect.width + x) * 4;
				image.data[i + 1] = 255;
				image.data[i + 3] = Math.round(value * 0.3);
			}
		}
		ctx.putImageData(image, rect.x, rect.y);
	}

	render_overlay(ctx) {
		if (this.painting && this.overlay) {
			ctx.drawImage(this.overlay, 0, 0);
		}
		else {
			this.render_mask_overlay(ctx);
		}

		//brush outline
		const mouse = config.mouse;
		if (mouse && mouse.valid) {
			const radius = Math.max(0.5, (parseFloat(this.getParams().size) || 30) / 2);
			ctx.save();
			ctx.lineWidth = 2 / config.ZOOM;
			ctx.strokeStyle = 'rgb(255, 255, 255)';
			ctx.beginPath();
			ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.lineWidth = 1 / config.ZOOM;
			ctx.strokeStyle = 'rgb(0, 0, 0)';
			ctx.beginPath();
			ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
	}

	on_switch_keep_selection() {
		if (this.layer_target) {
			this.layer_target.mask = this.original_mask;
			this.layer_target.mask_enabled = this.original_enabled;
			this.layer_target = null;
		}
		this.painting = false;
		this.work = null;
		this.overlay = null;
	}
}

export default Quick_mask_class;
