import config from "../../config";
import Base_layers_class from './../../core/base-layers.js';
import File_save_class from './../file/save.js';
import Edit_selection_class from './selection.js';
import Helper_class from './../../libs/helpers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

var instance = null;

class Copy_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.File_save = new File_save_class();

		//events
		document.addEventListener('keydown', (event) => {
			var code = event.key.toLowerCase();
			var ctrlDown = event.ctrlKey || event.metaKey;
			if (this.Helper.is_input(event.target))
				return;

			if (code == "x" && ctrlDown == true && !event.shiftKey && !event.altKey) {
				//cut
				this.cut();
				event.preventDefault();
			}
			if (code == "c" && ctrlDown == true) {
				//copy to clipboard, with Shift all visible layers merged
				this.copy_to_clipboard(event.shiftKey ? 'merged' : null);
				if (event.shiftKey) {
					event.preventDefault();
				}
			}
		}, false);
	}

	/**
	 * Edit > Cut (Ctrl+X) - copies the selection to the clipboard and deletes it from the layer
	 */
	async cut() {
		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		if (this.Edit_selection.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		var copied = await this.copy_to_clipboard();
		if (copied !== true) {
			return; //never delete pixels that did not reach the clipboard
		}
		this.Edit_selection.delete();
	}

	/**
	 * Copies the selection (or the whole layer) to the clipboard
	 *
	 * @param {string|null} [mode] 'merged' copies all visible layers merged together
	 * @returns {Promise<boolean>} true when the image is in the clipboard
	 */
	async copy_to_clipboard(mode){
		var _this = this;

		const canWriteToClipboard = await this.askWritePermission();
		if (canWriteToClipboard) {

			//get data - selected part of the current layer (honors masks), or the whole layer
			if (this.Edit_selection == null) {
				this.Edit_selection = new Edit_selection_class();
			}
			var merged = mode === 'merged';
			var part = this.Edit_selection.get_selection_canvas(config.layer, merged);
			var canvas = part ? part.canvas : (merged ? this.Edit_selection.get_merged_canvas() : this.Base_layers.convert_layer_to_canvas());
			var ctx = canvas.getContext("2d");

			if (config.TRANSPARENCY == false) {
				//add white background
				ctx.globalCompositeOperation = 'destination-over';
				this.File_save.fillCanvasBackground(ctx, '#ffffff');
				ctx.globalCompositeOperation = 'source-over';
			}

			//save using lib
			try {
				var blob = await new Promise(function (resolve) {
					canvas.toBlob(resolve);
				});
				await _this.setToClipboard(blob);
				return true;
			}
			catch (error) {
				alertify.error(t('Missing permissions to write to Clipboard.cc'));
				return false;
			}
		}
		else{
			alertify.error(t('Missing permissions to write to Clipboard.cc'));
			return false;
		}
	}

	async setToClipboard(blob) {
		const data = [new ClipboardItem({ [blob.type]: blob })];
		await navigator.clipboard.write(data);
	}

	async askWritePermission() {
		try {
			// The clipboard-write permission is granted automatically to pages
			// when they are the active tab. So it's not required, but it's more safe.
			const { state } = await navigator.permissions.query({ name: 'clipboard-write' })
			return state === 'granted';
		}
		catch (error) {
			// Browser compatibility / Security error (ONLY HTTPS) ...
			return false;
		}
	}
}

export default Copy_class;
