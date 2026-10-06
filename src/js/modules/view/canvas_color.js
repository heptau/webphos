import Helper_class from './../../libs/helpers.js';

const COLORS = {
	default: '',
	gray: '#6e6e73',
	dark: '#1a1a1b',
	black: '#000000',
	white: '#ffffff',
};

/**
 * View > Canvas Color - color of the area around the image (does not change the image)
 */
class View_canvas_color_class {

	constructor() {
		this.Helper = new Helper_class();
		var saved = this.Helper.getCookie('canvas_color');
		if (saved && COLORS[saved] !== undefined) {
			this.apply(saved);
		}
	}

	apply(name) {
		var wrapper = document.getElementById('main_wrapper');
		if (wrapper) {
			wrapper.style.backgroundColor = COLORS[name];
		}
	}

	/**
	 * @param {string} name default, gray, dark, black or white
	 */
	set_color(name) {
		if (COLORS[name] === undefined) {
			return;
		}
		this.apply(name);
		this.Helper.setCookie('canvas_color', name);
	}
}

export default View_canvas_color_class;
