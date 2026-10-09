/**
 * Keyboard shortcut matching helpers.
 *
 * "ctrl" matches Ctrl on Windows/Linux and Cmd on macOS (Photoshop style).
 */

//physical keys for punctuation shortcuts (US layout positions)
const CODE_FALLBACK = {
	'[': 'BracketLeft',
	']': 'BracketRight',
	'\'': 'Quote',
	'\\': 'Backslash',
};

/**
 * check if keyboard event matches shortcut definition
 *
 * @param {KeyboardEvent} event
 * @param {object} shortcut keys: key (string or array, case insensitive), ctrl, shift, alt (booleans, default false).
 *     shift can be "any" to ignore Shift state (useful for keys like "+").
 * @returns {boolean}
 */
export function match_shortcut(event, shortcut) {
	if (!event || !shortcut || typeof event.key != 'string') {
		return false;
	}
	const ctrl = Boolean(event.ctrlKey || event.metaKey);
	if (ctrl != Boolean(shortcut.ctrl)
		|| (shortcut.shift !== 'any' && Boolean(event.shiftKey) != Boolean(shortcut.shift))
		|| Boolean(event.altKey) != Boolean(shortcut.alt)) {
		return false;
	}

	const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
	const event_key = event.key.toLowerCase();
	for (const i in keys) {
		if (String(keys[i]).toLowerCase() == event_key) {
			return true;
		}
	}
	//fallback for layouts where key produces non-latin character (e.g. digits on Czech keyboard),
	//use physical key then. Latin keys are trusted so QWERTZ "z" is not confused with "y".
	if (typeof event.code == 'string' && /^[a-z0-9]$/.test(event_key) == false) {
		for (const j in keys) {
			const key = String(keys[j]);
			if (/^[0-9]$/.test(key) && event.code == `Digit${  key}`) {
				return true;
			}
			if (/^[a-z]$/i.test(key) && event.code == `Key${  key.toUpperCase()}`) {
				return true;
			}
			if (CODE_FALLBACK[key] != undefined && event.code == CODE_FALLBACK[key]) {
				return true;
			}
		}
	}
	return false;
}

/**
 * true if any of Ctrl, Cmd or Alt is pressed - single letter shortcuts should be ignored then.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function has_modifier(event) {
	return Boolean(event && (event.ctrlKey || event.metaKey || event.altKey));
}

/**
 * find first shortcut definition matching keyboard event
 *
 * @param {KeyboardEvent} event
 * @param {object[]} definitions
 * @returns {object|null}
 */
export function find_shortcut(event, definitions) {
	for (const i in definitions) {
		if (match_shortcut(event, definitions[i])) {
			return definitions[i];
		}
	}
	return null;
}

const MAC_KEY_SYMBOLS = {
	backspace: '⌫',
	del: '⌦',
	delete: '⌦',
	enter: '↩',
	esc: '⎋',
	escape: '⎋',
	tab: '⇥',
};

/**
 * format menu shortcut text the way macOS shows it, e.g. "Shift+Ctrl+D" -> "⇧⌘D".
 * "Ctrl" means Cmd on macOS (see match_shortcut). Modifier order follows Apple HIG: ⌃ ⌥ ⇧ ⌘.
 *
 * @param {string} text shortcut definition from config-menu.js
 * @returns {string}
 */
export function format_shortcut_mac(text) {
	if (typeof text != 'string' || text == '') {
		return '';
	}
	const parts = text.split(/\s*\+\s*/);
	//"Ctrl++" is split into an empty last part - the key is "+"
	if (parts.length > 1 && parts[parts.length - 1] == '') {
		parts.pop();
		parts[parts.length - 1] = '+';
	}
	const key = parts.pop();
	const has = {};
	for (const i in parts) {
		has[parts[i].toLowerCase()] = true;
	}
	let out = '';
	if (has.alt || has.option) {
		out += '⌥';
	}
	if (has.shift) {
		out += '⇧';
	}
	if (has.ctrl || has.cmd) {
		out += '⌘';
	}
	const symbol = MAC_KEY_SYMBOLS[key.toLowerCase()];
	return out + (symbol != undefined ? symbol : key.toUpperCase());
}

/**
 * @returns {boolean} true when running on macOS
 */
export function is_mac_platform() {
	const nav = typeof navigator != 'undefined' ? navigator : null;
	if (!nav) {
		return false;
	}
	const platform = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || '';
	return /mac/i.test(platform);
}

const NOT_TEXT_INPUTS = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image'];

/**
 * Is the user typing here? Then the keys belong to the field. A checkbox, a slider or a button that has the focus
 * after a click does not take typed keys, so the shortcuts have to work there.
 *
 * @param {EventTarget|null} element target of a keyboard event
 * @returns {boolean}
 */
export function is_typing_target(element) {
	const el = /** @type {any} */ (element);
	if (!el || typeof el.tagName !== 'string') {
		return false;
	}
	if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true) {
		return true;
	}
	if (el.tagName === 'INPUT') {
		return NOT_TEXT_INPUTS.indexOf(String(el.type || 'text').toLowerCase()) < 0;
	}
	return false;
}
