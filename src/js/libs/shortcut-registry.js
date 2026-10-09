/**
 * Keyboard shortcuts that the user can change. A shortcut is written as a text ("spec"): modifiers and the key joined by
 * "+", for example "Mod+Shift+D". "Mod" is Ctrl on Windows / Linux and Cmd on macOS (as in Photoshop), the other
 * modifiers are "Alt" and "Shift". Pure functions, no DOM.
 *
 * @typedef {{mod: boolean, shift: boolean, alt: boolean, key: string}} Combo
 * @typedef {{id: string, group: string, name: string, spec: string, target?: string, parameter?: any, tool?: string,
 *   fixed?: boolean, shift_any?: boolean}} Shortcut_entry
 *   spec = the default, fixed = shown, but handled elsewhere and not changeable
 */

const NAMED_KEYS = ['BACKSPACE', 'DELETE', 'ENTER', 'ESCAPE', 'TAB', 'SPACE', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN'];
const PUNCTUATION = ['-', '=', ';', ',', '.', '/', '\'', '`', '[', ']', '\\'];

//the physical key of punctuation (the same place on every layout, the character on it differs)
const PUNCTUATION_CODES = {
	Equal: '=', Minus: '-', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: '\'', Backquote: '`',
	BracketLeft: '[', BracketRight: ']', Backslash: '\\', NumpadAdd: '=', NumpadSubtract: '-',
};

//what the key gives with Shift on a US keyboard, when no key code is known
const SHIFTED = {
	'+': '=', '_': '-', ':': ';', '"': '\'', '<': ',', '>': '.', '?': '/', '~': '`', '{': '[', '}': ']', '|': '\\',
};

//+ and - need Shift on many layouts, so Shift does not count for them ("Ctrl++" is the same as "Ctrl+=")
const SHIFT_FLEXIBLE = ['=', '-'];

/**
 * @param {string} key one token of a spec
 * @returns {string} the key in its canonical form, '' when it is not a key
 */
function normalize_key(key) {
	const upper = String(key).trim().toUpperCase();
	if (upper === 'PLUS') {
		return '=';
	}
	if (/^[A-Z0-9]$/.test(upper) || /^F([1-9]|1[0-2])$/.test(upper) || NAMED_KEYS.indexOf(upper) >= 0 || PUNCTUATION.indexOf(upper) >= 0) {
		return upper;
	}
	const aliases = {DEL: 'DELETE', ESC: 'ESCAPE', RETURN: 'ENTER', UP: 'ARROWUP', DOWN: 'ARROWDOWN', LEFT: 'ARROWLEFT', RIGHT: 'ARROWRIGHT', PGUP: 'PAGEUP', PGDN: 'PAGEDOWN', ' ': 'SPACE'};
	return aliases[upper] || '';
}

/**
 * @param {string} spec for example "Mod+Shift+D"
 * @returns {Combo|null} null for an empty or invalid spec
 */
export function parse_spec(spec) {
	if (typeof spec !== 'string' || spec.trim() === '') {
		return null;
	}
	const text = spec.trim();
	//a key that is a plus sign: "Mod++" or "Mod+Plus"
	const parts = text.endsWith('++') ? text.slice(0, -2).split('+').concat(['PLUS']) : text.split('+');
	const key = normalize_key(parts.pop());
	if (key === '') {
		return null;
	}
	const combo = {mod: false, shift: false, alt: false, key};
	for (let i = 0; i < parts.length; i++) {
		const name = parts[i].trim().toLowerCase();
		if (name === 'mod' || name === 'ctrl' || name === 'cmd' || name === 'meta') {
			combo.mod = true;
		}
		else if (name === 'shift') {
			combo.shift = true;
		}
		else if (name === 'alt' || name === 'option') {
			combo.alt = true;
		}
		else {
			return null;
		}
	}
	return combo;
}

/**
 * @param {string} spec
 * @returns {string} the spec in the form that is stored ("Mod+Alt+Shift+Key"), '' when it is invalid
 */
export function normalize_spec(spec) {
	const combo = parse_spec(spec);
	if (combo === null) {
		return '';
	}
	return (combo.mod ? 'Mod+' : '') + (combo.alt ? 'Alt+' : '') + (combo.shift ? 'Shift+' : '') + combo.key;
}

/**
 * A shortcut as the menus of the program wrote it: "Shift+Ctrl+D", "Shift + S", "Ctrl++", "Del", "F9"
 *
 * @param {string} text
 * @returns {string} spec, '' when it can not be read
 */
export function parse_menu_shortcut(text) {
	if (typeof text !== 'string') {
		return '';
	}
	return normalize_spec(text.replace(/\s*\+\s*/g, '+'));
}

const MENU_KEY_NAMES = {DELETE: 'Del', BACKSPACE: 'Backspace', ESCAPE: 'Esc', ENTER: 'Enter', SPACE: 'Space', '=': '+', ARROWUP: 'Up', ARROWDOWN: 'Down', ARROWLEFT: 'Left', ARROWRIGHT: 'Right', PAGEUP: 'PgUp', PAGEDOWN: 'PgDn'};

/**
 * The text a menu shows, in the order of Photoshop: "Alt+Shift+Ctrl+D" (the macOS look is made from it by
 * format_shortcut_mac in libs/shortcuts.js)
 *
 * @param {string} spec
 * @returns {string} '' for an empty spec
 */
export function menu_text(spec) {
	const combo = parse_spec(spec);
	if (combo === null) {
		return '';
	}
	return (combo.alt ? 'Alt+' : '') + (combo.shift ? 'Shift+' : '') + (combo.mod ? 'Ctrl+' : '') + (MENU_KEY_NAMES[combo.key] || combo.key);
}

/**
 * The name of the key of an event that does not depend on the keyboard layout: a letter is the letter on the key
 * (so Z is Z also on a QWERTZ keyboard), digits and letters of other alphabets come from the physical key (the Czech
 * number row types accented letters), punctuation is the physical key.
 *
 * @param {{key?: string, code?: string}} event
 * @returns {string} canonical key name, '' when unknown
 */
export function event_key(event) {
	const key = typeof event.key === 'string' ? event.key : '';
	const code = typeof event.code === 'string' ? event.code : '';
	if (/^[a-zA-Z]$/.test(key)) {
		return key.toUpperCase();
	}
	if (/^[0-9]$/.test(key) && !/^Numpad/.test(code)) {
		return key;
	}
	const match = /^Key([A-Z])$/.exec(code) || /^(?:Digit|Numpad)(\d)$/.exec(code);
	if (match) {
		return match[1];
	}
	if (Object.prototype.hasOwnProperty.call(PUNCTUATION_CODES, code)) {
		return PUNCTUATION_CODES[code];
	}
	if (key.length === 1) {
		return SHIFTED[key] || (PUNCTUATION.indexOf(key) >= 0 ? key : key === ' ' ? 'SPACE' : normalize_key(key));
	}
	return normalize_key(key);
}

/**
 * @param {{key?: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event
 * @param {Combo|null} combo
 * @returns {boolean}
 */
export function matches(event, combo) {
	if (!event || combo === null) {
		return false;
	}
	if (Boolean(event.ctrlKey || event.metaKey) !== combo.mod || Boolean(event.altKey) !== combo.alt) {
		return false;
	}
	if (SHIFT_FLEXIBLE.indexOf(combo.key) < 0 && Boolean(event.shiftKey) !== combo.shift) {
		return false;
	}
	return event_key(event) === combo.key;
}

/**
 * The spec of the keys that were pressed (for recording a new shortcut)
 *
 * @param {{key?: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event
 * @returns {string} '' when only a modifier key was pressed or the key is not usable
 */
export function event_spec(event) {
	const key = event_key(event);
	if (key === '' || ['SHIFT', 'CONTROL', 'ALT', 'META', 'ALTGRAPH', 'OS'].indexOf(key) >= 0) {
		return '';
	}
	const combo = {mod: Boolean(event.ctrlKey || event.metaKey), shift: Boolean(event.shiftKey), alt: Boolean(event.altKey), key};
	//shift is not told apart for + and -, so it is not part of the spec
	if (SHIFT_FLEXIBLE.indexOf(key) >= 0) {
		combo.shift = false;
	}
	return normalize_spec((combo.mod ? 'Mod+' : '') + (combo.alt ? 'Alt+' : '') + (combo.shift ? 'Shift+' : '') + (key === '=' ? 'PLUS' : key));
}

/**
 * A shortcut needs a modifier, except the function keys and the keys that only the tools use (see the registry)
 *
 * @param {string} spec
 * @returns {boolean}
 */
export function has_modifier_or_function_key(spec) {
	const combo = parse_spec(spec);
	return combo !== null && (combo.mod || combo.alt || /^F\d+$/.test(combo.key));
}

/**
 * The shortcuts as they are used now: the default of every entry unless the user changed it
 *
 * @param {Shortcut_entry[]} registry
 * @param {Object<string, string>} overrides id -> spec ('' = no shortcut)
 * @returns {Object<string, string>} id -> spec
 */
export function effective_specs(registry, overrides) {
	/** @type {Object<string, string>} */
	const result = {};
	registry.forEach((entry) => {
		result[entry.id] = overrides && Object.prototype.hasOwnProperty.call(overrides, entry.id) ? overrides[entry.id] : entry.spec;
	});
	return result;
}

/**
 * Stored changes can be anything: only known commands with a valid spec (or none) are kept
 *
 * @param {any} stored
 * @param {Shortcut_entry[]} registry
 * @returns {Object<string, string>}
 */
export function clean_overrides(stored, registry) {
	/** @type {Object<string, string>} */
	const result = {};
	if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
		return result;
	}
	registry.forEach((entry) => {
		if (entry.fixed || !Object.prototype.hasOwnProperty.call(stored, entry.id)) {
			return;
		}
		const value = stored[entry.id];
		if (value === '') {
			result[entry.id] = '';
		}
		else if (typeof value === 'string' && normalize_spec(value) !== '') {
			result[entry.id] = normalize_spec(value);
		}
	});
	return result;
}

