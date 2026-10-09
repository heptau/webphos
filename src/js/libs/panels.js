/**
 * Show / hide parts of the interface (Window menu, like in Photoshop).
 * State is saved in cookies, "panel_<name>" = 0 for hidden panels.
 */
import Helper_class from './helpers.js';

export const PANELS = {
	tools: '.sidebar_left',
	options: '.submenu',
	preview: '.sidebar_right .preview.block',
	histogram: '#histogram_base',
	colors: '.sidebar_right .colors.block',
	details: '#details_base',
	history: '#history_base',
	layers: '.sidebar_right .layers.block',
	status: '#status_bar',
};

const helper = new Helper_class();

export function is_panel_visible(name) {
	const element = document.querySelector(PANELS[name]);
	return element != null && element.classList.contains('panel_hidden') == false;
}

/**
 * @param {string} name key of PANELS
 * @param {boolean} visible
 * @param {boolean} [save] remember the choice
 */
export function set_panel_visible(name, visible, save = true, notify = true) {
	const element = PANELS[name] ? document.querySelector(PANELS[name]) : null;
	if (!element) {
		return;
	}
	element.classList.toggle('panel_hidden', visible == false);
	if (name == 'status') {
		document.body.classList.toggle('no_status', visible == false);
	}
	if (name == 'options') {
		document.body.classList.toggle('no_options', visible == false);
	}
	if (save) {
		helper.setCookie(`panel_${  name}`, visible ? 1 : 0);
	}
	if (notify) {
		window.dispatchEvent(new Event('resize'));
		//the History panel shows its list again
		document.dispatchEvent(new Event('minipaint:history'));
	}
}

/**
 * hide panels that were hidden last time
 */
export function restore_panels() {
	for (const name in PANELS) {
		if (helper.getCookie(`panel_${  name}`) === 0) {
			set_panel_visible(name, false, false, false);
		}
	}
}

/**
 * Tab key - hide / show all panels
 */
export function toggle_all_panels() {
	const any_visible = Object.keys(PANELS).some((name) => name != 'options' && is_panel_visible(name));
	for (const name in PANELS) {
		set_panel_visible(name, any_visible == false, false, false);
	}
	window.dispatchEvent(new Event('resize'));
	document.dispatchEvent(new Event('minipaint:history'));
}

//panels that are visible in a workspace (all others are hidden)
export const WORKSPACES = {
	essentials: ['tools', 'options', 'preview', 'colors', 'details', 'history', 'layers', 'status'],
	painting: ['tools', 'options', 'colors', 'layers', 'status'],
	photography: ['tools', 'options', 'histogram', 'history', 'layers', 'status'],
	minimal: ['tools', 'options', 'layers'],
};

/**
 * @param {string[]} visible names of panels that stay visible
 */
export function apply_visible_panels(visible) {
	for (const name in PANELS) {
		set_panel_visible(name, visible.includes(name), true, false);
	}
	window.dispatchEvent(new Event('resize'));
	document.dispatchEvent(new Event('minipaint:history'));
}

/**
 * @returns {string[]} names of panels that are visible now
 */
export function get_visible_panels() {
	return Object.keys(PANELS).filter((name) => is_panel_visible(name));
}

/**
 * @param {string} name key of WORKSPACES or "custom" (saved by the user)
 * @returns {boolean} false when there is no such workspace
 */
export function apply_workspace(name) {
	let visible = WORKSPACES[name];
	if (name == 'custom') {
		try {
			visible = JSON.parse(String(helper.getCookie('workspace_custom') || ''));
		}
		catch {
			visible = null;
		}
		if (Array.isArray(visible) == false) {
			return false;
		}
		visible = visible.filter((item) => PANELS[item] != undefined);
	}
	if (!visible) {
		return false;
	}
	apply_visible_panels(visible);
	return true;
}

export function save_custom_workspace() {
	helper.setCookie('workspace_custom', JSON.stringify(get_visible_panels()));
}
