/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import app from './../app.js';
import config from './../config.js';
import Base_layers_class from './base-layers.js';
import GUI_tools_class from './gui/gui-tools.js';
import GUI_preview_class from './gui/gui-preview.js';
import GUI_colors_class from './gui/gui-colors.js';
import GUI_layers_class from './gui/gui-layers.js';
import GUI_information_class from './gui/gui-information.js';
import GUI_history_class from './gui/gui-history.js';
import GUI_histogram_class from './gui/gui-histogram.js';
import GUI_documents_class from './gui/gui-documents.js';
import GUI_context_menu_class, { CANVAS_MENU, LAYER_MENU } from './gui/gui-context-menu.js';
import { restore_panels } from './../libs/panels.js';
import GUI_details_class from './gui/gui-details.js';
import GUI_menu_class from './gui/gui-menu.js';
import Tools_translate_class, { t } from './../modules/tools/translate.js';
import Tools_settings_class from './../modules/tools/settings.js';
import Helper_class from './../libs/helpers.js';
import shortcutsDefinition from './../config-shortcuts.js';
import menuDefinition from './../config-menu.js';
import Shortcut_manager_class from './shortcut-manager.js';
import { is_typing_target } from './../libs/shortcuts.js';
import { attach_long_press, long_press_allowed } from './../libs/long-press.js';
import { AUTO, normalize_lang_code, resolve_theme, system_prefers_dark, on_system_theme_change } from './../libs/system-preferences.js';
import { is_pixel_grid_visible, pixel_grid_positions } from './../libs/pixel-grid.js';
import { note_target, set_allowed_targets, collect_targets } from './../libs/actions.js';
import { is_transformed } from './../libs/view-transform.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';

var instance = null;

/**
 * Main GUI class
 */
