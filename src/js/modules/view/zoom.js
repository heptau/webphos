import GUI_preview_class from './../../core/gui/gui-preview.js';
import config from './../../config.js';
import Selection_class from './../../tools/selection.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class View_zoom_class {

	constructor() {
		this.GUI_preview = new GUI_preview_class();
	}

	in() {
		this.GUI_preview.zoom(1);
	}

	out() {
		this.GUI_preview.zoom(-1);
	}

	original() {
		this.GUI_preview.zoom(100);
	}

	/**
	 * View > Zoom > Zoom to Selection - the selected area fills the window
	 */
	async to_selection() {
		var selection = new Selection_class().selection;
		if (!selection || !(selection.width > 0) || !(selection.height > 0)) {
			alertify.warning(t('Nothing is selected.'));
			return;
		}
		var visible_w = config.visible_width || 800;
		var visible_h = config.visible_height || 600;
		var percent = Math.min(visible_w / selection.width, visible_h / selection.height) * 100 * 0.9;
		percent = Math.max(2, Math.min(3200, Math.round(percent)));
		this.GUI_preview.set_center_zoom();
		await this.GUI_preview.zoom(percent);
		//center the selection
		this.GUI_preview.zoom_to_position(
			selection.x - (visible_w / config.ZOOM - selection.width) / 2,
			selection.y - (visible_h / config.ZOOM - selection.height) / 2
		);
	}

	auto() {
		this.GUI_preview.zoom_auto();
	}
}

export default View_zoom_class;