/**
 * Only the differences from the defaults are stored
 *
 * @param {Shortcut_entry[]} registry
 * @param {Object<string, string>} specs id -> spec
 * @returns {Object<string, string>}
 */
export function overrides_from(registry, specs) {
	/** @type {Object<string, string>} */
	const result = {};
	registry.forEach((entry) => {
		if (!entry.fixed && specs[entry.id] !== undefined && normalize_spec(specs[entry.id]) !== normalize_spec(entry.spec)) {
			result[entry.id] = normalize_spec(specs[entry.id]);
		}
	});
	return result;
}

/**
 * Which other command already has this shortcut
 *
 * @param {Shortcut_entry[]} registry
 * @param {Object<string, string>} specs id -> spec in use
 * @param {string} id the command that wants the shortcut
 * @param {string} spec
 * @returns {Shortcut_entry|null}
 */
export function find_conflict(registry, specs, id, spec) {
	const wanted = parse_spec(spec);
	if (wanted === null) {
		return null;
	}
	const wanted_text = normalize_spec(spec);
	for (let i = 0; i < registry.length; i++) {
		const entry = registry[i];
		if (entry.id === id) {
			continue;
		}
		const used = normalize_spec(entry.fixed ? entry.spec : (specs[entry.id] !== undefined ? specs[entry.id] : entry.spec));
		if (used === wanted_text) {
			return entry;
		}
		//+ and - ignore Shift, so Shift+= is the same shortcut as =
		const other = parse_spec(used);
		if (other !== null && other.key === wanted.key && SHIFT_FLEXIBLE.indexOf(wanted.key) >= 0 && other.mod === wanted.mod && other.alt === wanted.alt) {
			return entry;
		}
	}
	return null;
}

