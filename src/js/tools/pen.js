import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Edit_selection_class from './../modules/edit/selection.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { clean_anchors, drag_smooth, flatten_path, bounds_of, hit_path, move_part, path_mask } from './../libs/pen-path.js';
import { t } from '../modules/tools/translate.js';

/**
 * Pen tool (Photoshop) - a click adds a corner point, a click with a drag adds a smooth point (the drag pulls out its
 * handles). The first point closes the path; points and handles can be dragged. The bar then turns the path into a
 * layer (stroke and / or fill) or into a selection. Enter makes the layer, Esc forgets the path, Backspace removes
 * the last point.
 */
class Pen_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'pen';
		this.reset_state();
	}

	reset_state() {
		this.editing = null;
		this.anchors = [];
		this.closed = false;
		this.drag = null;
		this.remove_bar();
	}

	load() {
		this.default_events();
		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name != this.name || this.anchors.length == 0 || this.Helper.is_input(event.target)) {
				return;
			}
			if (event.key == 'Escape') {
				this.reset_state();
			}
			else if (event.key == 'Enter') {
				this.make_layer();
			}
			else if (event.key == 'Backspace' || event.key == 'Delete') {
				this.anchors.pop();
				this.closed = false;
				if (this.anchors.length == 0) {
					this.reset_state();
				}
				else {
					this.update_bar();
				}
				event.preventDefault();
			}
			else {
				return;
			}
			config.need_render = true;
		});
	}

	on_leave() {
		this.reset_state();
		config.need_render = true;
		return [];
	}

	/**
	 * Takes the path of a path layer (or a polygon) into the editor, in the pixels of the picture.
	 * Making the layer again then changes that layer instead of adding a new one.
	 *
	 * @param {{anchors: object[], closed: boolean, layer_id?: number|null, size?: number, mode?: string}} path
	 */
	load_path(path) {
		this.reset_state();
		this.anchors = path.anchors;
		this.closed = path.closed;
		this.editing = path.layer_id == null ? null : path.layer_id;
		var settings = config.TOOLS.find((tool) => tool.name == this.name);
		if (settings && path.mode && settings.attributes.mode) {
			settings.attributes.mode.value = path.mode;
		}
		if (settings && path.size) {
			settings.attributes.size = path.size;
		}
		this.update_bar();
		config.need_render = true;
	}

	radius() {
		return 6 / (config.ZOOM || 1);
	}

	mousedown(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}
		var point = {x: mouse.x, y: mouse.y};
		var hit = hit_path(this.anchors, point, this.radius());
		if (hit && hit.index == 0 && hit.part == 'anchor' && this.anchors.length >= 2 && this.closed == false) {
			this.closed = true;
			this.update_bar();
			config.need_render = true;
			return;
		}
		if (hit) {
			this.drag = {index: hit.index, part: hit.part, moved: false};
			return;
		}
		if (this.closed) {
			return;
		}
		this.anchors.push({x: point.x, y: point.y, in: null, out: null});
		this.drag = {index: this.anchors.length - 1, part: 'new', moved: false};
		this.update_bar();
		config.need_render = true;
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || this.drag == null || mouse.click_valid == false) {
			return;
		}
		var anchor = this.anchors[this.drag.index];
		if (anchor == null) {
			return;
		}
		var point = {x: mouse.x, y: mouse.y};
		if (this.drag.part == 'new') {
			if (Math.hypot(point.x - anchor.x, point.y - anchor.y) > 2 / (config.ZOOM || 1)) {
				drag_smooth(anchor, point);
			}
		}
		else {
			move_part(anchor, this.drag.part, point, e.altKey === true);
		}
		this.drag.moved = true;
		config.need_render = true;
	}

	mouseup() {
		this.drag = null;
	}

	/**
	 * @returns {{points: {x: number, y: number}[], margin: number}}
	 */
	outline() {
		var params = this.getParams();
		return {points: flatten_path(this.anchors, this.closed), margin: Math.ceil((params.size || 1) / 2) + 2};
	}

	/**
	 * The path becomes a layer (Fill / Stroke by the tool options)
	 */
	make_layer() {
		if (this.anchors.length < 2) {
			alertify.error(t('A path needs at least 2 points.'));
			return;
		}
		var params = this.getParams();
		var mode = params.mode && params.mode.value !== undefined ? params.mode.value : params.mode;
		var box = bounds_of(this.outline().points);
		var margin = this.outline().margin;
		var x = Math.floor(box.x - margin);
		var y = Math.floor(box.y - margin);
		var width = Math.max(1, Math.ceil(box.width + margin * 2));
		var height = Math.max(1, Math.ceil(box.height + margin * 2));
		var move = (p) => (p ? {x: p.x - x, y: p.y - y} : null);
		var data = this.anchors.map((a) => ({x: a.x - x, y: a.y - y, in: move(a.in), out: move(a.out)}));
		var layer = {
			type: this.name,
			name: t('Path'),
			data: data,
			params: {size: params.size, mode: mode, closed: this.closed, stroke_color: config.COLOR_BG},
			render_function: [this.name, 'render'],
			x: x,
			y: y,
			width: width,
			height: height,
			width_original: width,
			height_original: height,
			rotate: null,
			is_vector: true,
			color: config.COLOR,
		};
		var editing = this.editing != null ? config.layers.find((item) => item.id == this.editing) : null;
		this.reset_state();
		config.need_render = true;
		if (editing) {
			//the layer keeps its place in the stack, its name and its other settings
			return app.State.do_action(
				new app.Actions.Bundle_action('edit_pen_layer', 'Edit Path', [
					new app.Actions.Update_layer_action(editing.id, {
						data: layer.data, params: layer.params, x: layer.x, y: layer.y, width: layer.width, height: layer.height,
						width_original: layer.width_original, height_original: layer.height_original,
					}),
				])
			);
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('new_pen_layer', 'New Path Layer', [
				new app.Actions.Insert_layer_action(layer),
			])
		);
	}

	/**
	 * The area inside the path becomes the selection
	 */
	make_selection() {
		if (this.anchors.length < 3) {
			alertify.error(t('A path needs at least 3 points.'));
			return;
		}
		var mask = path_mask(this.anchors, config.WIDTH, config.HEIGHT);
		this.reset_state();
		config.need_render = true;
		return new Edit_selection_class().set_mask(mask, true);
	}

	update_bar() {
		if (this.bar == null) {
			var bar = document.createElement('div');
			bar.className = 'distort_bar';
			bar.setAttribute('role', 'toolbar');
			bar.setAttribute('aria-label', t('Pen'));
			var label = document.createElement('span');
			label.textContent = t('Path');
			bar.appendChild(label);
			var divider = document.createElement('span');
			divider.className = 'distort_bar_divider';
			bar.appendChild(divider);
			var button = (text, handler) => {
				var element = document.createElement('button');
				element.type = 'button';
				element.textContent = t(text);
				element.addEventListener('click', handler);
				bar.appendChild(element);
				return element;
			};
			button('Cancel', () => {
				this.reset_state();
				config.need_render = true;
			});
			button('Selection', () => this.make_selection());
			button('Layer', () => this.make_layer()).className = 'primary';
			document.body.appendChild(bar);
			this.bar = bar;
		}
	}

	remove_bar() {
		if (this.bar) {
			this.bar.remove();
			this.bar = null;
		}
	}

	/**
	 * Draws the path of a layer: stroke and / or fill, anchors are in the pixels of the layer
	 */
	render(ctx, layer) {
		var anchors = clean_anchors(layer.data);
		if (anchors.length < 2) {
			return;
		}
		var params = layer.params || {};
		var closed = params.closed === true;
		var mode = params.mode || 'Stroke';
		var scale_x = layer.width_original ? layer.width / layer.width_original : 1;
		var scale_y = layer.height_original ? layer.height / layer.height_original : 1;
		var points = flatten_path(anchors, closed, 24);

		ctx.save();
		ctx.translate(layer.x, layer.y);
		ctx.scale(scale_x, scale_y);
		ctx.beginPath();
		points.forEach((p, i) => {
			if (i == 0) {
				ctx.moveTo(p.x, p.y);
			}
			else {
				ctx.lineTo(p.x, p.y);
			}
		});
		if (closed) {
			ctx.closePath();
		}
		if (mode == 'Fill' || mode == 'Fill + Stroke') {
			ctx.fillStyle = layer.color;
			ctx.fill();
		}
		if (mode == 'Stroke' || mode == 'Fill + Stroke') {
			ctx.lineWidth = Math.max(1, Number(params.size) || 1);
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.strokeStyle = mode == 'Stroke' ? layer.color : (typeof params.stroke_color == 'string' && /^#[0-9a-fA-F]{3,8}$/.test(params.stroke_color) ? params.stroke_color : layer.color);
			ctx.stroke();
		}
		ctx.restore();
	}

	render_overlay(ctx) {
		if (this.anchors.length == 0) {
			return;
		}
		var scale = 1 / (config.ZOOM || 1);
		var path = flatten_path(this.anchors, this.closed);
		ctx.save();
		ctx.beginPath();
		path.forEach((p, i) => {
			if (i == 0) {
				ctx.moveTo(p.x, p.y);
			}
			else {
				ctx.lineTo(p.x, p.y);
			}
		});
		if (this.closed) {
			ctx.closePath();
		}
		ctx.lineWidth = 3 * scale;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		ctx.lineWidth = 1 * scale;
		ctx.strokeStyle = '#0a84ff';
		ctx.stroke();

		this.anchors.forEach((anchor, index) => {
			[anchor.in, anchor.out].forEach((handle) => {
				if (handle == null) {
					return;
				}
				ctx.beginPath();
				ctx.moveTo(anchor.x, anchor.y);
				ctx.lineTo(handle.x, handle.y);
				ctx.lineWidth = scale;
				ctx.strokeStyle = '#0a84ff';
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(handle.x, handle.y, 3 * scale, 0, Math.PI * 2);
				ctx.fillStyle = '#ffffff';
				ctx.fill();
				ctx.stroke();
			});
			var half = 3.5 * scale;
			ctx.fillStyle = index == 0 && this.closed == false ? '#0a84ff' : '#ffffff';
			ctx.lineWidth = scale;
			ctx.strokeStyle = '#0a84ff';
			ctx.fillRect(anchor.x - half, anchor.y - half, half * 2, half * 2);
			ctx.strokeRect(anchor.x - half, anchor.y - half, half * 2, half * 2);
		});
		ctx.restore();
	}
}

export default Pen_class;
