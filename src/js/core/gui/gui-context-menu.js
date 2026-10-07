import config from './../../config.js';
import Tools_translate_class from './../../modules/tools/translate.js';
import { format_shortcut_mac, is_mac_platform } from './../../libs/shortcuts.js';
import Shortcut_manager_class from './../shortcut-manager.js';

function escape_html(text) {
	return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

//items of the canvas context menu: {name, target, parameter, shortcut} or {divider: true}
export const CANVAS_MENU = [
	{name: 'Undo', shortcut: 'Ctrl+Z', target: 'edit/undo.undo'},
	{name: 'Redo', shortcut: 'Ctrl+Y', target: 'edit/redo.redo'},
	{divider: true},
	{name: 'Cut', shortcut: 'Ctrl+X', target: 'edit/copy.cut'},
	{name: 'Copy to Clipboard', shortcut: 'Ctrl+C', target: 'edit/copy.copy_to_clipboard'},
	{name: 'Paste', shortcut: 'Ctrl+V', target: 'edit/paste.paste'},
	{divider: true},
	{name: 'All', shortcut: 'Ctrl+A', target: 'edit/selection.select_all'},
	{name: 'Deselect', shortcut: 'Ctrl+D', target: 'edit/selection.deselect'},
	{name: 'Inverse', shortcut: 'Shift+Ctrl+I', target: 'edit/selection.invert'},
	{divider: true},
	{name: 'Layer via Copy', shortcut: 'Ctrl+J', target: 'layer/duplicate.via_copy'},
	{name: 'Fill with Foreground Color', shortcut: 'Alt+Backspace', target: 'edit/fill.fill'},
	{divider: true},
	{name: 'Fit Window', shortcut: 'Ctrl+0', target: 'view/zoom.auto'},
];

export const LAYER_MENU = [
	{name: 'Rename', target: 'layer/rename.rename'},
	{name: 'Color Label', ellipsis: true, target: 'layer/label.label'},
	{name: 'Duplicate', target: 'layer/duplicate.duplicate'},
	{name: 'Show / Hide', target: 'layer/visibility.toggle'},
	{name: 'Lock / Unlock Layer', target: 'layer/lock.toggle'},
	{divider: true},
	{name: 'Convert to Raster', target: 'layer/raster.raster'},
	{name: 'Layer Mask', target: 'layer/mask.reveal_all'},
	{name: 'Composition', ellipsis: true, target: 'layer/composition.composition'},
	{divider: true},
	{name: 'Merge Down', shortcut: 'Ctrl+E', target: 'layer/merge.merge'},
	{name: 'Flatten Image', shortcut: 'Shift+Ctrl+E', target: 'layer/flatten.flatten'},
	{name: 'Delete', target: 'layer/delete.delete'},
];

/**
 * right click menu, looks like the main menu dropdowns
 */
class GUI_context_menu_class {

	constructor() {
		this.host = null;
		this.mac = is_mac_platform();
		this.Tools_translate = new Tools_translate_class();
		this.Shortcuts = new Shortcut_manager_class();
	}

	/**
	 * @param {MouseEvent} event
	 * @param {object[]} items
	 * @param {function} run called with (target, parameter)
	 */
	show(event, items, run) {
		this.hide();
		event.preventDefault();

		this.host = document.createElement('div');
		this.host.className = 'main_menu context_host';
		var html = '<ul class="menu_dropdown" role="menu">';
		items.forEach((item, index) => {
			if (item.divider) {
				html += '<li role="presentation"><hr></li>';
				return;
			}
			//the shortcut that is used now (the user can change it), the written one for commands that have none in the list
			var current = item.target ? this.Shortcuts.text_for(item.target, item.parameter) : null;
			var shortcut = current !== null ? current : item.shortcut;
			html += '<li><a role="menuitem" href="javascript:void(0)" data-index="' + index + '">'
				+ '<span class="name"><span class="trn">' + escape_html(item.name) + '</span>' + (item.ellipsis ? '…' : '') + '</span>'
				+ (shortcut ? '<span class="shortcut">' + escape_html(this.mac ? format_shortcut_mac(shortcut) : shortcut) + '</span>' : '')
				+ '</a></li>';
		});
		html += '</ul>';
		this.host.innerHTML = html;
		document.body.appendChild(this.host);
		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, this.host);
		}

		var list = this.host.querySelector('ul');
		var x = Math.min(event.clientX, window.innerWidth - list.offsetWidth - 4);
		var y = Math.min(event.clientY, window.innerHeight - list.offsetHeight - 4);
		list.style.left = Math.max(4, x) + 'px';
		list.style.top = Math.max(4, y) + 'px';

		var close_on = (e) => {
			if (!this.host || this.host.contains(e.target) == false) {
				this.hide();
			}
		};
		this.cleanup = () => {
			document.removeEventListener('mousedown', close_on, true);
			document.removeEventListener('touchstart', close_on, true);
			document.removeEventListener('keydown', on_key, true);
			window.removeEventListener('blur', this.hide_bound);
			window.removeEventListener('resize', this.hide_bound);
		};
		var on_key = (e) => {
			if (e.key == 'Escape') {
				if (document.getElementById('popups').children.length == 0) {
					e.stopPropagation();
				}
				this.hide();
			}
			else if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
				//keyboard navigation inside the menu
				var links = Array.from(list.querySelectorAll('a'));
				var index = links.indexOf(document.activeElement);
				e.preventDefault();
				var next = e.key == 'ArrowDown' ? (index + 1) % links.length : (index - 1 + links.length) % links.length;
				links[index < 0 && e.key == 'ArrowUp' ? links.length - 1 : next].focus();
			}
		};
		this.hide_bound = () => this.hide();
		document.addEventListener('mousedown', close_on, true);
		document.addEventListener('touchstart', close_on, true);
		document.addEventListener('keydown', on_key, true);
		window.addEventListener('blur', this.hide_bound);
		window.addEventListener('resize', this.hide_bound);

		list.addEventListener('contextmenu', (e) => e.preventDefault());
		list.addEventListener('click', (e) => {
			var link = e.target.closest('a');
			if (!link) {
				return;
			}
			var item = items[parseInt(link.dataset.index, 10)];
			this.hide();
			if (item && item.target) {
				run(item.target, item.parameter ?? null);
			}
		});
	}

	hide() {
		if (this.cleanup) {
			this.cleanup();
			this.cleanup = null;
		}
		if (this.host && this.host.parentNode) {
			this.host.parentNode.removeChild(this.host);
		}
		this.host = null;
	}
}

export default GUI_context_menu_class;
