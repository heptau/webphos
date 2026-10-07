/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import config from './../../config.js';
import menuDefinition from './../../config-menu.js';
import Tools_translate_class from './../../modules/tools/translate.js';
import { format_shortcut_mac, is_mac_platform } from './../../libs/shortcuts.js';
import { is_panel_visible } from './../../libs/panels.js';
import { menu_icon } from './../../libs/menu-icons.js';
import Helper_class from './../../libs/helpers.js';

/**
 * Check mark state of a menu item: true / false for items that switch something on or off or choose one
 * of several options, null for ordinary commands.
 */
function get_check_state(definition) {
	var helper = new Helper_class();
	if (definition.panel) {
		return is_panel_visible(definition.panel);
	}
	var target = definition.target || '';
	var parameter = definition.parameter;
	switch (target) {
		case 'view/proof.proof':
			return (config.proof || 'none') == parameter;
		case 'view/canvas_color.set_color':
			return (helper.getCookie('canvas_color') || 'default') == parameter;
		case 'tools/settings.set_theme':
			return (helper.getCookie('theme') || 'auto') == parameter;
		case 'view/guides.toggle':
			return config.guides_enabled !== false;
		case 'view/guides.toggle_snap':
			return config.SNAP !== false;
		case 'view/grid.pixel_grid':
			return config.pixel_grid !== false;
		case 'view/ruler.ruler':
			return config.ruler_active === true;
		case 'view/split_compare.toggle':
			return !!config.compare;
		case 'view/full_screen.fs':
			return !!document.fullscreenElement;
	}
	return null;
}

/**
 * class responsible for rendering main menu
 */
