import app from './../../app.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import File_new_class from './../file/new.js';
import { t } from '../tools/translate.js';

/**
 * Edit > Paste as New Document - the picture from the clipboard opens in a new document tab of its size
 */
class Edit_paste_new_class {

	async paste_new() {
		if (!navigator.clipboard || typeof navigator.clipboard.read != 'function') {
			alertify.error(t('Your browser does not allow reading the clipboard.'));
			return;
		}
		try {
			var items = await navigator.clipboard.read();
			var blob = null;
			for (var item of items) {
				var type = item.types.find((name) => name.indexOf('image/') == 0);
				if (type) {
					blob = await item.getType(type);
					break;
				}
			}
			if (!blob) {
				alertify.warning(t('There is no picture in the clipboard.'));
				return;
			}
			var bitmap = await createImageBitmap(blob);
			var canvas = document.createElement('canvas');
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			canvas.getContext('2d').drawImage(bitmap, 0, 0);
			if (bitmap.close) {
				bitmap.close();
			}

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
