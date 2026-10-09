/**
 * Actions (Photoshop): menu commands with the settings used in their dialogs are recorded and can be played again,
 * for example to give many pictures the same look. Only commands of the menu are recorded (not strokes of tools).
 * This file has the rules (what may be recorded, how an action is checked and saved) and the state of the recorder.
 * No DOM here.
 *
 * @typedef {{target: string, parameter: any, dialogs: object[]}} Action_step
 * @typedef {{id: string, name: string, steps: Action_step[]}} Action
 */

export const STORAGE_KEY = 'lumifex_actions';
export const MAX_ACTIONS = 50;
export const MAX_STEPS = 200;
export const MAX_DIALOGS = 10;
export const MAX_NAME = 60;

//a menu target looks like "image/adjustments.invert"
const TARGET_PATTERN = /^[a-z_]+(\/[a-z_]+)*\/[a-z_0-9]+\.[a-z_0-9]+$/;

//commands that are not recorded: files, help, history, the clipboard, the actions themselves and the settings of the program
const EXCLUDED_PREFIXES = [
	'file/', 'help/', 'edit/undo', 'edit/redo', 'edit/history', 'edit/paste', 'edit/copy', 'edit/cut', 'edit/repeat',
	'tools/actions', 'tools/settings', 'tools/search', 'view/', 'image/information', 'image/histogram',
	//these are done with the mouse on the picture, so they can not be played
	'edit/transform', 'edit/warp', 'edit/selection.transform_selection',
];

/**
 * @param {object[]} menu menu definition (config-menu.js)
 * @param {object[]} [shortcuts] shortcut definitions (config-shortcuts.js)
 * @returns {Set<string>} all the targets the program has
 */
export function collect_targets(menu, shortcuts) {
	const found = new Set();
	const walk = function (items) {
		(items || []).forEach((item) => {
			if (item && typeof item.target == 'string') {
				found.add(item.target);
			}
			if (item && item.children) {
				walk(item.children);
			}
		});
	};
	walk(menu);
	walk(shortcuts);
	return found;
}

/**
 * @param {string} target
 * @param {Set<string>|null} [allowed] known targets (when given, only these)
 * @returns {boolean} the command can be recorded and played
 */
export function can_record(target, allowed) {
	if (typeof target != 'string' || !TARGET_PATTERN.test(target)) {
		return false;
	}
	if (EXCLUDED_PREFIXES.some((prefix) => { return target.indexOf(prefix) == 0; })) {
		return false;
	}
	return !allowed || allowed.has(target);
}

