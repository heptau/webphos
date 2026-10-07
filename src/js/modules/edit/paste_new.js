import app from './../../app.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import File_new_class from './../file/new.js';
import { t } from '../tools/translate.js';
import { read_clipboard_canvas } from './../../libs/clipboard-image.js';

/**
 * Edit > Paste as New Document - the picture from the clipboard opens in a new document tab of its size
 */
class Edit_paste_new_class {

	async paste_new() {
		var canvas;
		try {
			canvas = await read_clipboard_canvas();
		}
		catch (error) {
			alertify.error(error.message);
			return;
		}
		try {
			await new File_new_class().create_document(canvas.width, canvas.height, true);
			await app.State.do_action(
				new app.Actions.Bundle_action('paste_new', 'Paste as New Document', [
					new app.Actions.Insert_layer_action({
						name: t('Pasted'),
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
		catch (error) {
			alertify.error(t('The clipboard could not be read.'));
		}
	}
}

export default Edit_paste_new_class;
