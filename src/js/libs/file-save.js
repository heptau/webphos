/**
 * Saving a file. In browsers that support it (Chrome, Edge) the system "Save as" dialog can be used,
 * which lets the user choose the folder and remembers it; elsewhere the file is downloaded.
 */
import filesaver from './../../../node_modules/file-saver/dist/FileSaver.min.js';

/**
 * @returns {boolean} the browser can show the system save dialog
 */
export function can_use_file_picker() {
	return typeof window != 'undefined' && typeof window.showSaveFilePicker == 'function';
}

/**
 * @param {string} name file name with extension, e.g. "photo.png"
 * @returns {{description: string, accept: object}[]|undefined} file type filter for the dialog
 */
export function picker_types(name) {
	const match = /\.([a-z0-9]{2,5})$/i.exec(String(name));
	if (!match) {
		return undefined;
	}
	const extension = `.${  match[1].toLowerCase()}`;
	const mime = {
		'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
		'.gif': 'image/gif', '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
		'.pdf': 'application/pdf', '.json': 'application/json',
	}[extension];
	if (!mime) {
		return undefined;
	}
	return [{description: match[1].toUpperCase(), accept: {[mime]: [extension]}}];
}

/**
 * @param {Blob} blob
 * @param {string} name
 * @param {boolean} use_picker true = ask where to save (when the browser can), false = download
 * @returns {Promise<boolean>} false when the user cancelled the system dialog
 */
export async function save_blob(blob, name, use_picker) {
	if (use_picker && can_use_file_picker()) {
		try {
			const handle = await window.showSaveFilePicker({suggestedName: name, types: picker_types(name)});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return true;
		}
		catch (error) {
			if (error && error.name == 'AbortError') {
				return false;
			}
			//any other problem (permissions, sandbox) - fall back to a normal download
		}
	}
	filesaver.saveAs(blob, name);
	return true;
}
