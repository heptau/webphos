import app from './../../app.js';
import Edit_selection_class from './../edit/selection.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Stamp Visible - a new layer with the merged picture of all visible layers; the layers stay as they are
 */
class Layer_stamp_class {

	stamp_visible() {
		var canvas = new Edit_selection_class().get_merged_canvas();
		app.State.do_action(
			new app.Actions.Bundle_action('stamp_visible', 'Stamp Visible', [
				new app.Actions.Insert_layer_action({
					name: t('Stamp'),
					type: 'image',
					x: 0,
					y: 0,
					width: canvas.width,
					height: canvas.height,
					width_original: canvas.width,
					height_original: canvas.height,
					data: canvas.toDataURL('image/png'),
				}, false),
			])
		);
	}
}

export default Layer_stamp_class;
