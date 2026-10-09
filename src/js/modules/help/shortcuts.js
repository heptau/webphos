import Dialog_class from './../../libs/popup.js';
import shortcutsDefinition from './../../config-shortcuts.js';
import { format_shortcut_mac, is_mac_platform } from './../../libs/shortcuts.js';

class Help_shortcuts_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	//shortcuts
	shortcuts() {
		const params = [
			{title: "F", value: 'Auto Adjust Colors'},
			{title: "F3 / ⌘ + F", value: 'Search'},
			{title: "Ctrl + C", value: 'Copy to Clipboard'},
			{title: "D", value: 'Duplicate'},
			{title: "S", value: 'Export'},
			{title: "G", value: 'Grid on/off'},
			{title: "I", value: 'Information'},
			{title: "N", value: 'New layer'},
			{title: "O", value: 'Open'},
			{title: "CTRL + V", value: 'Paste'},
			{title: "F10", value: 'Quick Load'},
			{title: "F9", value: 'Quick Save'},
			{title: "R", value: 'Resize'},
			{title: "L", value: 'Rotate left'},
			{title: "U", value: 'Ruler'},
			{title: "Shift + S", value: 'Save As'},
			{title: "CTRL + A", value: 'Select All'},
			{title: "H", value: 'Shapes'},
			{title: "T", value: 'Trim'},
			{title: "CTRL + Z", value: 'Undo'},
			{title: "CTRL + Y", value: 'Redo'},
			{title: "Scroll", value: 'Move the image'},
			{title: "Ctrl + Scroll", value: 'Zoom'},
			{title: "Space + drag", value: 'Hand'},
			{title: "X", value: 'Swap colors'},
			{title: "Z", value: 'Zoom'},
		];
		//Photoshop-like shortcuts
		for (const i in shortcutsDefinition) {
			params.push({title: shortcutsDefinition[i].title, value: shortcutsDefinition[i].name});
		}

		//macOS notation (⇧⌘D) where it applies
		if (is_mac_platform()) {
			params.forEach((param) => {
				if (/(ctrl|shift|alt)/i.test(param.title)) {
					param.title = format_shortcut_mac(param.title.replace(/CTRL/g, 'Ctrl'));
				}
			});
		}

		const settings = {
			title: 'Keyboard Shortcuts',
			className: 'shortcuts',
			params,
			on_load: (values, popup) => {
				//search field above the list
				const content = popup.el.querySelector('[data-id="params_content"]');
				const search = document.createElement('input');
				search.type = 'search';
				search.className = 'shortcuts_search';
				search.setAttribute('aria-label', 'Search');
				search.placeholder = '⌕';
				search.addEventListener('input', () => {
					const query = search.value.trim().toLowerCase();
					content.querySelectorAll('tr').forEach((row) => {
						row.style.display = query == '' || row.textContent.toLowerCase().indexOf(query) >= 0 ? '' : 'none';
					});
				});
				content.parentNode.insertBefore(search, content);
				search.focus();
			},
		};
		this.POP.show(settings);
	}

}

export default Help_shortcuts_class;
