import Dialog_class from './../../libs/popup.js';
import Shortcut_manager_class from './../../core/shortcut-manager.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { event_spec, menu_text, has_modifier_or_function_key, MAX_IMPORT_SIZE, is_browser_reserved } from './../../libs/shortcut-registry.js';
import { format_shortcut_mac, is_mac_platform } from './../../libs/shortcuts.js';
import { save_blob } from './../../libs/file-save.js';
import { t } from './translate.js';

//icons of the buttons above the list (the texts are tooltips and labels for screen readers)
const ICONS = {
	export: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10V2.5M5 5l3-3 3 3M2.5 9.5v3.5h11V9.5"/></svg>',
	import: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5V10M5 7l3 3 3-3M2.5 9.5v3.5h11V9.5"/></svg>',
	search: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.3"/><path d="M10 10l3.5 3.5"/></svg>',
	reset: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3"/></svg>',
};

//the order of the groups in the list, the others follow in the order of the menus
const GROUP_ORDER = ['WebPhos', 'File', 'Edit', 'Image', 'Layer', 'Type', 'Select', 'Effects', 'View', 'Tools', 'Other'];

/**
 * WebPhos > Keyboard Shortcuts - every command with its shortcut; click on a shortcut and press the new keys.
 * Changes are used at once and kept in this browser (core/shortcut-manager.js).
 */
