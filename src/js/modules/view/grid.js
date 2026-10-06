import config from './../../config.js';
import Helper_class from './../../libs/helpers.js';
import Base_gui_class from './../../core/base-gui.js';
import Dialog_class from './../../libs/popup.js';

var instance = null;

class View_grid_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.GUI = new Base_gui_class();
		this.Helper = new Helper_class();

		var saved = String(this.Helper.getCookie('grid_size') || '').split(',').map((v) => parseInt(v, 10));
		if (saved.length == 2 && saved[0] >= 3 && saved[1] >= 3) {
			this.GUI.grid_size = saved;
		}

		this.set_events();
	}

	set_events() {
		document.addEventListener('keydown', (event) => {
			var code = event.keyCode;
			if (this.Helper.is_input(event.target))
				return;

			if (code == 71 && event.ctrlKey != true && event.metaKey != true) {
				//G - grid
				this.grid({visible: !this.GUI.grid});
				event.preventDefault();
			}
		}, false);
	}

	/**
	 * View > Grid Settings - size of the grid cells
	 */
	settings() {
		var dialog = new Dialog_class();
		dialog.show({
			title: 'Grid Settings',
			params: [
				{name: "x", title: "Width:", value: this.GUI.grid_size[0], range: [3, 500]},
				{name: "y", title: "Height:", value: this.GUI.grid_size[1], range: [3, 500]},
			],
			on_finish: (params) => {
				this.GUI.grid_size = [Math.max(3, parseInt(params.x, 10) || 50), Math.max(3, parseInt(params.y, 10) || 50)];
				this.Helper.setCookie('grid_size', this.GUI.grid_size.join(','));
				this.GUI.grid = true;
				config.need_render = true;
			},
		});
	}

	grid() {
		if (this.GUI.grid == false) {
			this.GUI.grid = true;
		}
		else {
			this.GUI.grid = false;
		}
		config.need_render = true;
	}

}

export default View_grid_class;