class Base_gui_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Helper = new Helper_class();
		this.Base_layers = new Base_layers_class();

		//last used menu id
		this.last_menu = '';

		//grid dimensions config
		this.grid_size = [50, 50];

		//if grid is visible
		this.grid = false;

		this.canvas_offset = {x: 0, y: 0};

		//common image dimensions
		this.common_dimensions = [
			[640, 480, '480p'],
			[800, 600, 'SVGA'],
			[1024, 768, 'XGA'],
			[1280, 720, 'hdtv, 720p'],
			[1600, 1200, 'UXGA'],
			[1920, 1080, 'Full HD, 1080p'],
			[3840, 2160, '4K UHD'],
			//[7680,4320, '8K UHD'],
		];

		//ready-made sizes for File > New (not used for the automatic canvas size)
		this.preset_dimensions = [
			[1080, 1080, 'Instagram post'],
			[1080, 1350, 'Instagram portrait'],
			[1080, 1920, 'Story / Reels'],
			[1200, 630, 'Facebook / link preview'],
			[1500, 500, 'Social header'],
			[1280, 720, 'YouTube thumbnail'],
			[2480, 3508, 'A4, 300 dpi'],
			[512, 512, 'App icon'],
			[1024, 1024, 'App icon 2x'],
			[32, 32, 'Favicon'],
		];

		this.Shortcuts = new Shortcut_manager_class();
		this.GUI_tools = new GUI_tools_class(this);
		this.GUI_preview = new GUI_preview_class(this);
		this.GUI_colors = new GUI_colors_class(this);
		this.GUI_layers = new GUI_layers_class(this);
		this.GUI_information = new GUI_information_class(this);
		this.GUI_details = new GUI_details_class(this);
		this.GUI_history = new GUI_history_class();
		this.GUI_histogram = new GUI_histogram_class();
		this.GUI_documents = new GUI_documents_class();
		this.GUI_menu = new GUI_menu_class();
		this.Tools_translate = new Tools_translate_class();
		this.Tools_settings = new Tools_settings_class();
		this.modules = {};
	}

	init() {
		this.load_modules();
		this.load_default_values();
		this.render_main_gui();
		this.init_service_worker();
	}

	load_modules() {
		var _this = this;
		var modules_context = require.context("./../modules/", true, /\.js$/);
		modules_context.keys().forEach(function (key) {
			if (key.indexOf('Base' + '/') < 0) {
				var moduleKey = key.replace('./', '').replace('.js', '');
				var classObj = modules_context(key);
				// skip helper files without class export and internal sub-modules
				if (typeof classObj.default !== 'function' || classObj.default.auto_register === false) {
					return;
				}
				_this.modules[moduleKey] = new classObj.default();
			}
		});
	}

	load_default_values() {
		//transparency
		var transparency_cookie = this.Helper.getCookie('transparency');
		if (transparency_cookie === null) {
			//default
			config.TRANSPARENCY = false;
		}
		if (transparency_cookie) {
			config.TRANSPARENCY = true;
		}
		else {
			config.TRANSPARENCY = false;
		}
		
		//transparency_type
		var transparency_type = this.Helper.getCookie('transparency_type');
		if (transparency_type === null) {
			//default
			config.TRANSPARENCY_TYPE = 'squares';
		}
		if (transparency_type) {
			config.TRANSPARENCY_TYPE = transparency_type;
		}

		//snap
		var snap_cookie = this.Helper.getCookie('snap');
		if (snap_cookie === null) {
			//default
			config.SNAP = true;
		}
		else{
			config.SNAP = Boolean(snap_cookie);
		}

		//guides
		var guides_cookie = this.Helper.getCookie('guides');
		if (guides_cookie === null) {
			//default
			config.guides_enabled = true;
		}
		else{
			config.guides_enabled = Boolean(guides_cookie);
		}
	}

	render_main_gui() {
		this.autodetect_dimensions();

		this.change_theme();
		this.apply_large_ui();
		this.prepare_canvas();
		this.GUI_tools.render_main_tools();
		this.GUI_preview.render_main_preview();
		this.GUI_colors.render_main_colors();
		this.GUI_layers.render_main_layers();
		this.GUI_information.render_main_information();
		this.GUI_details.render_main_details();
		this.GUI_history.render_main_history();
		this.GUI_histogram.render_main_histogram();
		this.GUI_documents.render_main_documents();
		this.GUI_menu.render_main();
		this.load_saved_changes();

		this.set_events();
		this.load_translations();
	}

	init_service_worker() {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('sw.js').then((reg) => {
				console.log('[SW] Service worker registered:', reg.scope);
				
				// Check for updates
				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New version available
							console.log('[SW] New version available');
							if (confirm(t('A new version is available. Refresh the page?'))) {
								window.location.reload();
							}
						}
					});
				});
			}).catch((err) => {
				console.warn('[SW] Error registering service worker:', err);
			});
			
			// Listen for controller change (new SW activated)
			let refreshing = false;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (refreshing) return;
				refreshing = true;
				window.location.reload();
			});
		}
	}

	set_events() {
		var _this = this;

		//the commands that actions may record and play
		set_allowed_targets(collect_targets(menuDefinition, shortcutsDefinition));

		//menu events
		this.GUI_menu.on('select_target', (target, object) => {
			return this.run_target(target, object.parameter ?? null);
		});

		//keyboard shortcuts (the defaults and the changes of the user are in core/shortcut-manager.js)
		document.addEventListener('keydown', (event) => {
			if (is_typing_target(event.target) || document.getElementById('popups').children.length > 0)
				return;

			var entry = this.Shortcuts.find(event);
			if (entry == null) {
				return;
			}
			event.preventDefault();
			//holding the key repeats the event; most commands switch something, so they run once per press
			if (event.repeat && !entry.repeat) {
				return;
			}
			if (entry.tool) {
				this.GUI_tools.activate_tool(entry.tool);
			}
			else {
				this.run_target(entry.target, entry.parameter ?? null);
			}
		}, false);

		//registerToggleAbility
		var targets = document.querySelectorAll('.toggle');
		for (var i = 0; i < targets.length; i++) {
			if (targets[i].dataset.target == undefined)
				continue;
			targets[i].addEventListener('click', function (event) {
				this.classList.toggle('toggled');
				var target = document.getElementById(this.dataset.target);
				target.classList.toggle('hidden');
				//save
				if (target.classList.contains('hidden') == false) {
					_this.Helper.setCookie(this.dataset.target, 1);
					if (this.dataset.target == 'toggle_history') {
						_this.GUI_history.render();
					}
					if (this.dataset.target == 'toggle_histogram') {
						_this.GUI_histogram.render();
					}
				}
				else
					_this.Helper.setCookie(this.dataset.target, 0);
			});
		}

		document.getElementById('left_mobile_menu_button').addEventListener('click', function (event) {
			document.querySelector('.sidebar_left').classList.toggle('active');
		});
		document.getElementById('mobile_menu_button').addEventListener('click', function (event) {
			document.querySelector('.sidebar_right').classList.toggle('active');
		});
		window.addEventListener('resize', function (event) {
			//resize
			_this.prepare_canvas();
			config.need_render = true;
		}, false);
		this.check_canvas_offset();

		//confirmation on exit
		var exit_confirm = this.Tools_settings.get_setting('exit_confirm');
		window.addEventListener('beforeunload', function (e) {
			if(exit_confirm && !window.minipaint_quitting && (config.layers.length > 1 || _this.Base_layers.is_layer_empty(config.layer.id) == false)){
				e.preventDefault();
				e.returnValue = '';
			}
			return undefined;
		});

		this.GUI_context_menu = new GUI_context_menu_class();
		document.getElementById('canvas_minipaint').addEventListener('contextmenu', function (e) {
			e.preventDefault();
			//clone tool uses right click itself
			if (config.TOOL && config.TOOL.name == 'clone') {
				return;
			}
			_this.GUI_context_menu.show(e, CANVAS_MENU, (target, param) => _this.run_target(target, param));
		}, false);
		var show_layer_menu = function (e) {
			var button = e.target.closest ? e.target.closest('#layer_name') : null;
			if (!button || !button.dataset.id) {
				return;
			}
			e.preventDefault();
			var show = () => _this.GUI_context_menu.show(e, LAYER_MENU, (target, param) => _this.run_target(target, param));
			if (button.dataset.id != config.layer.id) {
				//select the layer under the pointer first
				Promise.resolve(app.State.do_action(new app.Actions.Select_layer_action(button.dataset.id))).then(show);
			}
			else {
				show();
			}
		};
		document.getElementById('layers_base').addEventListener('contextmenu', show_layer_menu, false);

		//a touch screen has no right button: holding a finger opens the same menus
		var touch_event = (press) => ({clientX: press.clientX, clientY: press.clientY, target: press.target, preventDefault: function () {}});
		attach_long_press(document.getElementById('canvas_minipaint'), (press) => {
			_this.GUI_context_menu.show(touch_event(press), CANVAS_MENU, (target, param) => _this.run_target(target, param));
		}, {allowed: () => long_press_allowed(config.TOOL && config.TOOL.name)});
		attach_long_press(document.getElementById('layers_base'), (press) => {
			show_layer_menu(touch_event(press));
		});
	}

	/**
	 * call module function
	 *
	 * @param {string} target format "module.function", e.g. "image/flip.vertical"
	 * @param {*} param
	 */
	async run_target(target, param = null) {
		//an action that is being recorded keeps the command (and the settings of its dialog, see libs/popup.js)
		note_target(target, param);

		//Edit > Repeat Last Command remembers adjustments and effects
		if (target.indexOf('image/') == 0 || target.indexOf('effects/') == 0) {
			if (target.indexOf('image/adjustments.repeat_last') < 0 && target.indexOf('image/information') < 0) {
				this.last_command = {target: target, parameter: param};
			}
		}
		var parts = target.split('.');
		var module = parts[0];
		var function_name = parts[1];

		//call module
		if (this.modules[module] == undefined) {
			alertify.error(t('Modules class not found: ') + module);
			return;
		}
		
		// Handle lazy-loaded modules
		var moduleObj = this.modules[module];
		if (moduleObj._lazy && moduleObj._get_instance) {
			moduleObj = await moduleObj._get_instance();
			this.modules[module] = moduleObj; // Cache the instance
		}
		
		if (moduleObj[function_name] == undefined) {
			alertify.error(t('Module function not found. ') + module + '.' + function_name);
			return;
		}
		return moduleObj[function_name](param);
	}

	check_canvas_offset() {
		//calc canvas position offset
		var bodyRect = document.body.getBoundingClientRect();
		var canvas = document.getElementById('canvas_minipaint');
		var canvas_el = canvas.getBoundingClientRect();
		var left = canvas_el.left;
		var top = canvas_el.top;
		if (is_transformed(config.view)) {
			//the view is turned or mirrored: the place of the canvas without that
			left = canvas_el.left + canvas_el.width / 2 - canvas.offsetWidth / 2;
			top = canvas_el.top + canvas_el.height / 2 - canvas.offsetHeight / 2;
		}
		this.canvas_offset.x = left - bodyRect.left;
		this.canvas_offset.y = top - bodyRect.top;
	}

	prepare_canvas() {
		var canvas = document.getElementById('canvas_minipaint');
		var ctx = canvas.getContext("2d");

		var wrapper = document.getElementById('main_wrapper');
		var page_w = wrapper.clientWidth;
		var page_h = wrapper.clientHeight;

		var w = Math.min(Math.ceil(config.WIDTH * config.ZOOM), page_w);
		var h = Math.min(Math.ceil(config.HEIGHT * config.ZOOM), page_h);

		canvas.width = w;
		canvas.height = h;

		config.visible_width = w;
		config.visible_height = h;

		if(config.ZOOM >= 1) {
			ctx.imageSmoothingEnabled = false;
		}
		else{
			ctx.imageSmoothingEnabled = true;
		}

		this.render_canvas_background('canvas_minipaint');

		//change wrapper dimensions
		document.getElementById('canvas_wrapper').style.width = w + 'px';
		document.getElementById('canvas_wrapper').style.height = h + 'px';

		this.check_canvas_offset();
	}

	load_saved_changes() {
		restore_panels();
		var targets = document.querySelectorAll('.toggle');
		for (var i = 0; i < targets.length; i++) {
			if (targets[i].dataset.target == undefined)
				continue;

			var target = document.getElementById(targets[i].dataset.target);
			var saved = this.Helper.getCookie(targets[i].dataset.target);
			//layer details are collapsed by default, so the Layers panel has enough space
			var collapsed = saved === 0 || ((saved === null || saved === undefined) && (target.id == 'toggle_details' || target.id == 'toggle_history' || target.id == 'toggle_histogram'));
			if (collapsed) {
				targets[i].classList.toggle('toggled');
				target.classList.add('hidden');
			}
		}
	}

	load_translations() {
		var lang = this.Tools_translate.get_language_setting();
		this.Tools_translate.auto = (lang == AUTO);
		if (lang == AUTO) {
			lang = this.Tools_translate.get_system_language();
		}
		
		//load from params
		var params = this.Helper.get_url_parameters();
		if(params.lang != undefined){
			lang = normalize_lang_code(params.lang) || lang;
			this.Tools_translate.auto = false;
		}
		
		if (lang != null && lang != config.LANG) {
			this.Tools_translate.translate(lang);
		}
	}

	autodetect_dimensions() {
		var wrapper = document.getElementById('main_wrapper');
		var page_w = wrapper.clientWidth;
		var page_h = wrapper.clientHeight;
		var auto_size = false;

		//use largest possible
		for (var i = this.common_dimensions.length - 1; i >= 0; i--) {
			if (this.common_dimensions[i][0] > page_w
				|| this.common_dimensions[i][1] > page_h) {
				//browser size is too small
				continue;
			}
			config.WIDTH = parseInt(this.common_dimensions[i][0]);
			config.HEIGHT = parseInt(this.common_dimensions[i][1]);
			auto_size = true;
			break;
		}

		if (auto_size == false) {
			//screen size is smaller then 400x300
			config.WIDTH = parseInt(page_w) - 15;
			config.HEIGHT = parseInt(page_h) - 10;
		}
	}

	render_canvas_background(canvas_id, gap) {
		if (gap == undefined)
			gap = 10;

		var target = document.getElementById(canvas_id + '_background');

		if (config.TRANSPARENCY == false) {
			target.className = 'transparent-grid white';
			return false;
		}
		else{
			target.className = 'transparent-grid ' + config.TRANSPARENCY_TYPE;
		}
		target.style.backgroundSize = (gap * 2) + 'px auto';
	}

	/**
	 * Lines between the pixels when the image is zoomed in (View > Pixel Grid)
	 */
	draw_pixel_grid(ctx) {
		if (config.pixel_grid === false || is_pixel_grid_visible(config.ZOOM) == false) {
			return;
		}
		//the visible part of the image: corners of the canvas in image coordinates
		var inverse = ctx.getTransform().inverse();
		var top_left = inverse.transformPoint(new DOMPoint(0, 0));
		var bottom_right = inverse.transformPoint(new DOMPoint(ctx.canvas.width, ctx.canvas.height));
		var xs = pixel_grid_positions(top_left.x, bottom_right.x, config.WIDTH);
		var ys = pixel_grid_positions(top_left.y, bottom_right.y, config.HEIGHT);
		var x_from = Math.max(0, top_left.x);
		var x_to = Math.min(config.WIDTH, bottom_right.x);
		var y_from = Math.max(0, top_left.y);
		var y_to = Math.min(config.HEIGHT, bottom_right.y);

		ctx.save();
		ctx.lineWidth = 1 / config.ZOOM; //one screen pixel
		ctx.strokeStyle = 'rgba(128, 128, 128, 0.55)';
		ctx.beginPath();
		xs.forEach(function (x) {
			ctx.moveTo(x, y_from);
			ctx.lineTo(x, y_to);
		});
		ys.forEach(function (y) {
			ctx.moveTo(x_from, y);
			ctx.lineTo(x_to, y);
		});
		ctx.stroke();
		ctx.restore();
	}

	draw_grid(ctx) {
		if (this.grid == false)
			return;

		var gap_x = this.grid_size[0];
		var gap_y = this.grid_size[1];

		var width = config.WIDTH;
		var height = config.HEIGHT;

		//size
		if (gap_x != undefined && gap_y != undefined)
			this.grid_size = [gap_x, gap_y];
		else {
			gap_x = this.grid_size[0];
			gap_y = this.grid_size[1];
		}
		gap_x = parseInt(gap_x);
		gap_y = parseInt(gap_y);
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (gap_x < 2)
			gap_x = 2;
		if (gap_y < 2)
			gap_y = 2;
		for (var i = gap_x; i < width; i = i + gap_x) {
			if (gap_x == 0)
				break;
			if (i % (gap_x * 5) == 0) {
				//main lines
				ctx.strokeStyle = '#222222';
			}
			else {
				//small lines
				ctx.strokeStyle = '#bbbbbb';
			}
			ctx.beginPath();
			ctx.moveTo(0.5 + i, 0);
			ctx.lineTo(0.5 + i, height);
			ctx.stroke();
		}
		for (var i = gap_y; i < height; i = i + gap_y) {
			if (gap_y == 0)
				break;
			if (i % (gap_y * 5) == 0) {
				//main lines
				ctx.strokeStyle = '#222222';
			}
			else {
				//small lines
				ctx.strokeStyle = '#bbbbbb';
			}
			ctx.beginPath();
			ctx.moveTo(0, 0.5 + i);
			ctx.lineTo(width, 0.5 + i);
			ctx.stroke();
		}
	}

	draw_guides(ctx){
		if(config.guides_enabled == false){
			return;
		}
		var thick_guides = this.Tools_settings.get_setting('thick_guides');

		for(var i in config.guides) {
			var guide = config.guides[i];

			if (guide.x === 0 || guide.y === 0) {
				continue;
			}

			//set styles
			ctx.strokeStyle = '#00b8b8';
			if(thick_guides == false)
				ctx.lineWidth = 1;
			else
				ctx.lineWidth = 3;

			ctx.beginPath();
			if (guide.y === null) {
				//vertical
				ctx.moveTo(guide.x, 0);
				ctx.lineTo(guide.x, config.HEIGHT);
			}
			if (guide.x === null) {
				//horizontal
				ctx.moveTo(0, guide.y);
				ctx.lineTo(config.WIDTH, guide.y);
			}
			ctx.stroke();
		}
	}
	
	/**
	 * change draw area size
	 * 
	 * @param {int} width
	 * @param {int} height
	 */
	set_size(width, height) {
		config.WIDTH = parseInt(width);
		config.HEIGHT = parseInt(height);
		this.prepare_canvas();
	}
	
	/**
	 * 
	 * @returns {object} keys: width, height
	 */
	get_visible_area_size() {
		var wrapper = document.getElementById('main_wrapper');
		var page_w = wrapper.clientWidth;
		var page_h = wrapper.clientHeight;
		
		//find visible size in pixels, but make sure its correct even if image smaller then screen
		var w = Math.min(Math.ceil(config.WIDTH * config.ZOOM), Math.ceil(page_w / config.ZOOM));
		var h = Math.min(Math.ceil(config.HEIGHT * config.ZOOM), Math.ceil(page_h / config.ZOOM));
		
		return {
			width: w,
			height: h,
		};
	}

	/**
	 * change theme or set automatically from cookie if possible
	 * 
	 * @param {string} theme_name theme name, "auto" (follow system) or null (use saved setting)
	 */
	/**
	 * Settings > Large controls - bigger text and controls (easier to read and to hit with a finger)
	 */
	apply_large_ui() {
		document.documentElement.classList.toggle('large_ui', Boolean(this.Tools_settings.get_setting('large_ui')));
	}

	change_theme(theme_name = null){
		if(theme_name == null){
			theme_name = this.Tools_settings.get_setting('theme');
		}
		this.theme_setting = theme_name;
		var theme = resolve_theme(theme_name, system_prefers_dark(), config.themes);

		var body = document.querySelector('body');
		for(var i in config.themes){
			body.classList.remove('theme-' + config.themes[i]);
		}
		body.classList.add('theme-' + theme);

		if (this.theme_listener_registered !== true) {
			//follow system light/dark changes while "auto" is selected
			this.theme_listener_registered = true;
			on_system_theme_change(() => {
				if (this.theme_setting == AUTO) {
					this.change_theme(AUTO);
				}
			});
		}
	}

	get_language() {
		return config.LANG;
	}

	get_color() {
		return config.COLOR;
	}

	get_alpha() {
		return config.ALPHA;
	}

	get_zoom() {
		return config.ZOOM;
	}

	get_transparency_support() {
		return config.TRANSPARENCY;
	}

	get_active_tool() {
		return config.TOOL;
	}

}

export default Base_gui_class;
