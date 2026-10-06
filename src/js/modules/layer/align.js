import app from './../../app.js';
import config from './../../config.js';
import Edit_selection_class from './../edit/selection.js';
import { mask_bounds } from './../../libs/selection-mask.js';
import { layer_bounds, align_delta, distribute_deltas } from './../../libs/layer-align.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Align / Distribute.
 * Align moves the active layer to an edge or the center of the selection (or the canvas without a selection).
 * Distribute spreads all visible layers so the gaps between them are equal.
 */
class Layer_align_class {

	constructor() {
		this.Edit_selection = null; //created on first use
	}

	align_left() {
		return this.align('left');
	}

	align_center() {
		return this.align('center');
	}

	align_right() {
		return this.align('right');
	}

	align_top() {
		return this.align('top');
	}

	align_middle() {
		return this.align('middle');
	}

	align_bottom() {
		return this.align('bottom');
	}

	distribute_horizontally() {
		return this.distribute('x');
	}

	distribute_vertically() {
		return this.distribute('y');
	}

	/**
	 * @param {string} mode left, center, right, top, middle, bottom
	 */
	align(mode) {
		var layer = config.layer;
		if (!this.is_movable(layer)) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		var delta = align_delta(layer_bounds(layer), mode, this.get_reference());
		if (delta.dx == 0 && delta.dy == 0) {
			return;
		}
		return this.move_layers([{id: layer.id, dx: delta.dx, dy: delta.dy}], 'Align Layer');
	}

	/**
	 * @param {'x'|'y'} axis
	 */
	distribute(axis) {
		var layers = config.layers.filter((layer) => this.is_movable(layer) && layer.visible != false);
		if (layers.length < 3) {
			alertify.error(t('At least 3 visible layers are needed.'));
			return;
		}
		var deltas = distribute_deltas(layers.map((layer) => ({id: layer.id, bounds: layer_bounds(layer)})), axis)
			.filter((delta) => delta.dx != 0 || delta.dy != 0);
		if (deltas.length == 0) {
			return;
		}
		return this.move_layers(deltas, 'Distribute Layers');
	}

	is_movable(layer) {
		return layer != null && layer.type != null && layer.width > 0 && layer.height > 0;
	}

	/**
	 * Selection bounds when something is selected, otherwise the whole canvas
	 */
	get_reference() {
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		var current = this.Edit_selection.get_mask();
		if (current != null) {
			var rect = current.kind == 'custom' ? mask_bounds(current.mask) : current.rect;
			if (rect) {
				return {left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height};
			}
		}
		return {left: 0, top: 0, right: config.WIDTH, bottom: config.HEIGHT};
	}

	move_layers(deltas, name) {
		var actions = deltas.map((delta) => {
			var layer = app.Layers.get_layer(delta.id);
			return new app.Actions.Update_layer_action(delta.id, {x: layer.x + delta.dx, y: layer.y + delta.dy});
		});
		return app.State.do_action(new app.Actions.Bundle_action('align_layers', name, actions));
	}

}

export default Layer_align_class;