/**
 * The command a keyboard event runs
 *
 * @param {Shortcut_entry[]} registry
 * @param {Object<string, string>} specs id -> spec in use
 * @param {{key?: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event
 * @returns {Shortcut_entry|null}
 */
export function find_entry(registry, specs, event) {
	for (let i = 0; i < registry.length; i++) {
		const entry = registry[i];
		if (entry.fixed) {
			continue;
		}
		if (matches(event, parse_spec(specs[entry.id] !== undefined ? specs[entry.id] : entry.spec))) {
			return entry;
		}
	}
	return null;
}

/**
 * @param {string} target
 * @param {any} [parameter]
 * @returns {string} id of a command of the menu
 */
export function command_id(target, parameter) {
	return target + (parameter === undefined || parameter === null ? '' : `|${  JSON.stringify(parameter)}`);
}

/**
 * The list of all the commands that have (or may have) a shortcut. The menu is walked for the names, groups and
 * defaults written there; `explicit` (config-shortcuts.js) wins for the same command, `legacy` says which plain letters
 * of the menu are no longer defaults (they belong to the tools now).
 *
 * @param {object[]} menu items of config-menu.js ({name, shortcut, target, parameter, children})
 * @param {{key: string|string[], ctrl?: boolean, shift?: boolean|string, alt?: boolean, name: string, target: string, parameter?: any, group?: string}[]} explicit
 * @param {Shortcut_entry[]} extras entries that are not in the menu (tools, color keys …)
 * @param {Object<string, string>} replaced menu text -> spec or '' for the shortcuts that are written in the menu but meant otherwise
 * @returns {Shortcut_entry[]}
 */
