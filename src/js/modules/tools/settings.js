import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import Base_gui_class from './../../core/base-gui.js';
import { AUTO, get_system_languages, order_languages } from './../../libs/system-preferences.js';
import Tools_translate_class, { LANGUAGE_NAMES, t } from './../tools/translate.js';

class Tools_settings_class {

	constructor() {
		this.Base_gui = new Base_gui_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
		this.Tools_translate = new Tools_translate_class();

		this.default_units_config = {
			pixels: 'px',
			inches: '"',
			centimeters: 'cm',
			millimetres: 'mm',
			points: 'pt',
			picas: 'pc',
		};
	}

	settings() {
		var _this = this;
		var transparency_values = ['squares', 'green', 'grey'];
		var resolutions_values = [72, 96, 150, 300, 600];
		var default_units_all = Object.keys(this.default_units_config);
		var transparency = this.get_setting('transparency');
		var theme = this.get_setting('theme');
		var snap = this.get_setting('snap');
		var guides = this.get_setting('guides');
		var safe_search = this.get_setting('safe_search');
		var exit_confirm = this.get_setting('exit_confirm');
		var default_units = this.get_setting('default_units', true);
		var resolution = this.get_default_resolution();
		var thick_guides = this.get_setting('thick_guides');
		var enable_autoresize = this.get_setting('enable_autoresize');
		var open_in_new_tab = this.get_setting('open_in_new_tab');
		var use_file_picker = this.get_setting('use_file_picker');
		var large_ui = this.get_setting('large_ui');

		//language: automatic (system) + own language names
		var auto_name = t('Automatic (System)');
		//browser preferred languages first, then alphabetical order
		var language_codes = order_languages(LANGUAGE_NAMES, get_system_languages(), config.LANG);
		var language_names = [auto_name].concat(language_codes.map((code) => LANGUAGE_NAMES[code]));
		var language_code = this.Tools_translate.get_language_setting();
		var language_name = language_code == AUTO ? auto_name : (LANGUAGE_NAMES[language_code] || auto_name);

		var settings = {
			title: 'Settings',
			tabs: true,
			params: [
				{heading: "Appearance", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>'},
				{name: "language", title: "Language:", type: "select", values: language_names, value: language_name},
				{name: "theme", title: "Theme:", values: [AUTO].concat(config.themes), value: theme, type: "select"},
				{name: "large_ui", title: "Large controls:", value: large_ui},
				{name: "transparency", title: "Transparent:", value: transparency},
				{name: "transparency_type", title: "Transparency background:", type: "select",
					value: config.TRANSPARENCY_TYPE, values: transparency_values},
				{heading: "Measurement", icon: '<svg viewBox="0 0 24 24"><rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/></svg>'},
				{name: "default_units", title: "Default units:", values: default_units_all, value: default_units, type: "select"},
				{name: "resolution", title: "Default resolution (dpi):", type: "select",
					value: resolution, values: resolutions_values},
				{heading: "Behavior", icon: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>'},
				{name: "snap", title: "Enable snap:", value: snap},
				{name: "guides", title: "Enable guides:", value: guides},
				{name: "thick_guides", title: "Thick guides:", value: thick_guides},
				{name: "safe_search", title: "Safe search:", value: safe_search},
				{name: "exit_confirm", title: "Exit confirmation:", value: exit_confirm},
				{name: "enable_autoresize", title: "Enable autoresize:", value: enable_autoresize},
				{name: "open_in_new_tab", title: "Open files in a new document:", value: open_in_new_tab},
				{name: "use_file_picker", title: "Ask where to save files:", value: use_file_picker},
				{heading: "Keyboard", icon: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>'},
			],
			on_load: function (params, popup) {
				//the shortcuts have a dialog of their own, the last tab of the settings leads there
				var panel = popup.el.querySelector('tbody.tab_panel:last-of-type');
				if (!panel) {
					return;
				}
				var row = document.createElement('tr');
				var cell = document.createElement('td');
				cell.colSpan = 3;
				var button = document.createElement('button');
				button.type = 'button';
				button.className = 'button';
				button.textContent = t('Keyboard Shortcuts') + '\u2026';
				button.addEventListener('click', function () {
					popup.hide();
					_this.Base_gui.run_target('tools/shortcuts_editor.open');
				});
				cell.appendChild(button);
				row.appendChild(cell);
				panel.appendChild(row);
			},
			on_change: function (params) {
				this.Base_gui.change_theme(params.theme);
			},
			on_cancel: function (params) {
				this.Base_gui.change_theme(theme);
			},
			on_finish: function (params) {
				_this.save_values(params);
				if (params.language != language_name) {
					var code = AUTO;
					for (var key in LANGUAGE_NAMES) {
						if (LANGUAGE_NAMES[key] == params.language) {
							code = key;
						}
					}
					_this.Tools_translate.set_language(code);
				}
			},
		};
		this.POP.show(settings);
	}

	/**
	 * set and save theme
	 *
	 * @param {string} theme theme name or "auto" (follow system)
	 */
	set_theme(theme) {
		if (theme != AUTO && config.themes.includes(theme) == false) {
			return;
		}
		this.save_setting('theme', theme);
		this.Base_gui.change_theme(theme);
	}

	save_values(params) {

		//save
		this.save_setting('theme', params.theme);
		this.save_setting('transparency', params.transparency);
		this.save_setting('transparency_type', params.transparency_type);
		this.save_setting('snap', params.snap);
		this.save_setting('guides', params.guides);
		this.save_setting('safe_search', params.safe_search);
		this.save_setting('exit_confirm', params.exit_confirm);
		this.save_setting('default_units', params.default_units);
		this.save_setting('default_units_short', this.default_units_config[params.default_units]);
		this.save_setting('resolution', params.resolution);
		this.save_setting('thick_guides', params.thick_guides);
		this.save_setting('enable_autoresize', params.enable_autoresize);
		this.save_setting('open_in_new_tab', params.open_in_new_tab);
		this.save_setting('use_file_picker', params.use_file_picker);
		this.save_setting('large_ui', params.large_ui);
		this.Base_gui.apply_large_ui();

		//update config
		config.TRANSPARENCY = this.get_setting('transparency');
		config.TRANSPARENCY_TYPE = this.get_setting('transparency_type');
		config.SNAP = this.get_setting('snap');
		config.guides_enabled = this.get_setting('guides');
		this.Base_gui.change_theme(this.get_setting('theme'));
		this.Base_gui.GUI_information.update_units();
		
		//finish
		this.Base_gui.prepare_canvas();
		config.need_render = true;
	}

	/**
	 * set global setting. Values can be string(1 or 0 will be converted to boolean) or boolean
	 *
	 * @param key
	 * @param value
	 */
	save_setting(key, value) {
		//prepare
		if(value === true){
			value = 1;
		}
		if(value === false){
			value = 0;
		}

		this.Helper.setCookie(key, value);
	}

	/**
	 * get global setting. If settings does not exists, default valye will be used.
	 *
	 * @param key
	 * @returns {Object|string}
	 */
	/**
	 * default resolution (dpi) for new documents, the document itself can have its own (config.RESOLUTION)
	 */
	get_default_resolution() {
		return this.get_setting('resolution', true);
	}

	get_setting(key, raw) {
		var default_values = {
			'theme': null,
			'transparency': false,
			'snap': true,
			'guides': true,
			'safe_search': true,
			'exit_confirm': true,
			'default_units': Object.keys(this.default_units_config)[0],
			'default_units_short': Object.values(this.default_units_config)[0],
			'resolution': 72,
			'thick_guides': false,
			'enable_autoresize': config.enable_autoresize_by_default,
			'open_in_new_tab': true,
			'use_file_picker': false,
			'large_ui': false,
		};

		if ((key == 'default_units' || key == 'default_units_short') && !raw && config.UNITS && this.default_units_config[config.UNITS]) {
			//the unit belongs to the document
			return key == 'default_units' ? config.UNITS : this.default_units_config[config.UNITS];
		}
		if (key == 'resolution' && !raw && config.RESOLUTION > 0) {
			//the resolution belongs to the document
			return config.RESOLUTION;
		}

		var value = this.Helper.getCookie(key);
		if(value == null && default_values[key] != undefined){
			//set default value
			value = default_values[key];
		}
		if(key == 'safe_search' && config.safe_search_can_be_disabled === false){
			//not allowed
			value = 1;
		}
		if(key == 'theme' && (value == null || (value != AUTO && config.themes.includes(value) == false))) {
			//follow system light/dark preference by default
			value = AUTO;
		}

		//finalize values
		if(value === 1){
			value = true;
		}
		if(value === 0){
			value = false;
		}

		return value;
	}

}

export default Tools_settings_class;