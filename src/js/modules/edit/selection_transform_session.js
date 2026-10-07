import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Base_tools_class from './../../core/base-tools.js';
import Edit_selection_class from './selection.js';
import { mask_bounds, transform_mask } from './../../libs/selection-mask.js';
import { IDENTITY, frame_of, handle_points, hit_test, drag_transform, SCALE_HANDLES } from './../../libs/selection-transform.js';
import { t } from '../tools/translate.js';

const HANDLE_SIZE = 8; //screen pixels
const REACH = 10; //screen pixels
const ROTATE_DISTANCE = 24; //screen pixels

const CURSORS = {
	tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize',
	top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize',
	move: 'move', rotate: 'grab',
};

var instance = null;

/**
 * Select > Transform Selection with the mouse: a frame around the selection. The handles scale it (Shift keeps the
 * proportions, Alt scales around the center), the inside moves it, the outside turns it (Shift turns by 15 degrees).
 * The result shows on the canvas (orange); Enter or Apply makes the selection, Escape or Cancel keeps the old one.
 * The pixels of the picture are never touched.
 */
class Edit_selection_transform_session_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;
		this.active = false;
		this.pointer = new Base_tools_class(); //only for the position of the mouse on the picture
		this.selection = new Edit_selection_class();
	}

	async start() {
		if (this.active) {
			return;
		}
		if (this.selection.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		var current = this.selection.get_mask();
		var bounds = mask_bounds(current.mask);
		if (bounds == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		if (!config.TOOL.keep_selection) {
			//the selection (and its preview) is only drawn by the selection tools
			await app.State.do_action(new app.Actions.Activate_tool_action(this.selection.Selection.name));
		}
		this.base = current.mask;
		this.bounds = bounds;
		this.transform = Object.assign({}, IDENTITY);
		this.dragging = null;
		this.hover = null;
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

	reset() {
		this.transform = Object.assign({}, IDENTITY);
		this.show_preview();
	}

	zoom() {
		return config.ZOOM || 1;
	}

	point(event) {
		return this.pointer.get_mouse_coordinates_from_event(event);
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
		var point = this.point(event);
		var kind = hit_test(this.bounds, this.transform, point, REACH / this.zoom(), ROTATE_DISTANCE / this.zoom());
		if (kind) {
			this.dragging = {kind: kind, from: point, start: Object.assign({}, this.transform)};
		}
	}

	pointer_move(event) {
		if (this.dragging == null) {
			if (this.on_canvas(event)) {
				var kind = hit_test(this.bounds, this.transform, this.point(event), REACH / this.zoom(), ROTATE_DISTANCE / this.zoom());
				if (kind != this.hover) {
					this.hover = kind;
					var wrapper = document.getElementById('main_wrapper');
					if (wrapper) {
						wrapper.style.cursor = CURSORS[kind] || 'default';
					}
				}
			}
			return;
		}
		event.stopImmediatePropagation();
		this.transform = drag_transform(
			this.bounds, this.dragging.start, this.dragging.kind, this.dragging.from, this.point(event),
			{shift: event.shiftKey, alt: event.altKey}
		);
		this.schedule_preview();
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
	 * the selection as it will be, shown in orange (not more often than needed, it is made from the whole mask)
	 */
	schedule_preview() {
		if (this.scheduled) {
			return;
		}
		this.scheduled = true;
		setTimeout(() => {
			this.scheduled = false;
			if (this.active) {
				this.show_preview();
			}
		}, 80);
	}

	show_preview() {
		try {
			this.selection.Selection_mask.set_preview(transform_mask(this.base, this.transform), () => this.active);
		}
		catch (error) {
			console.warn('Selection preview failed', error);
		}
		config.need_render = true;
	}

	draw(ctx) {
		if (!this.active) {
			return;
		}
		var scale = 1 / this.zoom();
		var points = handle_points(this.bounds, this.transform, ROTATE_DISTANCE * scale);
		ctx.save();
		ctx.beginPath();
		['tl', 'tr', 'br', 'bl'].forEach((name, i) => (i == 0 ? ctx.moveTo(points[name].x, points[name].y) : ctx.lineTo(points[name].x, points[name].y)));
		ctx.closePath();
		ctx.moveTo(points.top.x, points.top.y);
		ctx.lineTo(points.rotate.x, points.rotate.y);
		ctx.lineWidth = 3 * scale;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.stroke();
		ctx.lineWidth = scale;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		var size = HANDLE_SIZE * scale;
		SCALE_HANDLES.forEach((name) => {
			ctx.fillStyle = this.dragging && this.dragging.kind == name ? '#0a84ff' : '#ffffff';
			ctx.fillRect(points[name].x - size / 2, points[name].y - size / 2, size, size);
			ctx.lineWidth = scale;
			ctx.strokeStyle = '#222222';
			ctx.strokeRect(points[name].x - size / 2, points[name].y - size / 2, size, size);
		});
		//the handle to turn the frame
		ctx.beginPath();
		ctx.arc(points.rotate.x, points.rotate.y, size * 0.6, 0, Math.PI * 2);
		ctx.fillStyle = this.dragging && this.dragging.kind == 'rotate' ? '#0a84ff' : '#ffffff';
		ctx.fill();
		ctx.stroke();
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
		this.selection.Selection_mask.clear_preview();
		var wrapper = document.getElementById('main_wrapper');
		if (wrapper) {
			wrapper.style.cursor = '';
		}
		if (this.bar) {
			this.bar.remove();
			this.bar = null;
		}
		config.need_render = true;
	}

	cancel() {
		if (this.active) {
			this.finish();
		}
	}

	/**
	 * The numbers dialog (the frame made so far is dropped)
	 */
	numbers() {
		this.cancel();
		app.GUI.run_target('edit/selection.transform_selection_numbers');
	}

	apply() {
		if (!this.active) {
			return;
		}
		var base = this.base;
		var transform = this.transform;
		this.finish();
		var current = this.selection.get_mask();
		//the selection could have changed by Undo meanwhile
		if (current == null || current.mask !== base) {
			return;
		}
		this.selection.set_mask(transform_mask(base, transform), false);
	}

	show_bar() {
		var bar = document.createElement('div');
		bar.className = 'distort_bar';
		bar.setAttribute('role', 'toolbar');
		bar.setAttribute('aria-label', t('Transform Selection'));
		var button = (text, handler) => {
			var element = document.createElement('button');
			element.type = 'button';
			element.textContent = t(text);
			element.addEventListener('click', handler);
			bar.appendChild(element);
			return element;
		};
		var label = document.createElement('span');
		label.textContent = t('Transform Selection');
		bar.appendChild(label);
		var divider = document.createElement('span');
		divider.className = 'distort_bar_divider';
		bar.appendChild(divider);
		button('Reset', () => this.reset());
		button('Numbers', () => this.numbers());
		button('Cancel', () => this.cancel());
		var apply = button('Apply', () => this.apply());
		apply.className = 'primary';
		document.body.appendChild(bar);
		this.bar = bar;
	}
}

export default Edit_selection_transform_session_class;
