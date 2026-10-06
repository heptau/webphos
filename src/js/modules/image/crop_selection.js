import config from './../../config.js';
import Base_gui_class from './../../core/base-gui.js';
import Edit_selection_class from './../edit/selection.js';
import { mask_bounds } from './../../libs/selection-mask.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

var instance = null;

/**
 * Image > Crop to Selection - uses the crop tool's logic with the rectangle of the active selection.
 */
class Image_crop_selection_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_gui = new Base_gui_class();
		this.Edit_selection = new Edit_selection_class();
	}

	crop() {
		if (this.Edit_selection.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		var current = this.Edit_selection.get_mask();
		var selection = current.kind == 'custom' ? mask_bounds(current.mask) : this.Edit_selection.Selection.selection;
		if (selection == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		var crop_module = this.Base_gui.GUI_tools.tools_modules['crop'];
		if (!crop_module || !crop_module.object) {
			return;
		}
		var crop = crop_module.object;
		crop.selection.x = Math.round(selection.x);
		crop.selection.y = Math.round(selection.y);
		crop.selection.width = Math.round(selection.width);
		crop.selection.height = Math.round(selection.height);

		this.Edit_selection.deselect();
		return crop.on_params_update();
	}

}

export default Image_crop_selection_class;
