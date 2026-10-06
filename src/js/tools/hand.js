import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import GUI_preview_class from './../core/gui/gui-preview.js';

/**
 * Hand tool - drag to move the image (Space does the same with any tool)
 */
class Hand_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'hand';
		this.last = null;
	}

	load() {
		var wrapper = function () {
			return document.getElementById('main_wrapper');
		};

		document.addEventListener('mousedown', (event) => {
			if (config.TOOL.name != this.name || event.button !== 0 || !event.target.closest('#main_wrapper')) {
				return;
			}
			event.preventDefault();
			this.last = {x: event.clientX, y: event.clientY};
			wrapper().style.cursor = 'grabbing';
		});
		document.addEventListener('mousemove', (event) => {
			if (this.last == null) {
				return;
			}
			new GUI_preview_class().pan(event.clientX - this.last.x, event.clientY - this.last.y);
			this.last = {x: event.clientX, y: event.clientY};
		});
		document.addEventListener('mouseup', () => {
			if (this.last != null) {
				this.last = null;
				wrapper().style.cursor = 'grab';
			}
		});
	}
}

export default Hand_class;
