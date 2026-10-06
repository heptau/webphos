import config from './../../config.js';
import app from './../../app.js';
import Base_layers_class from './../../core/base-layers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * View > Split Compare - the picture is split by a line: the left side shows the original (the state
 * before the first change), the right side the current state. Drag the line to compare; Escape or the
 * same menu item ends the comparison.
 */
class View_split_compare_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.dragging = false;
		this.handlers = null;
	}

	async toggle() {
		if (config.compare) {
			this.stop();
			return;
		}
		//the picture from before the first change was saved by the state (see Base_state.remember_original)
		var before = app.State.original_canvas;
		if (!before || app.State.action_history_index == 0) {
			alertify.warning(t('There are no changes to compare.'));
			return;
		}

		config.compare = {before: before, x: config.WIDTH / 2};
		this.start();
		config.need_render = true;
		alertify.message(t('Drag the line to compare. Escape ends the comparison.'), 4);
	}

	start() {
		var wrapper = document.getElementById('main_wrapper');
		var canvas = document.getElementById('canvas_minipaint');
		var set_from_event = (event) => {
			var rect = canvas.getBoundingClientRect();
			config.compare.x = this.Base_layers.get_world_coords(event.clientX - rect.left, event.clientY - rect.top).x;
			config.need_render = true;
		};
		var down = (event) => {
			if (event.button !== 0) {
				return;
			}
			//the tools do not get this click
			event.preventDefault();
			event.stopPropagation();
			this.dragging = true;
			set_from_event(event);
		};
		var move = (event) => {
			if (this.dragging) {
				set_from_event(event);
			}
		};
		var up = () => {
			this.dragging = false;
		};
		var key = (event) => {
			if (event.key == 'Escape') {
				this.stop();
			}
		};
		wrapper.addEventListener('mousedown', down, true);
		document.addEventListener('mousemove', move);
		document.addEventListener('mouseup', up);
		document.addEventListener('keydown', key);
		this.handlers = {wrapper: wrapper, down: down, move: move, up: up, key: key};
	}

	stop() {
		if (this.handlers) {
			this.handlers.wrapper.removeEventListener('mousedown', this.handlers.down, true);
			document.removeEventListener('mousemove', this.handlers.move);
			document.removeEventListener('mouseup', this.handlers.up);
			document.removeEventListener('keydown', this.handlers.key);
			this.handlers = null;
		}
		this.dragging = false;
		config.compare = null;
		config.need_render = true;
	}
}

export default View_split_compare_class;
