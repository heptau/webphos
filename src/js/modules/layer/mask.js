import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Edit_selection_class from './../edit/selection.js';
import { select_subject_mask } from './../../libs/selection-mask.js';
import { invert_mask } from './../../libs/selection-mask.js';
import {
	serialize_layer_mask, deserialize_layer_mask, uniform_layer_mask, layer_mask_from_selection,
	layer_mask_to_selection, apply_layer_mask
} from './../../libs/layer-mask.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Layer Mask - hides parts of a layer without changing its pixels.
 * A layer mask is stored in layer.mask (see libs/layer-mask.js) and applied when the layer is rendered.
 */
class Layer_mask_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.Edit_selection = null; //created on first use
	}

	/**
	 * @returns {object|null} the active layer when it can have a mask
	 */
	get_layer() {
		var layer = config.layer;
		if (layer == null || layer.type == null || !(layer.width > 0) || !(layer.height > 0)) {
			alertify.error(t('Layer is empty.'));
			return null;
		}
		return layer;
	}

	set_mask(layer, mask, name) {
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_mask', name || 'Layer Mask', [
				new app.Actions.Update_layer_action(layer.id, {
					mask: mask ? serialize_layer_mask(mask) : null,
					mask_enabled: true,
				}),
			])
		);
	}

	/**
	 * Layer > Layer Mask > Reveal All
	 */
	reveal_all() {
		var layer = this.get_layer();
		if (layer) {
			return this.set_mask(layer, uniform_layer_mask(layer, 255), 'Reveal All');
		}
	}

	/**
	 * Layer > Layer Mask > Hide All
	 */
	hide_all() {
		var layer = this.get_layer();
		if (layer) {
			return this.set_mask(layer, uniform_layer_mask(layer, 0), 'Hide All');
		}
	}

	/**
	 * Layer > Layer Mask > From Selection - the selected part stays visible, the rest is hidden
	 */
	from_selection() {
		var layer = this.get_layer();
		if (layer == null) {
			return;
		}
		if (layer.rotate) {
			alertify.error(t('Rotate is not supported on this type of object. Convert to raster?'));
			return;
		}
		var current = this.get_edit_selection().get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		return this.set_mask(layer, layer_mask_from_selection(current.mask, layer), 'Mask from Selection');
	}

	/**
	 * Layer > Layer Mask > Remove Background - finds the object in front of a calm background and hides the background
	 */
	remove_background() {
		var layer = this.get_layer();
		if (layer == null) {
			return;
		}
		if (layer.type != 'image' || layer.rotate) {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		var image = this.get_edit_selection().layer_on_canvas(layer);
		var subject = select_subject_mask(image, 28, 2);
		return this.set_mask(layer, layer_mask_from_selection(subject, layer), 'Remove Background');
	}

	/**
	 * Layer > Layer Mask > To Selection - loads the visible part of the layer as the selection
	 */
	to_selection() {
		var layer = this.get_layer();
		var mask = layer ? deserialize_layer_mask(layer.mask) : null;
		if (mask == null) {
			alertify.error(t('This layer has no mask.'));
			return;
		}
		return this.get_edit_selection().set_mask(layer_mask_to_selection(mask, layer, config.WIDTH, config.HEIGHT), true);
	}

	/**
	 * Layer > Layer Mask > Invert
	 */
	invert() {
		var layer = this.get_layer();
		var mask = layer ? deserialize_layer_mask(layer.mask) : null;
		if (mask == null) {
			alertify.error(t('This layer has no mask.'));
			return;
		}
		return this.set_mask(layer, invert_mask(mask), 'Invert Mask');
	}

	/**
	 * Layer > Layer Mask > Disable / Enable
	 */
	toggle() {
		var layer = this.get_layer();
		if (layer == null) {
			return;
		}
		if (!layer.mask) {
			alertify.error(t('This layer has no mask.'));
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_mask', 'Toggle Mask', [
				new app.Actions.Update_layer_action(layer.id, {mask_enabled: layer.mask_enabled === false}),
			])
		);
	}

	/**
	 * Layer > Layer Mask > Delete - removes the mask, the layer is shown without it
	 */
	remove() {
		var layer = this.get_layer();
		if (layer == null) {
			return;
		}
		if (!layer.mask) {
			alertify.error(t('This layer has no mask.'));
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_mask', 'Delete Mask', [
				new app.Actions.Update_layer_action(layer.id, {mask: null}),
			])
		);
	}

	/**
	 * Layer > Layer Mask > Apply - makes hidden pixels really transparent and removes the mask
	 */
	apply() {
		var layer = this.get_layer();
		var mask = layer ? deserialize_layer_mask(layer.mask) : null;
		if (mask == null) {
			alertify.error(t('This layer has no mask.'));
			return;
		}
		if (layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		var canvas = this.Base_layers.convert_layer_to_canvas(layer.id, true);
		var ctx = canvas.getContext('2d');
		var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
		ctx.putImageData(apply_layer_mask(image, mask), 0, 0);
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_mask', 'Apply Mask', [
				new app.Actions.Update_layer_image_action(canvas, layer.id),
				new app.Actions.Update_layer_action(layer.id, {mask: null}),
			])
		);
	}

	get_edit_selection() {
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		return this.Edit_selection;
	}

}

export default Layer_mask_class;
