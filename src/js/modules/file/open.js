import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../../core/base-layers.js';
import Base_gui_class from './../../core/base-gui.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import Clipboard_class from './../../libs/clipboard.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import EXIF from './../../../../node_modules/exif-js/exif.js';
import GUI_tools_class from "../../core/gui/gui-tools";
import { parse_psd } from './../../libs/psd.js';
import { group_ancestors, is_isolated } from './../../libs/layer-groups.js';
import { validate_file, validate_json_file, validate_data_url, sanitize_filename } from './../../libs/input-validator.js';
import { t } from '../tools/translate.js';
import Tools_settings_class from './../tools/settings.js';
import File_open_url_class from './open-url.js';
import File_open_json_class from './open-json.js';
import File_open_webcam_class from './open-webcam.js';
import menuDefinition from './../../config-menu.js';
import { add_recent, list_recent, get_recent, clear_recent } from './../../libs/recent-files.js';

var instance = null;

/** 
 * manages files / open
 * 
 * @author ViliusL
 */
class File_open_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		var _this = this;
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Base_gui = new Base_gui_class();
		this.Helper = new Helper_class();
		this.Tools_settings = new Tools_settings_class();
		this.GUI_tools = new GUI_tools_class();

		//clipboard class
		this.Clipboard_class = new Clipboard_class(function (data, w, h) {
			_this.on_paste(data, w, h);
		});

		//sub modules
		this.url_ops = new File_open_url_class(this);
		this.json_ops = new File_open_json_class(this);
		this.webcam_ops = new File_open_webcam_class(this);

		this.events();

		this.refresh_recent_menu();

		this.maybe_file_open_url_handler();
	}

	events() {
		var _this = this;

		window.ondrop = function (e) {
			//drop
			e.preventDefault();
			_this.open_handler(e);
		};
		window.ondragover = function (e) {
			e.preventDefault();
		};
	}

	on_paste(data, width, height) {
		var new_layer = {
			name: 'Paste',
			type: 'image',
			data: data,
		};
		app.State.do_action(
			new app.Actions.Insert_layer_action(new_layer)
		);
	}

	/**
	 * fills File > Open Recent (the menu definition array is updated in place)
	 */
	async refresh_recent_menu() {
		var file_menu = menuDefinition.find((item) => item.name == 'File');
		var recent_menu = file_menu && file_menu.children.find((item) => item.name == 'Open Recent');
		if (!recent_menu) {
			return;
		}
		var items = await list_recent();
		var children = items.map((item) => ({
			name: item.name,
			target: 'file/open.open_recent',
			parameter: item.id,
			verbatim: true,
		}));
		if (children.length == 0) {
			children.push({name: 'No Recent Files', disabled: true});
		}
		else {
			children.push({divider: true});
			children.push({name: 'Clear Menu', target: 'file/open.clear_recent_files'});
		}
		recent_menu.children.splice(0, recent_menu.children.length, ...children);
	}

	/**
	 * @param {number} id id from the recent files list
	 */
	async open_recent(id) {
		var file = await get_recent(parseInt(id, 10));
		if (!file) {
			alertify.error(t('File not found.'));
			return;
		}
		await this.open_handler({target: {files: [file]}});
	}

	async clear_recent_files() {
		await clear_recent();
		await this.refresh_recent_menu();
	}

	open_file() {
		var _this = this;

		alertify.success(t('You can also drag and drop items into browser.'));

		document.getElementById("tmp").innerHTML = '';
		var a = document.createElement('input');
		a.setAttribute("id", "file_open");
		a.type = 'file';
		a.multiple = 'multiple';
		document.getElementById("tmp").appendChild(a);
		document.getElementById('file_open').addEventListener('change', function (e) {
			_this.open_handler(e);
		}, false);

		//force click
		document.querySelector('#file_open').click();
	}
	
	/**
	 * File > Open > Open as Layer - the pictures are added to the current document as new layers
	 * (File > Open File would open them in a new document tab)
	 */
	open_as_layer() {
		var _this = this;
		document.getElementById("tmp").innerHTML = '';
		var input = document.createElement('input');
		input.setAttribute("id", "file_open_layer");
		input.type = 'file';
		input.multiple = 'multiple';
		input.accept = 'image/*';
		document.getElementById("tmp").appendChild(input);
		input.addEventListener('change', function () {
			_this.add_files_as_layers(Array.from(input.files));
		}, false);
		input.click();
	}

	async add_files_as_layers(files) {
		for (var file of files) {
			var validation = validate_file(file);
			if (!validation.valid) {
				alertify.error(validation.error);
				continue;
			}
			try {
				//createImageBitmap: the page does not allow blob: images (CSP)
				var bitmap = await createImageBitmap(file);
				var canvas = document.createElement('canvas');
				canvas.width = bitmap.width;
				canvas.height = bitmap.height;
				canvas.getContext('2d').drawImage(bitmap, 0, 0);
				if (bitmap.close) {
					bitmap.close();
				}
				await app.State.do_action(
					new app.Actions.Bundle_action('open_as_layer', 'Open as Layer', [
						new app.Actions.Insert_layer_action({
							name: sanitize_filename(file.name),
							type: 'image',
							data: canvas.toDataURL('image/png'),
						}, false),
					])
				);
			}
			catch (error) {
				alertify.error(t('Sorry, image could not be loaded.'));
			}
		}
	}

	open_webcam(){
		return this.webcam_ops.open_webcam();
	}

	open_dir() {
		var _this = this;

		document.getElementById("tmp").innerHTML = '';
		var a = document.createElement('input');
		a.setAttribute("id", "file_open_dir");
		a.type = 'file';
		a.webkitdirectory = 'webkitdirectory';
		document.getElementById("tmp").appendChild(a);
		document.getElementById('file_open_dir').addEventListener('change', function (e) {
			_this.open_handler(e);
		}, false);

		//force click
		document.querySelector('#file_open_dir').click();
	}

	/**
	 * opens data URLs, like: "data:image/png;base64,xxxxxx"
	 * 
	 * data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVQYV2N89+7df0FBQQbG/////3///j0DAF9wCsg9spQfAAAAAElFTkSuQmCC
	 */
	open_data_url() {
		var _this = this;

		var settings = {
			title: 'Open data URL',
			params: [
				{name: "data", title: "Data URL:", type: "textarea", value: ""},
			],
			on_finish: function (params) {
				_this.file_open_data_url_handler(params.data);
			},
		};
		this.POP.show(settings);
	}

	file_open_data_url_handler(data) {
		var _this = this;
		if (data == '')
			return;

		// Validate data URL
		var validation = validate_data_url(data);
		if (!validation.valid) {
			alertify.error(validation.error);
			return;
		}

		var img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = function () {
			var new_layer = {
				name: "Data URL",
				type: 'image',
				link: img,
				width: img.width,
				height: img.height,
				width_original: img.width,
				height_original: img.height,
			};
			app.State.do_action(
				new app.Actions.Bundle_action('open_file_data_url', 'Open File Data URL', [
					new app.Actions.Insert_layer_action(new_layer),
					new app.Actions.Autoresize_canvas_action(img.width, img.height, null, true, true)
				])
			);
			img.onload = function () {
				config.need_render = true;
			};
		};
		img.onerror = function (ex) {
			alertify.error(t('Sorry, image could not be loaded. Try copy image and paste it.'));
		};
		img.src = data;
	}

	open_url() {
		return this.url_ops.open_url();
	}

	async open_handler(e) {
		var _this = this;
		var files = e.target.files;

		var auto_increment = this.Base_layers.auto_increment;

		if (files == undefined) {
			//drag and drop
			files = e.dataTransfer.files;
		}

		//an image opens in a new document tab (if the current document has content and the setting allows it)
		var has_image = Array.from(files).some((file) => (file.type && file.type.match('image.*')) || /\.psd$/i.test(file.name));
		if (has_image && this.Tools_settings.get_setting('open_in_new_tab') && app.GUI.GUI_documents.has_content()) {
			await app.GUI.GUI_documents.new_blank();
			auto_increment = this.Base_layers.auto_increment;
		}

		//sort
		var orders = [];
		for (var i = 0, f; i < files.length; i++) {
			orders.push(files[i].name);
		}
		orders.sort();
		var order_map = [];
		for (var i in orders) {
			order_map[orders[i]] = parseInt(i);
		}

		//check if dropped directory
		var dir_opened = false;
		if (e.dataTransfer && e.dataTransfer.items)	{
			var items = e.dataTransfer.items;
			for (var i=0; i<items.length; i++) {
				var item = items[i].webkitGetAsEntry();
				if(item && item.isDirectory){
					dir_opened = true;
				}
			}
		}

		for (var i = 0, f; i < files.length; i++) {
			f = files[i];

			//Photoshop files are read by our own reader
			if (/\.psd$/i.test(f.name)) {
				await this.open_psd(f);
				continue;
			}

			// Validate file
			var fileValidation = validate_file(f);
			if (!fileValidation.valid) {
				if(dir_opened == false) {
					alertify.error(fileValidation.error);
				}
				continue;
			}

			// Sanitize filename
			var sanitizedName = sanitize_filename(f.name);

			//remember for File > Open Recent
			add_recent(f, sanitizedName).then(() => this.refresh_recent_menu());

			if (files.length == 1) {
				this.SAVE_NAME = sanitizedName.split('.')[sanitizedName.split('.').length - 2];
			}

			var FR = new FileReader();
			FR.file = files[i];

			FR.onload = function (event) {
				if (this.file.type.match('image.*')) {
					var order = auto_increment + order_map[this.file.name];
					//image
					var new_layer = {
						name: sanitizedName,
						type: 'image',
						data: event.target.result,
						order: order,
						_exif: _this.extract_exif(this.file)
					};
					app.State.do_action(
						new app.Actions.Bundle_action('open_image', 'Open Image', [
							new app.Actions.Insert_layer_action(new_layer)
						])
					);
				}
				else {
					//json - validate JSON file
					validate_json_file(this.file).then(function(result) {
						if (!result.valid) {
							alertify.error(result.error);
							return;
						}
						_this.load_json(result.data);
					});
				}
			};
			if (f.type == "text/plain")
				FR.readAsText(f);
			else if (f.name.match('.json'))
				FR.readAsText(f);
			else
				FR.readAsDataURL(f);

			//sleep after last image import, it maybe not be finished yet
			await new Promise(r => setTimeout(r, 10));
		}

		//try to open dropped directory
		if (e.dataTransfer && e.dataTransfer.items)	{
			var items = e.dataTransfer.items;
			for (var i=0; i<items.length; i++) {
				var item = items[i].webkitGetAsEntry();
				if (item && item.isDirectory == true) {
					this.traverseFileTree(item);
				}
			}
		}
	}

	/**
	 * Opens a Photoshop file: every layer becomes a layer here (pixels, place, opacity, visibility, blend mode, name).
	 * Effects, masks, text, smart objects and groups are not read.
	 *
	 * @param {File} file
	 */
	async open_psd(file) {
		if (file.size > 300 * 1024 * 1024) {
			alertify.error(t('The file is too big.'));
			return;
		}
		var psd;
		try {
			psd = parse_psd(await file.arrayBuffer());
		}
		catch (error) {
			alertify.error(t('The Photoshop file could not be read:') + ' ' + t(error && error.message ? error.message : 'Unknown error'));
			return;
		}
		var name = sanitize_filename(file.name);
		this.SAVE_NAME = name.replace(/\.psd$/i, '');
		var to_data = (data, width, height) => {
			var canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
			var url = canvas.toDataURL('image/png');
			canvas.width = 1;
			canvas.height = 1;
			return url;
		};
		//the opacity and blend mode of the groups of a layer, as they are kept on every layer of a group
		var group_props_of_layer = (layer) => {
			var map = {};
			group_ancestors(layer.group).forEach((path) => {
				var group = psd.groups[path];
				if (group && is_isolated({opacity: group.opacity, composition: group.composition, mask: null})) {
					map[path] = {opacity: group.opacity, composition: group.composition, mask: null};
				}
			});
			return Object.keys(map).length > 0 ? map : null;
		};
		var layers = psd.layers;
		if (layers.length == 0 && psd.composite) {
			layers = [{name: name, x: 0, y: 0, width: psd.width, height: psd.height, opacity: 100, visible: true, composition: 'source-over', data: psd.composite}];
		}
		if (layers.length == 0) {
			alertify.error(t('The Photoshop file has no picture.'));
			return;
		}
		var actions = [];
		var first = layers[0];
		if (first.x != 0 || first.y != 0 || first.width != psd.width || first.height != psd.height) {
			//the first layer sets the size of the document, so a transparent one with the size of the file comes first
			var base = document.createElement('canvas');
			base.width = psd.width;
			base.height = psd.height;
			actions.push(new app.Actions.Insert_layer_action({
				name: t('Canvas'), type: 'image', data: base.toDataURL('image/png'), x: 0, y: 0, width: psd.width, height: psd.height,
			}));
		}
		layers.forEach((layer) => {
			actions.push(new app.Actions.Insert_layer_action({
				name: layer.name,
				type: 'image',
				data: to_data(layer.data, layer.width, layer.height),
				x: layer.x,
				y: layer.y,
				width: layer.width,
				height: layer.height,
				opacity: layer.opacity,
				visible: layer.visible,
				composition: layer.composition,
				group: layer.group || null,
				group_props: group_props_of_layer(layer),
			}, layers.indexOf(layer) > 0 || actions.length > 0 ? false : true));
		});
		await app.State.do_action(new app.Actions.Bundle_action('open_psd', 'Open Image', actions));
	}

	traverseFileTree(item, path) {
		var _this = this;
		var auto_increment = this.Base_layers.auto_increment;

		path = path || "";
		if (item.isFile) {
			item.file(async function(file) {
				var FR = new FileReader();
				FR.file = file;

				FR.onload = function (event) {
					if (this.file.type.match('image.*')
						//below is fix for firefox, it has empty type
						|| (this.file.type == '' && this.file.name.match(/\.(png|jpg|jpeg|webp|gif|avif)/g))) {
						//image
						var new_layer = {
							name: this.file.name,
							type: 'image',
							data: event.target.result,
							_exif: _this.extract_exif(this.file)
						};
						app.State.do_action(
							new app.Actions.Bundle_action('open_image', 'Open Image', [
								new app.Actions.Insert_layer_action(new_layer)
							])
						);
					}
				};

				FR.readAsDataURL(file);

				//sleep after last image import, it maybe not be finished yet
				await new Promise(r => setTimeout(r, 10));

			});
		}
		else if (item.isDirectory) {
			// Get folder contents
			var dirReader = item.createReader();
			dirReader.readEntries(function(entries) {
				for (var i=0; i<entries.length; i++) {
					_this.traverseFileTree(entries[i], path + item.name + "/");
				}
			});
		}
	}
	
	/**
	 * check if url has url params, for example: https://viliusle.github.io/miniPaint/?image=http://i.imgur.com/ATda8Ae.jpg
	 */
	maybe_file_open_url_handler() {
		return this.url_ops.maybe_file_open_url_handler();
	}

	/**
	 * includes provided resource (image or json)
	 *
	 * @param string resource_url
	 */
	open_resource(resource_url) {
		return this.url_ops.open_resource(resource_url);
	}

	//handler for open url. Example url: http://i.imgur.com/ATda8Ae.jpg
	file_open_url_handler(user_response) {
		return this.url_ops.file_open_url_handler(user_response);
	}

	load_json(data) {
		return this.json_ops.load_json(data);
	}

	/**
	 * Returns an action that saves the exif data of the provided object to the current layer
	 */
	extract_exif(object) {
		var exif_data = {
			general: [],
			exif: [],
		};

		//exif data
		EXIF.getData(object, function () {
			exif_data.exif = this.exifdata;
			delete this.exifdata.thumbnail;
		});

		//general
		if (object.name != undefined)
			exif_data.general.Name = object.name;
		if (object.size != undefined)
			exif_data.general.Size = this.Helper.number_format(object.size / 1000, 2) + ' KB';
		if (object.type != undefined)
			exif_data.general.Type = object.type;
		if (object.lastModified != undefined)
			exif_data.general['Last modified'] = this.Helper.format_time(object.lastModified);

		return exif_data;
	}

}

export default File_open_class;

