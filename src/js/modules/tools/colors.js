import app from './../../app.js';

/**
 * The keys X (swap the foreground and background color) and D (default colors) run these
 */
class Tools_colors_class {

	swap() {
		app.GUI.GUI_colors.swap_colors();
	}

	reset() {
		app.GUI.GUI_colors.reset_colors();
	}
}

export default Tools_colors_class;
