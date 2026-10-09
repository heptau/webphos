import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * canvas / format helpers shared by save dialogs and save actions
 *
 * @author ViliusL
 */
export function fill_canvas_background(ctx, color, width = config.WIDTH, height = config.HEIGHT) {
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	ctx.fillStyle = color;
	ctx.fill();
}

export function check_format_support(canvas, data_header, show_error) {
	const data = canvas.toDataURL(data_header);
	const actualType = data.replace(/^data:([^;]*).*/, '$1');

	if (data_header != actualType && data_header != "text/plain") {
		if (show_error == undefined || show_error == true) {
			//error - no support
			alertify.error(t('Your browser does not support this format.'));
		}
		return false;
	}
	return true;
}

/**
 * removes smoothing, because it look ugly during zoom
 *
 * @param {ctx} ctx
 */
export function disable_canvas_smooth(ctx) {
	ctx.webkitImageSmoothingEnabled = false;
	ctx.oImageSmoothingEnabled = false;
	ctx.msImageSmoothingEnabled = false;
	ctx.imageSmoothingEnabled = false;
}

/**
 * exports all layers to JSON
 */
export function export_as_json() {
	//get date
	let i;
	let today = new Date();
	const yyyy = today.getFullYear();
	let mm = today.getMonth() + 1; //January is 0!
	let dd = today.getDate();
	if (dd < 10)
		dd = `0${  dd}`;
	if (mm < 10)
		mm = `0${  mm}`;
	today = `${yyyy  }-${mm}-${  dd}`;

	//data
	const export_data = {};
	export_data.info = {
		width: config.WIDTH,
		height: config.HEIGHT,
		about: 'Image data with multi-layers. Can be opened using Lumifex - '
			+ 'https://github.com/heptau/lumifex',
		date: today,
		version: VERSION,
		layer_active: config.layer.id,
		guides: config.guides,
		resolution: config.RESOLUTION,
		units: config.UNITS,
	};

	//fonts
	export_data.user_fonts = config.user_fonts;

	//layers
	export_data.layers = [];
	for (i in config.layers) {
		const layer = {};
		for (const j in config.layers[i]) {
			if (j[0] == '_' || j == 'link_canvas') {
				//private data
				continue;
			}

			layer[j] = config.layers[i][j];
		}
		export_data.layers.push(layer);
	}

	//image data
	export_data.data = [];
	for (i in config.layers) {
		if (config.layers[i].type != 'image')
			continue;

		const link = config.layers[i].link;
		//original size; when it is missing (e.g. some vector images), the real size of the image is used
		const original_w = parseInt(config.layers[i].width_original, 10) || (link && (link.naturalWidth || link.width)) || parseInt(config.layers[i].width, 10) || 1;
		const original_h = parseInt(config.layers[i].height_original, 10) || (link && (link.naturalHeight || link.height)) || parseInt(config.layers[i].height, 10) || 1;
		const canvas = document.createElement('canvas');
		canvas.width = original_w;
		canvas.height = original_h;
		disable_canvas_smooth(canvas.getContext("2d"));

		//scaled to the original size - vector images (SVG) can have a different natural size
		canvas.getContext('2d').drawImage(link, 0, 0, original_w, original_h);

		const data_tmp = canvas.toDataURL("image/png");
		export_data.data.push(
			{
				id: config.layers[i].id,
				data: data_tmp,
			}
		);
		canvas.width = 1;
		canvas.height = 1;
	}

	return JSON.stringify(export_data, null, "\t");
}
