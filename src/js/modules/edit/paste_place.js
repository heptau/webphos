import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Copy_class from './copy.js';
import Edit_selection_class from './selection.js';
import { read_clipboard_canvas } from './../../libs/clipboard-image.js';
import { layer_mask_from_selection, serialize_layer_mask } from './../../libs/layer-mask.js';
import { t } from '../tools/translate.js';

/**
 * Edit > Paste in Place (Shift+Ctrl+V) and Paste Into (Alt+Shift+Ctrl+V).
 * The picture from the clipboard becomes a new layer. In Place keeps the position it was copied from
 * (when it comes from this application, otherwise the center of the canvas); Into additionally uses the
 * current selection as the layer mask, so only the selected part shows.
 */
class Edit_paste_place_class {

	paste_in_place() {
		return this.paste(false);
	}

	paste_into() {
		return this.paste(true);
	}

	async paste(into) {
		let selection = null;
		if (into) {
			selection = new Edit_selection_class().get_mask();
			if (selection == null) {
				alertify.error(t('Empty selection'));
				return;
			}
		}

		let canvas;
		try {
			canvas = await read_clipboard_canvas();
		}
		catch (error) {
			alertify.error(error.message);
			return;
		}

		const position = this.position_for(canvas);
		const geometry = {x: position.x, y: position.y, width: canvas.width, height: canvas.height};
		const settings = {
			name: t(into ? 'Pasted Into' : 'Pasted'),
			type: 'image',
			x: geometry.x,
			y: geometry.y,
			width: geometry.width,
			height: geometry.height,
			width_original: geometry.width,
			height_original: geometry.height,
			data: canvas.toDataURL('image/png'),
		};
		const actions = [new app.Actions.Insert_layer_action(settings, false)];
		if (into) {
			//the new layer gets the next free id
			actions.push(new app.Actions.Update_layer_action(app.Layers.auto_increment, {
				mask: serialize_layer_mask(layer_mask_from_selection(selection.mask, geometry)),
				mask_enabled: true,
			}));
		}
		await app.State.do_action(
			new app.Actions.Bundle_action(into ? 'paste_into' : 'paste_in_place', into ? 'Paste Into' : 'Paste in Place', actions)
		);
	}

	/**
	 * Where the picture goes: the place it was copied from, else the center of the canvas
	 */
	position_for(canvas) {
		const copied = new Copy_class().last_copy_rect;
		if (copied && copied.width == canvas.width && copied.height == canvas.height) {
			return {x: copied.x, y: copied.y};
		}
		return {
			x: Math.round((config.WIDTH - canvas.width) / 2),
			y: Math.round((config.HEIGHT - canvas.height) / 2),
		};
	}
}

export default Edit_paste_place_class;
