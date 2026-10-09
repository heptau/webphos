import app from './../../app.js';
import config from './../../config.js';
import Edit_selection_class from './selection.js';
import Base_layers_class from './../../core/base-layers.js';
import { translate_mask, mask_bounds } from './../../libs/selection-mask.js';
import { point_in_selection, moved_rect, lift_pixels, put_shifted } from './../../libs/selection-move.js';
import { t } from '../tools/translate.js';

let instance = null;

/**
 * Moving a selection with the mouse: the Move tool (or the marquee tool) drags the selection with the pixels in it
 * ("Content"; Alt copies them), or only its outline ("Outline"). While the mouse is down the layer shows the result
 * (its `link_canvas`), the real change is made when the button is released, as one step of the history.
 */
class Edit_selection_move_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Selection = new Edit_selection_class();
		this.Base_layers = new Base_layers_class();
		this.active = null;
	}

	/**
	 * @param {object} layer
	 * @returns {boolean} the pixels of the layer can be lifted: a picture that is not turned, stretched or locked
	 */
	can_lift(layer) {
		return Boolean(layer) && layer.type == 'image' && !layer.rotate && layer.is_vector !== true && layer.locked !== true
			&& layer.width == layer.width_original && layer.height == layer.height_original;
	}

	/**
	 * @param {object} layer
	 * @returns {boolean} a layer that has no pixels of its own (a stroke, text, a shape) but can be drawn to pixels
	 */
	can_rasterize(layer) {
		return Boolean(layer) && layer.type != null && layer.type != 'adjustment' && layer.locked !== true && !this.can_lift(layer);
	}

	/**
	 * @param {{x: number, y: number}} point in pixels of the picture
	 * @param {string} mode 'Content' or 'Outline'
	 * @returns {boolean} a press here drags the selection
	 */
	applies(point, mode) {
		if (mode != 'Content' && mode != 'Outline') {
			return false;
		}
		if (mode == 'Content' && !this.can_lift(config.layer) && !this.can_rasterize(config.layer)) {
			return false;
		}
		return point_in_selection(this.Selection.get_mask(), point);
	}

	/**
	 * A press inside of the selection
	 *
	 * @param {string} mode 'Content' or 'Outline'
	 */
	begin(mode) {
		const current = this.Selection.get_mask();
		this.active = {mode, mask: current.mask, rect: current.rect, kind: current.kind, last_preview: 0};
		if (mode == 'Content' && this.can_lift(config.layer)) {
			const layer = config.layer;
			const canvas = document.createElement('canvas');
			canvas.width = layer.width_original;
			canvas.height = layer.height_original;
			const ctx = canvas.getContext('2d', {willReadFrequently: true});
			ctx.drawImage(layer.link, 0, 0);
			const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const parts = lift_pixels(image, current.mask, layer);
			this.active.original = image;
			this.active.parts = parts;
			this.active.layer = layer;
			this.active.preview = canvas;
		}
		else if (mode == 'Content') {
			//a layer without pixels of its own (stroke, text, shape): it is drawn to pixels the size of the picture and the
			//selected part is lifted from them; the result is a new picture layer (see finish)
			const vector = config.layer;
			const picture = document.createElement('canvas');
			picture.width = config.WIDTH;
			picture.height = config.HEIGHT;
			const picture_ctx = picture.getContext('2d', {willReadFrequently: true});
			this.Base_layers.render_object(picture_ctx, vector);
			const drawn = picture_ctx.getImageData(0, 0, picture.width, picture.height);
			this.active.original = drawn;
			this.active.parts = lift_pixels(drawn, current.mask, {x: 0, y: 0, width: picture.width, height: picture.height});
			this.active.vector = vector;
			this.active.was_visible = vector.visible;
			this.active.preview = picture;
			this.active.previous_overlay = config.view_overlay;
		}
	}

	/**
	 * The mouse moved
	 *
	 * @param {number} dx pixels from the press
	 * @param {number} dy
	 * @param {boolean} copy Alt is held (Content only)
	 */
	update(dx, dy, copy) {
		const active = this.active;
		if (!active) {
			return;
		}
		dx = Math.round(dx);
		dy = Math.round(dy);
		//not more often than every 35 ms (a big picture takes long to compose)
		const now = Date.now();
		if (now - active.last_preview < 35) {
			return;
		}
		active.last_preview = now;
		if (active.mode == 'Content' && active.vector) {
			//the preview is drawn over the picture; the vector layer is hidden while it is moved (not when it is copied)
			const empty = new Uint8ClampedArray(active.original.data.length);
			const pieces = {data: copy ? empty : new Uint8ClampedArray(active.parts.hole.data), width: active.original.width, height: active.original.height};
			put_shifted(pieces, active.parts.selected, dx, dy);
			active.preview.getContext('2d').putImageData(new ImageData(pieces.data, pieces.width, pieces.height), 0, 0);
			active.vector.visible = copy ? active.was_visible : false;
			config.view_overlay = (ctx) => ctx.drawImage(active.preview, 0, 0);
			config.need_render = true;
		}
		else if (active.mode == 'Content') {
			//the pixels as they would be: the layer with a hole (or untouched for a copy) and the lifted pixels shifted
			const base = {data: new Uint8ClampedArray((copy ? active.original : active.parts.hole).data), width: active.original.width, height: active.original.height};
			put_shifted(base, active.parts.selected, dx, dy);
			active.preview.getContext('2d').putImageData(new ImageData(base.data, base.width, base.height), 0, 0);
			active.layer.link_canvas = active.preview;
			config.need_render = true;
		}
		else {
			//the outline: the preview of the mask in orange
			this.Selection.Selection_mask.set_preview(translate_mask(active.mask, dx, dy), () => this.active != null);
			config.need_render = true;
		}
	}

	/**
	 * The mouse button was released: the change is made
	 *
	 * @param {number} dx
	 * @param {number} dy
	 * @param {boolean} copy
	 */
	async finish(dx, dy, copy) {
		const active = this.active;
		if (!active) {
			return;
		}
		dx = Math.round(dx);
		dy = Math.round(dy);
		this.clear(active);
		if (dx == 0 && dy == 0) {
			return;
		}
		//the selection after the move
		let actions;
		if (active.kind == 'custom') {
			const moved = translate_mask(active.mask, dx, dy);
			actions = mask_bounds(moved) == null ? null : this.Selection.mask_actions(moved);
		}
		else {
			const rect = moved_rect(active.rect, dx, dy, config.WIDTH, config.HEIGHT);
			actions = rect == null ? null : [new app.Actions.Set_selection_action(rect.x, rect.y, rect.width, rect.height)];
		}
		if (actions == null) {
			//nothing of the selection would be left in the picture
			config.need_render = true;
			return;
		}
		if (active.mode == 'Content' && active.vector) {
			//the result is a picture layer; a copy leaves the vector layer as it is, a move replaces it (in the same place of the stack)
			const vector = active.vector;
			const parts = {data: copy ? new Uint8ClampedArray(active.original.data.length) : new Uint8ClampedArray(active.parts.hole.data), width: active.original.width, height: active.original.height};
			put_shifted(parts, active.parts.selected, dx, dy);
			const result = document.createElement('canvas');
			result.width = parts.width;
			result.height = parts.height;
			result.getContext('2d').putImageData(new ImageData(parts.data, parts.width, parts.height), 0, 0);
			const params = {
				name: copy ? `${vector.name  } ${  t('copy')}` : vector.name,
				type: 'image',
				data: result.toDataURL('image/png'),
				x: 0,
				y: 0,
				width: result.width,
				height: result.height,
				opacity: vector.opacity,
				composition: vector.composition,
			};
			if (!copy) {
				params.order = vector.order;
			}
			const changes = [new app.Actions.Insert_layer_action(params, false)];
			if (!copy) {
				changes.push(new app.Actions.Delete_layer_action(vector.id));
			}
			await app.State.do_action(new app.Actions.Bundle_action('move_selection_content', copy ? 'Copy Selection Content' : 'Move Selection Content', changes.concat(actions)));
		}
		else if (active.mode == 'Content') {
			const base = {data: new Uint8ClampedArray((copy ? active.original : active.parts.hole).data), width: active.original.width, height: active.original.height};
			put_shifted(base, active.parts.selected, dx, dy);
			const canvas = document.createElement('canvas');
			canvas.width = base.width;
			canvas.height = base.height;
			canvas.getContext('2d').putImageData(new ImageData(base.data, base.width, base.height), 0, 0);
			//the picture is shown from this canvas until the layer has its new image
			active.layer.link_canvas = canvas;
			actions.unshift(new app.Actions.Update_layer_image_action(canvas, active.layer.id));
			await app.State.do_action(new app.Actions.Bundle_action('move_selection_content', copy ? 'Copy Selection Content' : 'Move Selection Content', actions));
			delete active.layer.link_canvas;
		}
		else {
			await app.State.do_action(new app.Actions.Bundle_action('move_selection', 'Move Selection', actions));
		}
		config.need_render = true;
	}

	/**
	 * Esc: nothing is changed
	 */
	cancel() {
		if (this.active) {
			this.clear(this.active);
			config.need_render = true;
		}
	}

	clear(active) {
		if (active.layer) {
			delete active.layer.link_canvas;
		}
		if (active.vector) {
			//the layer is shown again, the overlay is gone
			active.vector.visible = active.was_visible;
			config.view_overlay = active.previous_overlay;
		}
		this.Selection.Selection_mask.clear_preview();
		this.active = null;
	}
}

export default Edit_selection_move_class;
