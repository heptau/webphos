import config from './../config.js';
import Base_mask_tool_class from './../core/base-mask-tool.js';
import Edit_selection_class from './../modules/edit/selection.js';
import { create_mask, magic_wand_mask } from './../libs/selection-mask.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * Quick selection - paint over the object you want: the selection grows to the similar colors under the brush
 * and stops at edges. Alt subtracts. The result is a selection mask, see core/selection-mask-state.js.
 */
class Quick_select_class extends Base_mask_tool_class {

	constructor(ctx) {
		super(ctx, 'quick_select');
		this.work = null;
		this.image = null;
		this.painting = false;
		this.subtract = false;
		this.last = null;
		this.last_preview = 0;
	}

	load() {
		['mousedown', 'mousemove', 'mouseup'].forEach((type) => {
			document.addEventListener(type, (event) => {
				if (config.TOOL.name == this.name) {
					this[type](event);
				}
			});
		});
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || mouse.valid == false) {
			return;
		}
		const layer = config.layer;
		if (layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		if (layer.rotate) {
			alertify.error(t('Rotate is not supported on this type of object. Convert to raster?'));
			return;
		}
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		this.image = this.Edit_selection.layer_on_canvas(layer);
		if (this.image.width * this.image.height > 12000000) {
			alertify.error(t('The image is too large for this tool.'));
			return;
		}
		const current = this.Selection_mask.get();
		this.work = current
			? {width: current.mask.width, height: current.mask.height, data: new Uint8ClampedArray(current.mask.data)}
			: create_mask(this.image.width, this.image.height);
		this.subtract = Boolean(e.altKey);
		this.painting = true;
		this.last = {x: mouse.x, y: mouse.y};
		this.grow(this.last);
		this.update_preview(true);
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		config.need_render = true; //brush cursor
		if (this.painting == false || mouse.is_drag == false) {
			return;
		}
		const point = {x: mouse.x, y: mouse.y};
		const radius = this.radius();
		const steps = Math.floor(Math.hypot(point.x - this.last.x, point.y - this.last.y) / Math.max(2, radius / 2));
		for (let s = 1; s <= steps; s++) {
			this.grow({
				x: this.last.x + (point.x - this.last.x) * s / steps,
				y: this.last.y + (point.y - this.last.y) * s / steps,
			});
		}
		if (steps > 0) {
			this.last = point;
			this.update_preview(false);
		}
	}

	async mouseup() {
		if (this.painting == false) {
			return;
		}
		this.painting = false;
		this.Selection_mask.clear_preview();
		const work = this.work;
		this.work = null;
		this.image = null;
		const any = work.data.some((value) => value > 0);
		if (any == false) {
			this.Edit_selection.deselect();
			return;
		}
		await this.commit_mask(work, {shiftKey: false, altKey: false});
	}

	radius() {
		return Math.max(2, (parseFloat(this.getParams().size) || 40) / 2);
	}

	/**
	 * adds (or removes) the region of similar colors that is connected to the point, but only close to the brush
	 */
	grow(point) {
		const radius = this.radius();
		const tolerance = (parseFloat(this.getParams().tolerance) || 25) * 2.55;
		const region = magic_wand_mask(this.image, point.x, point.y, tolerance, true);
		const w = this.work.width;
		const h = this.work.height;
		const limit = radius * 1.5;
		for (let y = Math.max(0, Math.floor(point.y - limit)); y <= Math.min(h - 1, Math.ceil(point.y + limit)); y++) {
			for (let x = Math.max(0, Math.floor(point.x - limit)); x <= Math.min(w - 1, Math.ceil(point.x + limit)); x++) {
				if (Math.hypot(x - point.x, y - point.y) > limit || region.data[y * w + x] == 0) {
					continue;
				}
				this.work.data[y * w + x] = this.subtract ? 0 : 255;
			}
		}
	}

	update_preview(force) {
		const now = Date.now();
		if (force !== true && now - this.last_preview < 60) {
			return;
		}
		this.last_preview = now;
		this.Selection_mask.set_preview(this.work, () => this.painting);
		config.need_render = true;
	}

	render_overlay(ctx) {
		this.render_mask_overlay(ctx);
		const mouse = config.mouse;
		if (mouse && mouse.valid) {
			const radius = this.radius();
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
		this.painting = false;
		this.work = null;
		this.image = null;
		this.Selection_mask.clear_preview();
	}
}

export default Quick_select_class;
