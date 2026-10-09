import config from './../../config.js';
import CanvasToTIFF from './../../libs/canvastotiff.js';
import { canvas_to_bmp_blob } from './../../libs/bmp.js';
import { fill_canvas_background, check_format_support, disable_canvas_smooth, export_as_json } from './save-helpers.js';

/**
 * save dialog parameter change handler - calculates future file size
 *
 * @author ViliusL
 */
class File_save_size_class {

	constructor(owner) {
		this.owner = owner;
	}

	update_file_size(file_size) {
		//the size is calculated asynchronously, the dialog may be closed by then
		const element = document.getElementById('file_size');
		if (!element) {
			return;
		}
		if (typeof file_size == 'string') {
			element.innerHTML = file_size;
			return;
		}

		if (file_size > 1024 * 1024)
			file_size = `${this.owner.Helper.number_format(file_size / 1024 / 1024, 2)  } MB`;
		else if (file_size > 1024)
			file_size = `${this.owner.Helper.number_format(file_size / 1024, 2)  } KB`;
		else
			file_size = `${file_size  } B`;
		element.innerHTML = file_size;
	}

	/**
	 * /activated on save dialog parameters change - used for calculating file size
	 *
	 * @param {boolean} calculate_file_size
	 */
	save_dialog_onchange(calculate_file_size) {
		let canvas, ctx, data_header;
		const user_response = this.owner.POP.get_params();

		let quality = parseInt(user_response.quality);
		if (quality > 100 || quality < 1 || isNaN(quality) == true)
			quality = 90;
		quality = quality / 100;

		//detect type
		let type = user_response.type;
		const parts = type.split(" ");
		type = parts[0];

		if (type == 'JPG' || type == 'WEBP' || type == 'AVIF' || type == 'PDF')
			document.getElementById('popup-tr-quality').style.display = '';
		else
			document.getElementById('popup-tr-quality').style.display = 'none';

		if (type == 'GIF')
			document.getElementById('popup-tr-delay').style.display = '';
		else
			document.getElementById('popup-tr-delay').style.display = 'none';

		if (type == 'JSON' || type == 'GIF')
			document.getElementById('popup-tr-layers').style.display = 'none';
		else
			document.getElementById('popup-tr-layers').style.display = '';

		if (user_response.layers == 'Separated')
			document.getElementById('pop_data_name').disabled = true;
		else
			document.getElementById('pop_data_name').disabled = false;

		if (user_response.layers == 'Separated (original types)') {
			if(document.getElementById('popup-group-type')) {
				document.getElementById('popup-group-type').style.opacity = "0.5";
			}
			document.getElementById('popup-tr-quality').style.display = '';
		}
		else {
			if(document.getElementById('popup-group-type')) {
				document.getElementById('popup-group-type').style.opacity = "1";
			}
		}

		if(calculate_file_size == false){
			return;
		}

		this.update_file_size('...');

		if (user_response.calc_size == false || user_response.layers == 'Separated'
			|| user_response.layers == 'Separated (original types)') {

			this.update_file_size('-');
			return;
		}

		if (type != 'JSON') {
			//create temp canvas
			canvas = document.createElement('canvas');
			ctx = canvas.getContext("2d");
			canvas.width = config.WIDTH;
			canvas.height = config.HEIGHT;
			disable_canvas_smooth(ctx);

			//ask data
			if (user_response.layers == 'Selected' && type != 'GIF' && config.layer.type != null) {
				//only current layer !!!
				const layer = config.layer;

				let initial_x = null;
				let initial_y = null;
				if (layer.x != null && layer.y != null && layer.width != null && layer.height != null) {
					//change position to top left corner
					initial_x = layer.x;
					initial_y = layer.y;
					layer.x = 0;
					layer.y = 0;

					canvas.width = layer.width;
					canvas.height = layer.height;
				}

				this.owner.Base_layers.convert_layers_to_canvas(ctx, layer.id, false);

				if (initial_x != null) {
					//restore position
					layer.x = initial_x;
					layer.y = initial_y;
				}
			}
			else {
				this.owner.Base_layers.convert_layers_to_canvas(ctx, null, false);
			}
		}

		if (type != 'JSON' && (type == 'JPG' || type == 'PDF' || config.TRANSPARENCY == false)) {
			//add white background
			ctx.globalCompositeOperation = 'destination-over';
			fill_canvas_background(ctx, '#ffffff');
			ctx.globalCompositeOperation = 'source-over';
		}

		//calc size
		if (type == 'PNG') {
			//png
			canvas.toBlob((blob) => {
				this.update_file_size(blob.size);
			});
		}
		else if (type == 'JPG') {
			//jpg
			canvas.toBlob((blob) => {
				this.update_file_size(blob.size);
			}, "image/jpeg", quality);
		}
		else if (type == 'PDF') {
			//pdf = jpeg + small header
			canvas.toBlob((blob) => {
				this.update_file_size(blob.size + 900);
			}, "image/jpeg", quality);
		}
		else if (type == 'WEBP') {
			//WEBP
			data_header = "image/webp";

			//check support
			if (check_format_support(canvas, data_header, false) == false) {
				this.update_file_size('-');
				return;
			}

			canvas.toBlob((blob) => {
				this.update_file_size(blob.size);
			}, data_header, quality);
		}
		else if (type == 'AVIF') {
			//AVIF
			data_header = "image/avif";

			//check support
			if (check_format_support(canvas, data_header, false) == false) {
				this.update_file_size('-');
				return;
			}

			canvas.toBlob((blob) => {
				this.update_file_size(blob.size);
			}, data_header, quality);
		}
		else if (type == 'BMP') {
			//bmp

			this.update_file_size(canvas_to_bmp_blob(canvas).size);
		}
		else if (type == 'TIFF') {
			//tiff
			data_header = "image/tiff";

			CanvasToTIFF.toBlob(canvas, (blob) => {
				this.update_file_size(blob.size);
			}, data_header);
		}
		else if (type == 'JSON') {
			//json
			const data_json = export_as_json();

			const blob = new Blob([data_json], {type: "text/plain"});
			this.update_file_size(blob.size);
		}
		else if (type == 'GIF') {
			//gif
			this.update_file_size('-');
		}
	}

}

// internal sub-module of file/save - not an app module, must not be auto-registered
File_save_size_class.auto_register = false;

export default File_save_size_class;
