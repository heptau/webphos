import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { polygon_mask } from './../libs/selection-mask.js';
import { patch_region, point_in_polygon, picture_to_layer, vector_to_layer } from './../libs/patch.js';
import { t } from '../modules/tools/translate.js';

//room around the part that the patch needs to find the colors of the surroundings
const MARGIN = 70;

/**
 * Patch tool - draw around a blemish, then drag the shape onto a clean place. The blemish is covered with the texture of
 * the clean place, in the colors of its own surroundings (mode Source). In mode Destination the shape is the clean
 * place and the drop place is the blemish.
 */
class Patch_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'patch';
		this.reset_state();
	}

	reset_state() {
		this.state = 'idle'; //idle, drawing, ready (shape drawn), dragging
		this.points = [];
		this.polygon = null;
		this.start = null;
		this.offset = {x: 0, y: 0};
		this.preview = null;
		this.layer_canvas = null;
		this.scheduled = false;
	}

	load() {
		this.default_events();
		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name == this.name && event.key == 'Escape' && this.state != 'idle') {
				this.reset_state();
				config.need_render = true;
			}
		});
	}

	on_leave() {
		this.reset_state();
		config.need_render = true;
		return [];
	}

	usable_layer() {
		const layer = config.layer;
		if (layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return false;
		}
		return true;
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || this.usable_layer() == false) {
			return;
		}
		if (this.state == 'ready' && point_in_polygon(mouse.x, mouse.y, this.polygon)) {
			//the shape is dragged
			this.state = 'dragging';
			this.start = {x: mouse.x, y: mouse.y};
			this.offset = {x: 0, y: 0};
			this.layer_canvas = null;
			return;
		}
		this.reset_state();
		this.state = 'drawing';
		this.points = [{x: mouse.x, y: mouse.y}];
		config.need_render = true;
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false) {
			return;
		}
		if (this.state == 'drawing') {
			const last = this.points[this.points.length - 1];
			if (Math.hypot(mouse.x - last.x, mouse.y - last.y) > 2 / (config.ZOOM || 1)) {
				this.points.push({x: mouse.x, y: mouse.y});
				config.need_render = true;
			}
		}
		else if (this.state == 'dragging') {
			this.offset = {x: Math.round(mouse.x - this.start.x), y: Math.round(mouse.y - this.start.y)};
			this.schedule_preview();
		}
	}

	mouseup() {
		if (this.state == 'drawing') {
			if (this.points.length < 6) {
				this.reset_state();
			}
			else {
				this.polygon = this.points.slice();
				this.state = 'ready';
			}
			config.need_render = true;
		}
		else if (this.state == 'dragging') {
			if (Math.abs(this.offset.x) < 2 && Math.abs(this.offset.y) < 2) {
				this.state = 'ready';
				this.preview = null;
				config.need_render = true;
				return;
			}
			this.apply();
		}
	}

	/**
	 * What is covered, and where the cover comes from, in pixels of the layer
	 */
	plan() {
		const layer = config.layer;
		let destination = this.getParams().mode;
		destination = (destination && destination.value !== undefined ? destination.value : destination) == 'Destination';
		const shift = destination ? this.offset : {x: 0, y: 0};
		//the shape and the move are on the picture, the patch is computed in the pixels of the layer (turned or stretched too)
		const points = this.polygon.map((p) => picture_to_layer(layer, p.x + shift.x, p.y + shift.y));
		const move = vector_to_layer(layer, this.offset.x, this.offset.y);
		return {
			points,
			dx: destination ? -move.x : move.x,
			dy: destination ? -move.y : move.y,
		};
	}

	/**
	 * The patch for the current place of the shape: the part of the layer that changes
	 *
	 * @returns {{x: number, y: number, image: ImageData, before: ImageData}|null} x, y = top left corner in the layer
	 */
	compute() {
		const layer = config.layer;
		const plan = this.plan();
		const xs = plan.points.map((p) => p.x);
		const ys = plan.points.map((p) => p.y);
		const left = Math.min.apply(null, xs), right = Math.max.apply(null, xs);
		const top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
		//the part, the place it is copied from and some room around them
		const x0 = Math.floor(Math.max(0, Math.min(left, left + plan.dx) - MARGIN));
		const y0 = Math.floor(Math.max(0, Math.min(top, top + plan.dy) - MARGIN));
		const x1 = Math.ceil(Math.min(layer.width_original, Math.max(right, right + plan.dx) + MARGIN));
		const y1 = Math.ceil(Math.min(layer.height_original, Math.max(bottom, bottom + plan.dy) + MARGIN));
		const width = x1 - x0;
		const height = y1 - y0;
		if (width < 1 || height < 1) {
			return null;
		}
		if (this.layer_canvas == null) {
			this.layer_canvas = document.createElement('canvas');
			this.layer_canvas.width = layer.width_original;
			this.layer_canvas.height = layer.height_original;
			this.layer_canvas.getContext('2d', {willReadFrequently: true}).drawImage(layer.link, 0, 0);
		}
		const ctx = this.layer_canvas.getContext('2d');
		const image = ctx.getImageData(x0, y0, width, height);
		const before = new ImageData(new Uint8ClampedArray(image.data), width, height);
		const mask = polygon_mask(plan.points.map((p) => ({x: p.x - x0, y: p.y - y0})), width, height);
		const params = this.getParams();
		patch_region(image, mask, plan.dx, plan.dy, {adapt: params.adapt});
		return {x: x0, y: y0, image, before};
	}

	schedule_preview() {
		if (this.scheduled) {
			return;
		}
		this.scheduled = true;
		requestAnimationFrame(() => {
			this.scheduled = false;
			if (this.state != 'dragging') {
				return;
			}
			const result = this.compute();
			if (result == null) {
				this.preview = null;
			}
			else {
				//only the pixels that changed are shown, the rest of the picture is not drawn again
				const changed = new Uint8ClampedArray(result.image.data.length);
				for (let i = 0; i < changed.length; i += 4) {
					const same = result.image.data[i] == result.before.data[i] && result.image.data[i + 1] == result.before.data[i + 1]
						&& result.image.data[i + 2] == result.before.data[i + 2] && result.image.data[i + 3] == result.before.data[i + 3];
					if (!same) {
						changed[i] = result.image.data[i];
						changed[i + 1] = result.image.data[i + 1];
						changed[i + 2] = result.image.data[i + 2];
						changed[i + 3] = 255;
					}
				}
				const canvas = document.createElement('canvas');
				canvas.width = result.image.width;
				canvas.height = result.image.height;
				canvas.getContext('2d').putImageData(new ImageData(changed, canvas.width, canvas.height), 0, 0);
				this.preview = {canvas, x: result.x, y: result.y, layer: {x: config.layer.x, y: config.layer.y, width: config.layer.width, height: config.layer.height, width_original: config.layer.width_original, height_original: config.layer.height_original, rotate: config.layer.rotate}};
			}
			config.need_render = true;
		});
	}

	apply() {
		const layer = config.layer;
		const result = this.compute();
		if (result == null) {
			this.reset_state();
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.width = layer.width_original;
		canvas.height = layer.height_original;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(this.layer_canvas, 0, 0);
		ctx.putImageData(result.image, result.x, result.y);
		this.reset_state();
		config.need_render = true;
		return app.State.do_action(
			new app.Actions.Bundle_action('patch_tool', 'Patch Tool', [
				new app.Actions.Update_layer_image_action(canvas),
			])
		);
	}

	render_overlay(ctx) {
		if (this.state == 'idle') {
			return;
		}
		const scale = 1 / (config.ZOOM || 1);
		if (this.preview) {
			//the changed pixels are in the pixels of the layer, so they are drawn the way the layer is
			const layer = this.preview.layer;
			ctx.save();
			ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
			ctx.rotate((layer.rotate || 0) * Math.PI / 180);
			ctx.scale(layer.width / layer.width_original, layer.height / layer.height_original);
			ctx.drawImage(this.preview.canvas, this.preview.x - layer.width_original / 2, this.preview.y - layer.height_original / 2);
			ctx.restore();
		}
		const outline = (points, dx, dy, strong) => {
			ctx.beginPath();
			points.forEach((p, i) => {
				if (i == 0) {
					ctx.moveTo(p.x + dx, p.y + dy);
				}
				else {
					ctx.lineTo(p.x + dx, p.y + dy);
				}
			});
			if (this.state != 'drawing') {
				ctx.closePath();
			}
			ctx.lineWidth = (strong ? 2 : 1) * scale;
			ctx.setLineDash([4 * scale, 4 * scale]);
			ctx.strokeStyle = '#000000';
			ctx.stroke();
			ctx.lineDashOffset = 4 * scale;
			ctx.strokeStyle = '#ffffff';
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.lineDashOffset = 0;
		};
		ctx.save();
		if (this.state == 'drawing') {
			outline(this.points, 0, 0, true);
		}
		else {
			outline(this.polygon, 0, 0, this.state == 'ready');
			if (this.state == 'dragging') {
				outline(this.polygon, this.offset.x, this.offset.y, true);
			}
		}
		ctx.restore();
	}
}

export default Patch_class;