class Tools_shortcuts_editor_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Shortcuts = new Shortcut_manager_class();
		this.mac = is_mac_platform();
	}

	/**
	 * @param {string} spec
	 * @returns {string} how the shortcut is shown
	 */
	show_spec(spec) {
		var text = menu_text(spec);
		if (text === '') {
			return t('Not set');
		}
		return this.mac ? format_shortcut_mac(text) : text;
	}

	open() {
		this.POP.show({
			title: 'Keyboard Shortcuts',
			className: 'shortcuts_dialog',
			params: [],
			on_load: (params, popup) => {
				this.build(popup.el.querySelector('.dialog_content'));
			},
			on_finish: () => {
				this.stop_recording();
			},
			on_cancel: () => {
				this.stop_recording();
			},
		});
	}

	/**
	 * @param {HTMLElement} host
	 */
	build(host) {
		this.host = host;
		this.recording = null;
		host.innerHTML = '';

		var bar = document.createElement('div');
		bar.className = 'shortcuts_bar';
		var search = document.createElement('input');
		search.type = 'search';
		search.className = 'shortcuts_search';
		search.placeholder = t('Search commands and shortcuts');
		search.setAttribute('aria-label', t('Search commands and shortcuts'));
		search.addEventListener('input', () => this.filter(search.value));
		var icon_button = (icon, title, handler) => {
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'button shortcuts_icon';
			button.innerHTML = ICONS[icon];
			button.title = title;
			button.setAttribute('aria-label', title);
			button.addEventListener('click', handler);
			return button;
		};
		var export_button = icon_button('export', t('Export') + ': ' + t('Save the changed shortcuts to a file'), () => this.export_file());
		var import_button = icon_button('import', t('Import') + ': ' + t('Load shortcuts from a file (they replace the ones that are set now)'), () => this.import_file());
		var reset_all = icon_button('reset', t('Reset all'), () => {
			this.stop_recording();
			this.Shortcuts.reset_all();
			this.render_rows();
		});
		//a search field as on macOS: a rounded field with a magnifier
		var box = document.createElement('div');
		box.className = 'shortcuts_searchbox';
		var magnifier = document.createElement('span');
		magnifier.className = 'shortcuts_magnifier';
		magnifier.innerHTML = ICONS.search;
		box.appendChild(magnifier);
		box.appendChild(search);
		bar.appendChild(box);
		bar.appendChild(export_button);
		bar.appendChild(import_button);
		bar.appendChild(reset_all);
		host.appendChild(bar);

		var hint = document.createElement('div');
		hint.className = 'shortcuts_hint';
		hint.textContent = t('Click a shortcut and press the new keys. Backspace removes it, Esc cancels.');
		host.appendChild(hint);

		this.list = document.createElement('div');
		this.list.className = 'shortcuts_list';
		host.appendChild(this.list);
		this.render_rows();
		search.focus();
	}

	async export_file() {
		this.stop_recording();
		await save_blob(new Blob([this.Shortcuts.export_text()], {type: 'application/json'}), 'webphos-shortcuts.json', false);
	}

	import_file() {
		this.stop_recording();
		var input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,application/json';
		input.addEventListener('change', () => {
			var file = input.files && input.files[0];
			if (!file) {
				return;
			}
			if (file.size > MAX_IMPORT_SIZE) {
				alertify.error(t('The file is too big.'));
				return;
			}
			var reader = new FileReader();
			reader.onload = () => {
				var result = this.Shortcuts.import_text(String(reader.result));
				if (!result.ok) {
					alertify.error(t(result.error));
					return;
				}
				this.render_rows();
				alertify.success(t('Shortcuts imported:') + ' ' + result.applied + (result.skipped > 0 ? ' (' + t('skipped:') + ' ' + result.skipped + ')' : ''));
			};
			reader.readAsText(file);
		});
		input.click();
	}

	render_rows() {
		this.list.innerHTML = '';
		this.rows = [];
		var groups = [];
		this.Shortcuts.registry.forEach((entry) => {
			if (groups.indexOf(entry.group) < 0) {
				groups.push(entry.group);
			}
		});
		groups.sort((a, b) => {
			var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		});
		groups.forEach((group) => {
			var title = document.createElement('h3');
			title.className = 'shortcuts_group';
			title.textContent = t(group);
			this.list.appendChild(title);
			var section = {title: title, rows: []};
			this.Shortcuts.registry.filter((entry) => entry.group === group).forEach((entry) => {
				var row = this.make_row(entry);
				this.list.appendChild(row.element);
				section.rows.push(row);
			});
			this.rows.push(section);
		});
	}

	make_row(entry) {
		var element = document.createElement('div');
		element.className = 'shortcuts_row';
		var label = document.createElement('span');
		label.className = 'shortcuts_name';
		label.textContent = t(entry.name);
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'button shortcuts_key';
		var reset = document.createElement('button');
		reset.type = 'button';
		reset.className = 'button shortcuts_reset';
		reset.textContent = '↺';
		reset.title = t('Reset');
		reset.setAttribute('aria-label', t('Reset'));

		var warning = document.createElement('span');
		warning.className = 'shortcuts_warning';
		warning.textContent = '\u26A0';
		warning.title = t('The browser may take this shortcut for itself. It works in the installed app, in a browser tab it may not.');
		var refresh = () => {
			var spec = entry.fixed ? entry.spec : this.Shortcuts.get(entry.id);
			warning.style.visibility = is_browser_reserved(spec) ? 'visible' : 'hidden';
			button.textContent = this.show_spec(spec);
			button.classList.toggle('unset', spec === '');
			reset.style.visibility = !entry.fixed && this.Shortcuts.is_changed(entry.id) ? 'visible' : 'hidden';
		};
		refresh();

		if (entry.fixed) {
			button.disabled = true;
			button.title = t('This shortcut is handled by the browser or by the tools and can not be changed.');
		}
		else {
			button.addEventListener('click', () => this.record(entry, button, refresh));
			reset.addEventListener('click', () => {
				this.stop_recording();
				var result = this.Shortcuts.reset(entry.id);
				if (!result.ok && result.conflict) {
					alertify.error(t('Already used by:') + ' ' + t(result.conflict.name));
				}
				this.refresh_all();
			});
		}
		element.appendChild(label);
		element.appendChild(warning);
		element.appendChild(button);
		element.appendChild(reset);
		return {element: element, entry: entry, refresh: refresh, label: label.textContent, button: button};
	}

	refresh_all() {
		this.rows.forEach((section) => section.rows.forEach((row) => row.refresh()));
	}

	filter(text) {
		var query = text.trim().toLowerCase();
		this.rows.forEach((section) => {
			var any = false;
			section.rows.forEach((row) => {
				var spec = row.entry.fixed ? row.entry.spec : this.Shortcuts.get(row.entry.id);
				var visible = query === '' || row.label.toLowerCase().indexOf(query) >= 0 || menu_text(spec).toLowerCase().indexOf(query) >= 0
					|| row.button.textContent.toLowerCase().indexOf(query) >= 0;
				row.element.style.display = visible ? '' : 'none';
				any = any || visible;
			});
			section.title.style.display = any ? '' : 'none';
		});
	}

	/**
	 * The next key press is the new shortcut of the command
	 */
	record(entry, button, refresh) {
		this.stop_recording();
		button.textContent = t('Press the keys…');
		button.classList.add('recording');
		var on_key = (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === 'Escape') {
				this.stop_recording();
				refresh();
				return;
			}
			var plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
			var spec = '';
			if (plain && (event.key === 'Backspace' || event.key === 'Delete')) {
				spec = '';
			}
			else {
				spec = event_spec(event);
				if (spec === '') {
					return; //only a modifier key so far
				}
				//plain letters belong to the tools and the colors
				if (!has_modifier_or_function_key(spec) && !(entry.tool || entry.group === 'Tools')) {
					alertify.warning(t('A shortcut needs Ctrl, Alt or Cmd (the plain keys are for the tools).'));
					this.stop_recording();
					refresh();
					return;
				}
			}
			var result = this.Shortcuts.set(entry.id, spec);
			this.stop_recording();
			if (!result.ok && result.conflict) {
				alertify.error(t('Already used by:') + ' ' + t(result.conflict.name));
			}
			else if (result.ok && is_browser_reserved(spec)) {
				alertify.warning(t('The browser may take this shortcut for itself. It works in the installed app, in a browser tab it may not.'));
			}
			this.refresh_all();
		};
		var on_outside = (event) => {
			if (event.target !== button) {
				this.stop_recording();
				refresh();
			}
		};
		this.recording = {button: button, on_key: on_key, on_outside: on_outside};
		document.addEventListener('keydown', on_key, true);
		document.addEventListener('mousedown', on_outside, true);
	}

	stop_recording() {
		if (this.recording) {
			document.removeEventListener('keydown', this.recording.on_key, true);
			document.removeEventListener('mousedown', this.recording.on_outside, true);
			this.recording.button.classList.remove('recording');
			this.recording = null;
		}
	}
}

export default Tools_shortcuts_editor_class;
