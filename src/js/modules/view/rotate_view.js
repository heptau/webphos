import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import { normalize_view, is_transformed, css_transform } from './../../libs/view-transform.js';

/**
 * View > Rotate View / Flip View - the picture is shown turned or mirrored (like a sheet of paper on the table),
 * the document itself does not change and the tools work as usual. Nothing of this is saved in the picture.
 */
class View_rotate_view_class {

	/**
	 * View > Rotate View... - an angle, shown while the dialog is open
	 */
	rotate_view() {
		var original = normalize_view(config.view);
		new Dialog_class().show({
			title: 'Rotate View',
			params: [
				{name: "angle", title: "Angle:", value: original.rotate, range: [-180, 180], step: 1},
			],
			on_change: (params) => {
				this.set({rotate: parseFloat(params.angle) || 0, flip: config.view.flip});
			},
			on_cancel: () => {
				this.set(original);
			},
		});
	}

	rotate_right() {
		this.set({rotate: config.view.rotate + 90, flip: config.view.flip});
	}

	rotate_left() {
		this.set({rotate: config.view.rotate - 90, flip: config.view.flip});
	}

	flip() {
		this.set({rotate: config.view.rotate, flip: !config.view.flip});
	}

	reset() {
		this.set({rotate: 0, flip: false});
	}

	/**
	 * @param {{rotate: number, flip: boolean}} view
	 */
	set(view) {
		config.view = normalize_view(view);
		var wrapper = document.getElementById('canvas_wrapper');
		wrapper.style.transform = css_transform(config.view);
		//the rulers belong to the unchanged picture, so they are hidden while it is turned
		var area = document.getElementById('middle_area');
		if (area) {
			area.classList.toggle('view_transformed', is_transformed(config.view));
		}
		//the place of the canvas on the screen changed
		if (app.GUI) {
			app.GUI.check_canvas_offset();
		}
		config.need_render = true;
	}
}

export default View_rotate_view_class;