function escape_html(text) {
	return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class GUI_menu_class {

	constructor() {
		this.eventSubscriptions = {};
		this.dropdownMaxHeightMargin = 15;
		this.menuContainer = null;
		this.menuBarNode = null;
		this.lastFocusedMenuBarLink = 0;
		this.dropdownStack = [];
		this.press = null;
		this.suppress_click_until = 0;
		this.mac = is_mac_platform();

		this.Tools_translate = new Tools_translate_class();
	}

	render_main() {
		if (this.initialized) {
			return;
		}
		this.initialized = true;
		this.menuContainer = document.getElementById('main_menu');

		let menuTemplate = '<ul class="menu_bar" role="menubar" tabindex="0">';
		for (let i = 0; i < menuDefinition.length; i++) {
			const item = menuDefinition[i];
			menuTemplate += this.generate_menu_bar_item_template(item, i);
		}
		menuTemplate += '</ul>';

		this.menuContainer.innerHTML = menuTemplate;
		this.menuBarNode = this.menuContainer.querySelector('[role="menubar"]');

		this.menuContainer.addEventListener('mousedown', (event) => { return this.on_mouse_down_menu(event); }, true);
		document.addEventListener('mouseup', (event) => { return this.on_mouse_up_menu(event); }, true);
		this.menuContainer.addEventListener('mouseover', (event) => { return this.on_mouse_over_menu(event); });
		this.menuContainer.addEventListener('click', (event) => { return this.on_click_menu(event); }, true);
		this.menuContainer.addEventListener('keydown', (event) => { return this.on_key_down_menu(event); }, true);
		this.menuBarNode.addEventListener('focus', (event) => { return this.on_focus_menu_bar(event); });
		this.menuBarNode.addEventListener('blur', (event) => { return this.on_blur_menu_bar(event); });
		this.menuBarNode.querySelectorAll('a').forEach((link) => {
			link.addEventListener('focus', (event) => { return this.on_focus_menu_bar_link(event); });
		});
		document.body.addEventListener('mousedown', (event) => { return this.on_mouse_down_body(event); }, true);
		document.body.addEventListener('touchstart', (event) => { return this.on_mouse_down_body(event); }, {capture: true, passive: true});
		window.addEventListener('resize', (event) => { return this.on_resize_window(event); }, true);
		
		document.body.classList.add('loaded');
		
		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, this.menuContainer);
		}
	}

	on(eventName, callback) {
		if (!this.eventSubscriptions[eventName]) {
			this.eventSubscriptions[eventName] = [];
		}
		if (!this.eventSubscriptions[eventName].includes(callback)) {
			this.eventSubscriptions[eventName].push(callback);
		}
	}

	emit(eventName, payload, object) {
		if (this.eventSubscriptions[eventName]) {
			for (let callback of this.eventSubscriptions[eventName]) {
				callback(payload, object);
			}
		}
	}

	generate_menu_bar_item_template(definition, index) {
		return `
			<li>
				<a id="main_menu_0_${index}" role="menuitem" tabindex="-1" aria-haspopup="true" aria-expanded="false"
					href="javascript:void(0)" data-level="0" data-index="${ index }"><span class="name ${ definition.app_menu ? 'app_name' : 'trn' }">${ definition.name }</span></a>
			</li>
		`.trim();
	}

	generate_menu_dropdown_item_template(definition, level, index) {
		if (definition.divider) {
			return `
				<li role="presentation">
					<hr>
				</li>
			`.trim();
		} else {
			const name = escape_html(definition.name);
			return `
				<li>
					<a id="main_menu_${ level }_${ index }" role="menuitem" tabindex="-1" aria-haspopup="${ (!!definition.children) + '' }"
						href="${ definition.href ? definition.href : 'javascript:void(0)' }"
						target="${ definition.href ? '_blank' : '_self' }"
						${ definition.href ? 'rel="noopener noreferrer"' : '' }
						${ definition.disabled ? 'aria-disabled="true" class="disabled"' : '' }
						${ definition.checked ? 'data-checked="true"' : '' }
						data-level="${ level }" data-index="${ index }">
						${ this.icons_in_dropdown ? `<span class="menu_icon" aria-hidden="true">${ menu_icon(definition.name) }</span>` : '' }
						<span class="name"><span class="${ definition.verbatim ? '' : 'trn' }">${ name }</span>${ definition.ellipsis ? '…' : '' }</span>
						${ definition.shortcut ? `
							<span class="shortcut"><span class="sr_only">Shortcut Key:</span> ${ this.mac ? format_shortcut_mac(definition.shortcut) : definition.shortcut }</span>
						` : `` }
					</a>
				</li>
			`.trim();
		}
	}

	on_mouse_down_body(event) {
		const target = event.touches && event.touches.length > 0 ? event.touches[0].target : event.target;

		// Clicked outside of menu; close dropdowns.
		if (target && !this.menuContainer.contains(target)) {
			this.close_child_dropdowns(0);
		}
	}

	on_focus_menu_bar(event) {
		if (document.activeElement === this.menuBarNode) {
			let lastFocusedLink = this.menuBarNode.querySelector(`[data-index="${ this.lastFocusedMenuBarLink }"]`);
			if (!lastFocusedLink) {
				lastFocusedLink = this.menuBarNode.querySelector('a');
			}
			lastFocusedLink.focus();
		}
	}

	on_focus_menu_bar_link(event) {
		this.lastFocusedMenuBarLink = parseInt(event.target.getAttribute('data-index'), 10) || 0;
	}

	on_blur_menu_bar(event) {
		// TODO
	}

	on_key_down_menu(event) {
		const key = event.key;
		const activeElement = document.activeElement;

		if (activeElement && activeElement.tagName === 'A') {
			const linkLevel = parseInt(activeElement.getAttribute('data-level'), 10) || 0;
			const linkIndex = parseInt(activeElement.getAttribute('data-index'), 10) || 0;
			const menuParent = activeElement.closest('ul');
			if (linkLevel === 0) {
				if (['Right', 'ArrowRight'].includes(event.key)) {
					let nextLink = menuParent.querySelector(`[data-index="${ linkIndex + 1 }"]`);
					if (!nextLink) {
						nextLink = menuParent.querySelector(`[data-index="0"]`);
					}
					nextLink.focus();
				}
				else if (['Left', 'ArrowLeft'].includes(event.key)) {
					let previousLink = menuParent.querySelector(`[data-index="${ linkIndex - 1 }"]`);
					if (!previousLink) {
						previousLink = menuParent.querySelector(`[data-index="${ menuParent.querySelectorAll('[data-index]').length - 1 }"]`);
					}
					previousLink.focus();
				}
				else if (['Down', 'ArrowDown'].includes(event.key)) {
					if (activeElement.getAttribute('aria-haspopup') === 'true') {
						event.preventDefault();
						if (activeElement.getAttribute('aria-expanded') === 'true' && this.dropdownStack[0]) {
							//menu was opened with the mouse - move into it
							this.dropdownStack[0].element.querySelector('a:not(.disabled)').focus();
						}
						else {
							activeElement.click();
						}
					}
				}
				else if (['Esc', 'Escape'].includes(event.key)) {
					this.close_child_dropdowns(0);
				}
				else if (event.key === 'Home') {
					menuParent.querySelector(`[data-index="0"]`).focus();
				}
				else if (event.key === 'End') {
					menuParent.querySelector(`[data-index="${ menuParent.querySelectorAll('[data-index]').length - 1 }"]`).focus();
				}
				else if ([' ', 'Enter'].includes(event.key)) {
					event.preventDefault();
					activeElement.click();
				}
			} else {
				const enabled_links = Array.from(menuParent.querySelectorAll(':scope > li > a:not(.disabled)'));
				const position = enabled_links.indexOf(activeElement);
				if (['Up', 'ArrowUp'].includes(event.key)) {
					event.preventDefault();
					if (enabled_links.length > 0) {
						enabled_links[(position - 1 + enabled_links.length) % enabled_links.length].focus();
					}
				}
				else if (['Down', 'ArrowDown'].includes(event.key)) {
					event.preventDefault();
					if (enabled_links.length > 0) {
						enabled_links[(position + 1) % enabled_links.length].focus();
					}
				}
				else if (['Right', 'ArrowRight'].includes(event.key)) {
					if (activeElement.getAttribute('aria-haspopup') === 'true') {
						activeElement.click();
					}
					else if (this.dropdownStack.length > 1) {
						const opener = this.dropdownStack[linkLevel - 1].opener;
						opener.click();
						opener.focus();
					}
					else {
						const menuBarLinkIndex = parseInt(this.dropdownStack[0].opener.getAttribute('data-index'), 10) || 0;
						let nextLink = this.menuBarNode.querySelector(`[data-index="${ menuBarLinkIndex + 1 }"]`);
						if (!nextLink) {
							nextLink = this.menuBarNode.querySelector(`[data-index="0"]`);
						}
						nextLink.click();
					}
				}
				else if (['Left', 'ArrowLeft'].includes(event.key)) {
					if (this.dropdownStack.length > 1) {
						const opener = this.dropdownStack[linkLevel - 1].opener;
						opener.click();
						opener.focus();
					} else {
						const menuBarLinkIndex = parseInt(this.dropdownStack[0].opener.getAttribute('data-index'), 10) || 0;
						let previousLink = this.menuBarNode.querySelector(`[data-index="${ menuBarLinkIndex - 1 }"]`);
						if (!previousLink) {
							previousLink = this.menuBarNode.querySelector(`[data-index="${ this.menuBarNode.querySelectorAll('[data-index]').length - 1 }"]`);
						}
						previousLink.click();
					}
				}
				else if (event.key === 'Home' && enabled_links.length > 0) {
					enabled_links[0].focus();
				}
				else if (event.key === 'End' && enabled_links.length > 0) {
					enabled_links[enabled_links.length - 1].focus();
				}
				else if ([' ', 'Enter'].includes(event.key)) {
					event.preventDefault();
					activeElement.click();
				}
				else if (['Esc', 'Escape'].includes(event.key)) {
					const opener = this.dropdownStack[linkLevel - 1].opener;
					opener.click();
					opener.focus();
				}
				else if (event.key === 'Tab') {
					this.close_child_dropdowns(0);
				}
			}
		}
	}

	/**
	 * Mouse pressed on a menu bar title: open the menu right away (macOS behaviour), so the user
	 * can keep the button down, move to an item and release over it to run it.
	 */
	on_mouse_down_menu(event) {
		//a click that was never delivered after the previous press must not eat this one
		this.suppress_click_until = 0;
		if (event.button !== 0) {
			return;
		}
		const link = event.target.closest ? event.target.closest('a') : null;
		if (!link || link.getAttribute('data-level') !== '0') {
			return;
		}
		if (link.getAttribute('aria-expanded') === 'true') {
			//second click on the open title closes it (handled by click)
			this.press = null;
			return;
		}
		this.press = { link: link };
		this.suppress_click();
		this.toggle_dropdown(link, true);
		//keyboard navigation works also after the menu was opened with the mouse
		link.focus({preventScroll: true});
	}

	/**
	 * Mouse released: when the button was held since the menu title, the item under the pointer is run.
	 * Release over the same title keeps the menu open, release anywhere else closes it.
	 */
	on_mouse_up_menu(event) {
		const press = this.press;
		if (!press) {
			return;
		}
		this.press = null;
		const target = document.elementFromPoint(event.clientX, event.clientY);
		const link = target && target.closest ? target.closest('a') : null;
		if (link && link === press.link) {
			this.suppress_click();
			return;
		}
		if (this.dropdownStack.length == 0) {
			return;
		}
		if (link && this.menuContainer.contains(link) && link.getAttribute('data-level') !== '0') {
			if (link.getAttribute('aria-haspopup') === 'true') {
				return;
			}
			this.suppress_click();
			this.trigger_link(link);
			return;
		}
		this.suppress_click();
		this.close_child_dropdowns(0);
	}

	/**
	 * Hover: with an open menu, pointing at another title switches menus, pointing at a submenu
	 * item opens it, pointing at a normal item closes deeper submenus.
	 */
	on_mouse_over_menu(event) {
		if (this.dropdownStack.length == 0) {
			return;
		}
		const link = event.target.closest ? event.target.closest('a') : null;
		if (!link || !this.menuContainer.contains(link)) {
			return;
		}
		const level = parseInt(link.getAttribute('data-level'), 10) || 0;
		const hasPopup = link.getAttribute('aria-haspopup') === 'true';
		if (hasPopup) {
			if (link.getAttribute('aria-expanded') !== 'true') {
				this.toggle_dropdown(link, true);
			}
		}
		else if (level > 0) {
			this.close_child_dropdowns(level);
		}
	}

	//ignore the click event that follows mouse down / up already handled above
	suppress_click() {
		this.suppress_click_until = Date.now() + 300;
	}

	on_click_menu(event) {
		if (Date.now() < this.suppress_click_until) {
			this.suppress_click_until = 0;
			return;
		}
		const target = event.target.closest('a');

		// Any link in the menu is clicked.
		if (target && target.tagName === 'A') {
			const hasPopup = target.getAttribute('aria-haspopup') === 'true';			
			if (hasPopup) {
				//submenu already opened by hovering stays open (macOS behaviour)
				if (event.isTrusted && target.getAttribute('data-level') !== '0'
					&& target.getAttribute('aria-expanded') === 'true') {
					return;
				}
				this.toggle_dropdown(target, event.isTrusted);
			} else {
				this.trigger_link(target);
			}
		} else {
			this.close_child_dropdowns(0);
		}
	}

	on_resize_window(event) {
		if (this.dropdownStack.length > 0) {
			this.position_dropdowns();
		}
	}

	toggle_dropdown(opener, isTrusted) {
		const linkLevel = parseInt(opener.getAttribute('data-level'), 10) || 0;
		const linkIndex = parseInt(opener.getAttribute('data-index'), 10) || 0;
		if (opener.getAttribute('aria-expanded') === 'true') {
			this.close_child_dropdowns(linkLevel);
		} else {
			const parentList = opener.closest('ul');
			parentList.querySelectorAll('a').forEach((item) => {
				item.setAttribute('aria-expanded', 'false');
			});
			opener.setAttribute('aria-expanded', true);
			this.create_dropdown(opener, linkLevel, linkIndex, !isTrusted);
		}
	}

	trigger_link(link) {
		const level = parseInt(link.getAttribute('data-level'), 10) || 0;
		const index = parseInt(link.getAttribute('data-index'), 10) || 0;

		// Find link definition
		let children = menuDefinition;
		for (let i = 0; i < level; i++) {
			const childIndex = this.dropdownStack[i] != null ? this.dropdownStack[i].index : index;
			children = children[childIndex].children;
		}
		let definition = children[index];

		if (definition.disabled) {
			return;
		}

		// Close the dropdown
		this.close_child_dropdowns(0);

		// Emit callback events for triggered links
		if (definition.target) {
			this.emit('select_target', definition.target, definition);
		}
		else if (definition.href) {
			this.emit('select_href', definition.href, null);
		}
	}

	close_child_dropdowns(level) {
		for (let i = this.dropdownStack.length - 1; i >= 0; i--) {
			if (i >= level) {
				this.dropdownStack[i].element.parentNode.removeChild(this.dropdownStack[i].element);
				this.dropdownStack[i].opener.setAttribute('aria-expanded', false);
			}
		}
		this.dropdownStack = this.dropdownStack.slice(0, level);
	}

	create_dropdown(opener, level, index, focusAfterCreation) {
		this.close_child_dropdowns(level);

		// Find child list in the menu definition
		let children = menuDefinition;
		for (let i = 0; i <= level; i++) {
			const childIndex = this.dropdownStack[i] != null ? this.dropdownStack[i].index : index;
			children = children[childIndex].children;
		}

		// Create the dropdown element, place it in DOM & position it
		let dropdownElement = document.createElement('ul');
		dropdownElement.className = 'menu_dropdown';
		dropdownElement.role = 'menu';
		dropdownElement.tabIndex = 0;
		dropdownElement.setAttribute('aria-labelledby', 'main_menu_' + level + '_' + index);
		let dropdownTemplate = '';
		//menu items that show / hide panels get a check mark
		const states = children.map((child) => child.divider ? null : get_check_state(child));
		const has_checks = states.some((state) => state !== null);
		if (has_checks) {
			dropdownElement.classList.add('has_checks');
			children.forEach((child, i) => {
				if (states[i] !== null) {
					child.checked = states[i];
				}
			});
		}
		//icons in front of the names (only when at least one item of the menu has one)
		const has_icons = children.some((child) => !child.divider && menu_icon(child.name) != '');
		if (has_icons) {
			dropdownElement.classList.add('has_icons');
		}
		this.icons_in_dropdown = has_icons;
		for (let i = 0; i < children.length; i++) {
			dropdownTemplate += this.generate_menu_dropdown_item_template(children[i], level + 1, i);
		}
		dropdownElement.innerHTML = dropdownTemplate;

		this.menuContainer.appendChild(dropdownElement);

		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, this.menuContainer);
		}

		if (focusAfterCreation) {
			dropdownElement.querySelector('a').focus();
		}

		this.dropdownStack.push({
			children,
			opener,
			index,
			element: dropdownElement
		});

		this.position_dropdowns();
	}

	position_dropdowns() {
		const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
		const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

		let topNavHeight = 0;
		for (let level = 0; level < this.dropdownStack.length; level++) {
			const dropdownElement = this.dropdownStack[level].element;
			const openerRect = this.dropdownStack[level].opener.getBoundingClientRect();

			topNavHeight = openerRect.height;
			const dropdownMaxHeight = vh - topNavHeight - this.dropdownMaxHeightMargin;
			dropdownElement.style.maxHeight = dropdownMaxHeight + 'px';
			const dropdownRect = dropdownElement.getBoundingClientRect();

			if (level === 0) {
				dropdownElement.style.top = (openerRect.y + openerRect.height) + 'px';

				let left = openerRect.x;
				if (left + dropdownRect.width > vw) {
					left = openerRect.x + openerRect.width - dropdownRect.width;
				}
				if (left + dropdownRect.width > vw) {
					left = vw - dropdownRect.width;
				}
				if (left < 0) {
					left = 0;
				}
				dropdownElement.style.left = left + 'px';
			} else {
				let top = openerRect.y;
				if (top + dropdownRect.height > vh - this.dropdownMaxHeightMargin) {
					top = vh - this.dropdownMaxHeightMargin - dropdownRect.height;
				}
				dropdownElement.style.top = top + 'px';

				let left = openerRect.x + openerRect.width + 1;
				if (left + dropdownRect.width > vw) {
					left = openerRect.x - dropdownRect.width - 1;
				}
				if (left < 0) {
					if (openerRect.x + (openerRect.width / 2) > vw / 2) {
						left = 1;
					} else {
						left = vw - dropdownRect.width - 1;
						if (left < 0) {
							left = 1;
						}
					}
				}
				dropdownElement.style.left = left + 'px';
			}
		}
	}

}

export default GUI_menu_class;
