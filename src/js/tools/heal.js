import config from './../config.js';
import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { heal_spot, heal_from } from './../libs/retouch.js';
import { t } from '../modules/tools/translate.js';

/**
 * Healing brush - paint over a blemish; the texture is taken from the surroundings and adapted to their colors.
 * Source "Automatic" finds the best place around the blemish itself (like Photoshop's Spot Healing Brush, one click is
 * enough). Source "Sampled" copies from a place chosen with Alt + click (like the Healing Brush of Photoshop); every
 * stroke starts from that place and the copy follows the brush.
 */
class Heal_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'heal';
		this.history_name = 'Healing Brush';
		this.spacing_factor = 3;
		this.sample = null; //the place to copy from, in pixels of the layer
		this.offset = null; //source - brush of the current stroke
	}

	is_sampled(params) {
		const source = params.source;
		return (source && source.value !== undefined ? source.value : source) == 'Sampled';
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (e.altKey && mouse.click_valid) {
			//Alt + click chooses the place to copy from
			if (config.layer.type == 'image') {
				this.sample = this.to_layer_position(mouse);
				config.need_render = true;
			}
			return;
		}
		if (this.is_sampled(this.getParams()) && this.sample == null) {
			if (mouse.click_valid) {
				alertify.warning(t('Alt + click first to choose the place to copy from.'));
			}
			return;
		}
		super.mousedown(e);
	}

	begin(ctx, position, params) {
		this.offset = this.is_sampled(params) && this.sample
			? {x: this.sample.x - position.x, y: this.sample.y - position.y}
			: null;
	}

	stamp(ctx, position, size, params) {
		const radius = Math.max(2, size / 2);
		const match = params.match_color !== false;
		if (this.offset) {
			//the place to copy from and the spot have to be in the part that is read
			const reach = Math.ceil(radius * 1.5) + 2;
			const left = Math.max(0, Math.floor(Math.min(position.x, position.x + this.offset.x) - reach));
			const top = Math.max(0, Math.floor(Math.min(position.y, position.y + this.offset.y) - reach));
			const right = Math.min(ctx.canvas.width, Math.ceil(Math.max(position.x, position.x + this.offset.x) + reach));
			const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(position.y, position.y + this.offset.y) + reach));
			if (right <= left || bottom <= top) {
				return;
			}
			const image = ctx.getImageData(left, top, right - left, bottom - top);
			heal_from(image, position.x - left, position.y - top, radius,
				position.x + this.offset.x - left, position.y + this.offset.y - top, match);
			ctx.putImageData(image, left, top);
			return;
		}
		this.with_region(ctx, position, radius * 6.5, (image, x, y) => {
			heal_spot(image, x, y, radius, match);
		});
	}

	/**
	 * a cross marks the place to copy from
	 */
	render_overlay(ctx) {
		if (this.sample == null || !this.is_sampled(this.getParams())) {
			return;
		}
		const layer = config.layer;
		const scale = 1 / (config.ZOOM || 1);
		const x = layer.x + this.sample.x;
		const y = layer.y + this.sample.y;
		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x - 6 * scale, y);
		ctx.lineTo(x + 6 * scale, y);
		ctx.moveTo(x, y - 6 * scale);
		ctx.lineTo(x, y + 6 * scale);
		ctx.lineWidth = 3 * scale;
		ctx.strokeStyle = '#000000';
		ctx.stroke();
		ctx.lineWidth = scale;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		ctx.restore();
	}
}

export default Heal_class;