function is_plain_value(value) {
	return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/**
 * Settings of a dialog as they can be saved: only text, numbers and yes / no
 *
 * @param {object} params
 * @returns {object}
 */
export function clean_params(params) {
	const result = {};
	Object.keys(params || {}).slice(0, 80).forEach((key) => {
		const value = params[key];
		if (/^[\w\-. ]{1,60}$/.test(key) && is_plain_value(value)) {
			result[key] = typeof value == 'string' ? value.slice(0, 500) : value;
		}
	});
	return result;
}

/**
 * An action from a file or from the storage can contain anything, so everything is checked and cut to size.
 *
 * @param {any} data
 * @param {Set<string>|null} [allowed] known targets
 * @returns {Action|null} null when it is not an action or has no usable step
 */
export function sanitize_action(data, allowed) {
	if (!data || typeof data != 'object' || !Array.isArray(data.steps)) {
		return null;
	}
	const steps = [];
	data.steps.slice(0, MAX_STEPS).forEach((step) => {
		if (!step || !can_record(step.target, allowed)) {
			return;
		}
		const dialogs = Array.isArray(step.dialogs) ? step.dialogs.slice(0, MAX_DIALOGS).map(clean_params) : [];
		steps.push({target: step.target, parameter: is_plain_value(step.parameter) && step.parameter !== undefined ? step.parameter : null, dialogs});
	});
	if (steps.length == 0) {
		return null;
	}
	const name = String(data.name == null ? '' : data.name).replace(/[<>]/g, '').trim().slice(0, MAX_NAME);
	const id = typeof data.id == 'string' && /^[\w-]{1,40}$/.test(data.id) ? data.id : null;
	return {id: id || make_id(), name: name || 'Action', steps};
}

/**
 * @returns {string}
 */
export function make_id() {
	return `${Date.now().toString(36)  }-${  Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * @param {{getItem: function, setItem: function}|null} storage localStorage or something that looks like it
 * @param {Set<string>|null} [allowed]
 * @returns {Action[]} the saved actions (an empty list when there are none or the storage does not work)
 */
export function load_actions(storage, allowed) {
	try {
		const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.slice(0, MAX_ACTIONS).map((item) => { return sanitize_action(item, allowed); }).filter(Boolean);
	}
	catch {
		return [];
	}
}

/**
 * @param {{getItem: function, setItem: function}|null} storage
 * @param {Action[]} actions
 * @returns {boolean} saved
 */
export function save_actions(storage, actions) {
	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(actions.slice(0, MAX_ACTIONS)));
		return true;
	}
	catch {
		return false;
	}
}

/**
 * @param {Action_step} step
 * @returns {string} short text for the list of the steps (the name of the command)
 */
export function describe_step(step) {
	const name = step.target.split('.').pop().replace(/_/g, ' ');
	return name.charAt(0).toUpperCase() + name.slice(1) + (step.parameter !== null && step.parameter !== undefined ? ` (${step.parameter})` : '');
}

/**
 * The text of an action for a file (the id is not saved, a new one is made when it is opened)
 *
 * @param {Action} action
 * @returns {string}
 */
export function export_action(action) {
	return JSON.stringify({format: 'lumifex-action', version: 1, name: action.name, steps: action.steps}, null, 2);
}

/**
 * @param {string} text content of a file
 * @param {Set<string>|null} [allowed]
 * @returns {Action|null}
 */
export function import_action(text, allowed) {
	try {
		const data = JSON.parse(text);
		if (!data || data.format != 'lumifex-action') {
			return null;
		}
		return sanitize_action({name: data.name, steps: data.steps}, allowed);
	}
	catch {
		return null;
	}
}

//the state of the recorder and of the player
let recording = null; //{name, steps}
let replay = null; //{dialogs: [...]}
let allowed_targets = null;
const listeners = [];
let open_dialog_step = null; //the step whose dialog is open now

/**
 * @param {Set<string>|null} targets the commands that exist; nothing else is recorded
 */
export function set_allowed_targets(targets) {
	allowed_targets = targets;
}

/**
 * @param {function} listener called with the recording after every change (null when it stops)
 */
export function on_recording_change(listener) {
	listeners.push(listener);
}

function notify() {
	listeners.forEach((listener) => { listener(recording); });
}

export function is_recording() {
	return recording != null && replay == null;
}

export function is_replaying() {
	return replay != null;
}

/**
 * @param {string} name
 */
export function start_recording(name) {
	recording = {name: String(name || 'Action').slice(0, MAX_NAME), steps: []};
	open_dialog_step = null;
	notify();
}

/**
 * @returns {Action|null} the recorded action (null when nothing was recorded)
 */
export function stop_recording() {
	const done = recording;
	recording = null;
	open_dialog_step = null;
	notify();
	return done ? sanitize_action({name: done.name, steps: done.steps}, allowed_targets) : null;
}

export function cancel_recording() {
	recording = null;
	open_dialog_step = null;
	notify();
}

/**
 * A command of the menu starts
 *
 * @param {string} target
 * @param {any} parameter
 */
export function note_target(target, parameter) {
	open_dialog_step = null;
	if (!is_recording() || !can_record(target, allowed_targets) || recording.steps.length >= MAX_STEPS) {
		return;
	}
	recording.steps.push({target, parameter: is_plain_value(parameter) && parameter !== undefined ? parameter : null, dialogs: [], pending: true});
	open_dialog_step = recording.steps[recording.steps.length - 1];
	notify();
}

/**
 * The dialog was confirmed
 *
 * @param {object} params settings in the dialog
 */
export function note_dialog_done(params) {
	if (!is_recording() || open_dialog_step == null) {
		return;
	}
	if (open_dialog_step.dialogs.length < MAX_DIALOGS) {
		open_dialog_step.dialogs.push(clean_params(params));
	}
}

/**
 * The dialog was closed with Cancel: the command did nothing, so it is not part of the action
 */
export function note_dialog_cancelled() {
	if (!is_recording() || open_dialog_step == null) {
		return;
	}
	if (open_dialog_step.dialogs.length == 0) {
		const index = recording.steps.indexOf(open_dialog_step);
		if (index >= 0) {
			recording.steps.splice(index, 1);
		}
		open_dialog_step = null;
		notify();
	}
}

/**
 * @param {Action_step} step
 */
export function begin_replay(step) {
	replay = {dialogs: step.dialogs.map((params) => { return Object.assign({}, params); })};
}

export function end_replay() {
	replay = null;
}

/**
 * The settings for the next dialog while an action plays: the recorded ones on top of the starting values of the dialog.
 *
 * @param {object[]} definition parameters of the dialog (as given to Dialog.show)
 * @returns {object}
 */
export function next_replay_params(definition) {
	const params = {};
	(definition || []).forEach((item) => {
		if (item && item.name) {
			params[item.name] = item.value !== undefined ? item.value : (Array.isArray(item.values) ? item.values[0] : null);
		}
	});
	const recorded = replay && replay.dialogs.length > 0 ? replay.dialogs.shift() : {};
	return Object.assign(params, recorded);
}
