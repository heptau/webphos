import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { is_valid_url } from './../../libs/url-validator.js';
import { validate_image_url } from './../../libs/input-validator.js';
import { get_user_error_message, safe_execute_async } from './../../libs/error-handler.js';
import { t } from '../tools/translate.js';

/**
 * opens resources from urls (images, json)
 *
 * @author ViliusL
 */
class File_open_url_class {

	constructor(owner) {
		this.owner = owner;
	}

	open_url() {

		const settings = {
			title: 'Open URL',
			params: [
				{name: "url", title: "URL:", value: ""},
			],
			on_finish: (params) => {
				// Validate URL before processing
				const validation = validate_image_url(params.url);
				if (!validation.valid) {
					alertify.error(validation.error);
					return;
				}
				this.file_open_url_handler(params);
			},
		};
		this.owner.POP.show(settings);
	}

	/**
	 * check if url has url params, for example: https://viliusle.github.io/miniPaint/?image=http://i.imgur.com/ATda8Ae.jpg
	 */
	maybe_file_open_url_handler() {
		const url_params = this.owner.Helper.get_url_parameters();

		if (url_params.image != undefined) {
			this.open_resource(url_params.image);
		}
	}

	/**
	 * includes provided resource (image or json)
	 *
	 * @param string resource_url
	 */
	open_resource(resource_url) {

		// Validate URL to prevent SSRF attacks
		if (!is_valid_url(resource_url)) {
			alertify.error(t('Invalid or unsafe URL. Only public HTTP/HTTPS URLs are allowed.'));
			return;
		}

		if(resource_url.toLowerCase().indexOf('.json') == resource_url.length - 5){
			//load json
			safe_execute_async(async () => {
				const response = await fetch(resource_url);
				if (!response.ok) {
					throw new Error(`Failed to fetch: ${  response.status}`);
				}
				const json = await response.json();
				this.owner.load_json(json, false);
			}, 'Open resource JSON').catch((error) => {
				const userMessage = get_user_error_message(error, 'Open resource');
				alertify.error(userMessage);
			});
		}
		else{
			//load image
			const data = {
				url: resource_url,
			};
			this.file_open_url_handler(data);
		}
	}

	//handler for open url. Example url: http://i.imgur.com/ATda8Ae.jpg
	file_open_url_handler(user_response) {
		const url = user_response.url;
		if (url == '')
			return;

		// Validate URL to prevent SSRF attacks
		if (!is_valid_url(url)) {
			alertify.error(t('Invalid or unsafe URL. Only public HTTP/HTTPS URLs are allowed.'));
			return;
		}

		const layer_name = url.replace(/^.*[\\/]/, '');

		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = function () {
			const new_layer = {
				name: layer_name,
				type: 'image',
				link: img,
				width: img.width,
				height: img.height,
				width_original: img.width,
				height_original: img.height,
			};
			img.onload = function () {
				config.need_render = true;
			};
			app.State.do_action(
				new app.Actions.Bundle_action('open_file_url', 'Open File URL', [
					new app.Actions.Insert_layer_action(new_layer),
					new app.Actions.Autoresize_canvas_action(img.width, img.height, null, true, true)
				])
			);
		};
		img.onerror = function (ex) {
			const userMessage = get_user_error_message(ex, 'Load image from URL');
			alertify.error(userMessage);
		};
		img.src = url;
	}

}

// internal sub-module of file/open - not an app module, must not be auto-registered
File_open_url_class.auto_register = false;

export default File_open_url_class;
