import menuDefinition from './../config-menu.js';
import shortcutsDefinition, { REPLACED_MENU_SHORTCUTS, FIXED_COMMANDS, EXTRA_SHORTCUTS } from './../config-shortcuts.js';
import {
	build_registry, effective_specs, clean_overrides, overrides_from, find_conflict, find_entry, normalize_spec, menu_text, command_id, export_shortcuts, import_shortcuts,
} from './../libs/shortcut-registry.js';

let instance = null;
const STORAGE_KEY = 'lumifex_shortcuts';

//commands that make sense when the key is held down (the others run once per press: holding a key repeats the
//event, and a command that switches something would switch it back and forth)
const REPEATABLE = ['tools/brush_size.decrease', 'tools/brush_size.increase', 'view/zoom.in', 'view/zoom.out', 'edit/undo.undo', 'edit/redo.redo', 'edit/redo.redo|alternative'];

/**
 * The keyboard shortcuts of the program: the defaults (config-shortcuts.js and the menu), what the user changed
 * (kept in this browser) and the command that a key press runs. Shortcut texts of the menus follow the changes.
 */
class Shortcut_manager_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.registry = build_registry(menuDefinition, shortcutsDefinition, EXTRA_SHORTCUTS, REPLACED_MENU_SHORTCUTS);
		this.registry.forEach((entry) => {
			if (FIXED_COMMANDS.indexOf(entry.id) >= 0) {
				entry.fixed = true;
			}
			entry.repeat = REPEATABLE.indexOf(entry.id) >= 0;
		});
		this.listeners = [];
		this.overrides = this.load();
		this.specs = effective_specs(this.registry, this.overrides);
		this.apply_to_menu();
	}

	load() {
		try {
			return clean_overrides(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'), this.registry);
		}
		catch {
			return {};
		}
	}

	save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
		}
		catch {
			//a private window or full storage: the change lasts until the page is closed
		}
	}

	/**
	 * @param {string} id
	 * @returns {string} spec of the command now ('' = none)
	 */
	get(id) {
		return this.specs[id] !== undefined ? this.specs[id] : '';
	}

	/**
	 * @param {string} id
	 * @returns {boolean} the shortcut is not the default
	 */
	is_changed(id) {
		return Object.prototype.hasOwnProperty.call(this.overrides, id);
	}

	/**
	 * @param {string} id
	 * @param {string} spec '' removes the shortcut
	 * @returns {{ok: true}|{ok: false, conflict: object}}
	 */
	set(id, spec) {
		const entry = this.registry.find((item) => item.id === id);
		if (!entry || entry.fixed) {
			return {ok: false, conflict: null};
		}
		const clean = normalize_spec(spec);
		const conflict = clean === '' ? null : find_conflict(this.registry, this.specs, id, clean);
		if (conflict) {
			return {ok: false, conflict};
		}
		this.specs[id] = clean;
		this.after_change();
		return {ok: true};
	}

	/**
	 * @param {string} id
	 * @returns {{ok: true}|{ok: false, conflict: object}}
	 */
	reset(id) {
		const entry = this.registry.find((item) => item.id === id);
		if (!entry || entry.fixed) {
			return {ok: false, conflict: null};
		}
		const conflict = entry.spec === '' ? null : find_conflict(this.registry, this.specs, id, entry.spec);
		if (conflict) {
			return {ok: false, conflict};
		}
		this.specs[id] = entry.spec;
		this.after_change();
		return {ok: true};
	}

	/**
	 * The changes as a file (only what differs from the defaults)
	 *
	 * @returns {string} JSON text
	 */
	export_text() {
		return export_shortcuts(this.overrides);
	}

	/**
	 * The shortcuts of an exported file replace the ones that are set now
	 *
	 * @param {string} text
	 * @returns {{ok: true, applied: number, skipped: number}|{ok: false, error: string}}
	 */
	import_text(text) {
		const result = import_shortcuts(this.registry, text);
		if (!result.ok) {
			return result;
		}
		this.specs = result.specs;
		this.after_change();
		return {ok: true, applied: result.applied, skipped: result.skipped};
	}

	reset_all() {
		this.registry.forEach((entry) => {
			this.specs[entry.id] = entry.spec;
		});
		this.after_change();
	}

	after_change() {
		this.overrides = overrides_from(this.registry, this.specs);
		this.save();
		this.apply_to_menu();
		this.listeners.forEach((listener) => listener());
	}

	/**
	 * @param {function(): void} listener called after every change
	 */
	on_change(listener) {
		this.listeners.push(listener);
	}

	/**
	 * The command of a keyboard event
	 *
	 * @param {KeyboardEvent} event
	 * @returns {object|null} entry of the registry
	 */
	find(event) {
		return find_entry(this.registry, this.specs, event);
	}

	/**
	 * The shortcut text of a command of the menu as it is written in the menus
	 *
	 * @param {string} target
	 * @param {any} [parameter]
	 * @returns {string|null} for example "Shift+Ctrl+D", '' when the command has none now, null when it is not a command with a shortcut
	 */
	text_for(target, parameter) {
		const id = command_id(target, parameter);
		const entry = this.registry.find((item) => item.id === id);
		return entry ? menu_text(entry.fixed ? entry.spec : this.get(id)) : null;
	}

	/**
	 * The menu items show the shortcut that is used now
	 */
	apply_to_menu() {
		const walk = (items) => {
			items.forEach((item) => {
				if (item.divider) {
					return;
				}
				if (item.target) {
					const id = command_id(item.target, item.parameter);
					const entry = this.registry.find((candidate) => candidate.id === id);
					if (entry) {
						const text = menu_text(entry.fixed ? entry.spec : this.get(id));
						if (text !== '') {
							item.shortcut = text;
						}
						else {
							delete item.shortcut;
						}
					}
				}
				if (item.children) {
					walk(item.children);
				}
			});
		};
		walk(menuDefinition);
	}
}

export default Shortcut_manager_class;
