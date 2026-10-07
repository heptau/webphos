import { t } from '../modules/tools/translate.js';

/**
 * Reads the picture from the system clipboard.
 *
 * @returns {Promise<HTMLCanvasElement>} canvas with the picture
 * @throws {Error} message is a translated text for the user
 */
export async function read_clipboard_canvas() {
	if (!navigator.clipboard || typeof navigator.clipboard.read != 'function') {
		throw new Error(t('Your browser does not allow reading the clipboard.'));
	}
	var blob = null;
	try {
		var items = await navigator.clipboard.read();
		for (var item of items) {
			var type = item.types.find((name) => name.indexOf('image/') == 0);
			if (type) {
				blob = await item.getType(type);
				break;
			}
		}
	}
	catch (error) {
		throw new Error(t('The clipboard could not be read.'), {cause: error});
	}
	if (!blob) {
		throw new Error(t('There is no picture in the clipboard.'));
	}
	var bitmap = await createImageBitmap(blob);
	var canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext('2d').drawImage(bitmap, 0, 0);
	if (bitmap.close) {
		bitmap.close();
	}
	return canvas;
}