export function build_registry(menu, explicit, extras, replaced) {
	/** @type {Shortcut_entry[]} */
	const entries = [];
	const seen = {};
	const add = function (entry) {
		if (seen[entry.id]) {
			return;
		}
		seen[entry.id] = true;
		entries.push(entry);
	};
	const group_of = {};
	const names = {};
	const walk = function (items, group) {
		items.forEach((item) => {
			if (item.divider || !item.name) {
				return;
			}
			const top = group || item.name;
			if (item.target) {
				const id = command_id(item.target, item.parameter);
				if (!group_of[id]) {
					group_of[id] = top;
					names[id] = item.name;
				}
			}
			if (item.children) {
				walk(item.children, top);
			}
		});
	};
	walk(menu, null);

	explicit.forEach((definition) => {
		const key = Array.isArray(definition.key) ? definition.key[0] : definition.key;
		const combo = (definition.ctrl ? 'Mod+' : '') + (definition.alt ? 'Alt+' : '') + (definition.shift === true ? 'Shift+' : '') + (key === '=' || key === '+' ? 'PLUS' : key);
		const id = command_id(definition.target, definition.parameter);
		add({
			id, group: definition.group || group_of[id] || 'Other', name: names[id] || definition.name, spec: normalize_spec(combo),
			target: definition.target, parameter: definition.parameter,
		});
	});

	const collect = function (items) {
		items.forEach((item) => {
			if (item.divider) {
				return;
			}
			if (item.target && item.shortcut) {
				const id = command_id(item.target, item.parameter);
				const spec = Object.prototype.hasOwnProperty.call(replaced, item.shortcut) ? replaced[item.shortcut] : parse_menu_shortcut(item.shortcut);
				add({id, group: group_of[id] || 'Other', name: item.name, spec, target: item.target, parameter: item.parameter});
			}
			if (item.children) {
				collect(item.children);
			}
		});
	};
	collect(menu);

	extras.forEach((entry) => {
		add(Object.assign({}, entry, {spec: entry.spec === '' ? '' : normalize_spec(entry.spec)}));
	});
	return entries;
}

export const EXPORT_FORMAT = 'lumifex-shortcuts';
export const MAX_IMPORT_SIZE = 200 * 1000;

/**
 * The file that holds the changes of the shortcuts
 *
 * @param {Object<string, string>} overrides id -> spec ('' = no shortcut), only what differs from the defaults
 * @returns {string} JSON text
 */
export function export_shortcuts(overrides) {
	return JSON.stringify({format: EXPORT_FORMAT, version: 1, shortcuts: overrides}, null, 2);
}

/**
 * Reads an exported file. The file can come from anywhere, so nothing is trusted: the size and the form are checked, only
 * known commands with a valid spec are taken, and a shortcut that two commands want (or that a command that is not
 * mentioned in the file has by default) is given to none of the later ones.
 *
 * @param {Shortcut_entry[]} registry
 * @param {string} text content of the file
 * @returns {{ok: true, specs: Object<string, string>, applied: number, skipped: number}|{ok: false, error: string}}
 */
export function import_shortcuts(registry, text) {
	if (typeof text !== 'string' || text.length > MAX_IMPORT_SIZE) {
		return {ok: false, error: 'The file is too big.'};
	}
	let data;
	try {
		data = JSON.parse(text);
	}
	catch {
		return {ok: false, error: 'The file is not a list of shortcuts.'};
	}
	if (data === null || typeof data !== 'object' || data.format !== EXPORT_FORMAT || data.version !== 1
		|| data.shortcuts === null || typeof data.shortcuts !== 'object' || Array.isArray(data.shortcuts)) {
		return {ok: false, error: 'The file is not a list of shortcuts.'};
	}
	const wanted = clean_overrides(data.shortcuts, registry);
	const asked = Object.keys(data.shortcuts).filter((id) => {
		return registry.some((entry) => { return entry.id === id && !entry.fixed; });
	}).length;
	//everything starts as the default, the file changes what it mentions
	const specs = effective_specs(registry, {});
	let applied = 0;
	Object.keys(wanted).forEach((id) => {
		//a command that is moved gives its place up first, so the shortcut can be taken over by another one in the file
		const spec = wanted[id];
		if (spec === '' || find_conflict(registry, specs, id, spec) === null) {
			specs[id] = spec;
			applied++;
		}
	});
	return {ok: true, specs, applied, skipped: asked - applied};
}

/**
 * Shortcuts that the browser takes for itself (new tab / window, close, reload, address bar, preferences, minimize):
 * a page can not always catch them, so they work in the installed app but may not work in a tab of the browser.
 */
export const BROWSER_RESERVED = [
	'Mod+T', 'Mod+Shift+T', 'Mod+N', 'Mod+Shift+N', 'Mod+W', 'Mod+Shift+W', 'Mod+Q', 'Mod+R', 'Mod+Shift+R', 'Mod+L', 'Mod+M', 'Mod+,', 'Mod+H',
];

/**
 * @param {string} spec
 * @returns {boolean} the browser may take this shortcut
 */
export function is_browser_reserved(spec) {
	return BROWSER_RESERVED.indexOf(normalize_spec(spec)) >= 0;
}
