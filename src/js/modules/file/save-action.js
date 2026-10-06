import config from './../../config.js';
import canvasToBlob from './../../../../node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.min.js';
import { save_blob } from './../../libs/file-save.js';
import GIF from './../../../../node_modules/gif.js.optimized/';
import CanvasToTIFF from './../../libs/canvastotiff.js';
import { canvas_to_bmp_blob } from './../../libs/bmp.js';
import { build_pdf } from './../../libs/pdf.js';
import { fill_canvas_background, check_format_support, disable_canvas_smooth, export_as_json } from './save-helpers.js';

/**
 * saves data in requested format (pixels → file)
 *
 * @author ViliusL
 */
class File_save_action_class {

	constructor(owner) {
		this.owner = owner;
	}

	/**
	 * saves data in requested way
	 *
	 * @param {object} user_response parameters
	 * @param {boolean} autoname if use name from layer, false by default
	 */
	save_action(user_response, autoname) {
		var use_picker = Boolean(this.owner.Tools_settings.get_setting('use_file_picker'));
		var save_blob_now = (blob, name) => save_blob(blob, name, use_picker);
		var Helper = this.owner.Helper;
		var fname = user_response.name;
		if(autoname === true && user_response.layers == 'Selected'){
			fname = config.layer.name;
		}

		var quality = parseInt(user_response.quality);
		if (quality > 100 || quality < 1 || isNaN(quality) == true)
			quality = 90;
		quality = quality / 100;

		var delay = parseInt(user_response.delay);
		if (delay < 0 || isNaN(delay) == true)
			delay = 400;

		//detect type
		var type = user_response.type;
		var parts = type.split(" ");
		type = parts[0];

		//detect type from file name
		for(var i in this.owner.SAVE_TYPES) {
			if (Helper.strpos(fname, '.' + i.toLowerCase()) !== false) {
				type = i;
			}
		}

		//save default type as cookie
		if(Helper.getCookie('save_default') == '' || Helper.getCookie('save_default') != type){
			Helper.setCookie('save_default', type);
		}

		if (type != 'JSON') {
			//temp canvas
			var canvas;
			var ctx;

			//get data
			if (user_response.layers == 'Selected' && type != 'GIF') {
				canvas = this.owner.Base_layers.convert_layer_to_canvas();
				ctx = canvas.getContext("2d");
			}
			else {
				canvas = document.createElement('canvas');
				ctx = canvas.getContext("2d");
				canvas.width = config.WIDTH;
				canvas.height = config.HEIGHT;
				disable_canvas_smooth(ctx);

				this.owner.Base_layers.convert_layers_to_canvas(ctx, null, false);
			}
		}

		if (type != 'JSON' && (type == 'JPG' || type == 'PDF' || config.TRANSPARENCY == false)) {
			//add white background
			ctx.globalCompositeOperation = 'destination-over';
			fill_canvas_background(ctx, '#ffffff');
			ctx.globalCompositeOperation = 'source-over';
		}

		if (type == 'PNG') {
			//png - default format
			if (Helper.strpos(fname, '.png') == false)
				fname = fname + ".png";

			//save using lib
			canvas.toBlob(function (blob) {
				save_blob_now(blob, fname);
			});
		}
		else if (type == 'JPG') {
			//jpg
			if (Helper.strpos(fname, '.jpg') == false)
				fname = fname + ".jpg";

			canvas.toBlob(function (blob) {
				save_blob_now(blob, fname);
			}, "image/jpeg", quality);
		}
		else if (type == 'PDF') {
			//PDF - one page, the image as JPEG (a page has the size of the image at the resolution from Settings)
			if (Helper.strpos(fname, '.pdf') == false)
				fname = fname + ".pdf";
			var dpi = parseInt(this.owner.Tools_settings.get_setting('resolution'), 10) || 72;
			canvas.toBlob(async function (blob) {
				var jpeg = new Uint8Array(await blob.arrayBuffer());
				var pdf = build_pdf(jpeg, canvas.width, canvas.height, canvas.width * 72 / dpi, canvas.height * 72 / dpi);
				save_blob_now(new Blob([pdf], {type: 'application/pdf'}), fname);
			}, "image/jpeg", quality);
		}
		else if (type == 'WEBP') {
			//WEBP
			if (Helper.strpos(fname, '.webp') == false)
				fname = fname + ".webp";
			var data_header = "image/webp";

			//check support
			if (check_format_support(canvas, data_header) == false)
				return false;

			canvas.toBlob(function (blob) {
				save_blob_now(blob, fname);
			}, data_header, quality);
		}
		else if (type == 'AVIF') {
			//AVIF
			if (Helper.strpos(fname, '.avif') == false)
				fname = fname + ".avif";
			var data_header = "image/avif";

			//check support
			if (check_format_support(canvas, data_header) == false)
				return false;

			canvas.toBlob(function (blob) {
				save_blob_now(blob, fname);
			}, data_header, quality);
		}
		else if (type == 'BMP') {
			//BMP
			if (Helper.strpos(fname, '.bmp') == false)
				fname = fname + ".bmp";

			save_blob_now(canvas_to_bmp_blob(canvas), fname);
		}
		else if (type == 'TIFF') {
			//tiff
			if (Helper.strpos(fname, '.tiff') == false)
				fname = fname + ".tiff";
			var data_header = "image/tiff";

			CanvasToTIFF.toBlob(canvas, function(blob) {
				save_blob_now(blob, fname);
			}, data_header);
		}
		else if (type == 'JSON') {
			//json - full data with layers
			if (Helper.strpos(fname, '.json') == false)
				fname = fname + ".json";

			var data_json = export_as_json();

			var blob = new Blob([data_json], {type: "text/plain"});
			save_blob_now(blob, fname);
		}
		else if (type == 'GIF') {
			//gif
			var cores = navigator.hardwareConcurrency || 4;
			var gif_settings = {
				workers: cores,
				quality: 10, //1-30, lower is better
				repeat: 0,
				width: config.WIDTH,
				height: config.HEIGHT,
				dither: 'FloydSteinberg-serpentine',
				workerScript: './src/js/libs/gifjs/gif.worker.js',
			};
			if (config.TRANSPARENCY == true) {
				gif_settings.transparent = 'rgba(0,0,0,0)';
			}
			var gif = new GIF(gif_settings);

			//add frames
			for (var i = 0; i < config.layers.length; i++) {
				if (config.layers[i].visible == false)
					continue;

				ctx.clearRect(0, 0, config.WIDTH, config.HEIGHT);
				if (config.TRANSPARENCY == false) {
					fill_canvas_background(ctx, '#ffffff');
				}
				this.owner.Base_layers.convert_layers_to_canvas(ctx, config.layers[i].id, false);

				gif.addFrame(ctx, {copy: true, delay: delay});
			}
			gif.render();
			gif.on('finished', function (blob) {
				save_blob_now(blob, fname);
			});
		}
	}

}

// internal sub-module of file/save - not an app module, must not be auto-registered
File_save_action_class.auto_register = false;

export default File_save_action_class;
