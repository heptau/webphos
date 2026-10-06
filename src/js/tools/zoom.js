import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import GUI_preview_class from './../core/gui/gui-preview.js';
import Helper_class from './../libs/helpers.js';
import { has_modifier } from './../libs/shortcuts.js';

/**
 * Zoom tool - click zooms in at the pointer, Alt + click zooms out (Z selects the tool)
 */
class Zoom_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'zoom';
		this.Helper = new Helper_class();
	}

	load() {
		document.addEventListener('mousedown', (event) => {
			if (config.TOOL.name != this.name || event.button !== 0 || !event.target.closest('#main_wrapper')) {
				return;
			}
			event.preventDefault();
			var preview = new GUI_preview_class();
			var rect = document.getElementById('canvas_minipaint').getBoundingClientRect();
			preview.zoom_data.x = event.clientX - rect.left;
			preview.zoom_data.y = event.clientY - rect.top;
			preview.zoom(event.altKey ? -1 : 1);
		});

		//Z - select the zoom tool
		document.addEventListener('keydown', (event) => {
			if (event.key.toLowerCase() != 'z' || has_modifier(event) || event.shiftKey
				|| this.Helper.is_input(event.target) || document.getElementById('popups').children.length > 0) {
				return;
			}
			event.preventDefault();
			document.querySelector('#tools_container .zoom').click();
		});

		//Alt turns the zoom cursor into zoom out
		var update_cursor = (event) => {
			if (config.TOOL.name == this.name) {
				document.getElementById('main_wrapper').style.cursor = event.altKey ? 'zoom-out' : 'zoom-in';
			}
		};
		document.addEventListener('keydown', update_cursor);
		document.addEventListener('keyup', update_cursor);
	}
}

export default Zoom_class;
