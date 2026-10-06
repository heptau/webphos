import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from './../tools/translate.js';
import { PANELS, is_panel_visible, set_panel_visible, toggle_all_panels, apply_workspace, save_custom_workspace } from './../../libs/panels.js';

/**
 * Window menu - show / hide interface panels
 */
class View_panels_class {

	/**
	 * @param {string} name key of PANELS
	 */
	toggle(name) {
		if (PANELS[name] == undefined) {
			return;
		}
		set_panel_visible(name, is_panel_visible(name) == false);
	}

	/**
	 * @param {string} name essentials, painting, photography, minimal or custom
	 */
	workspace(name) {
		if (apply_workspace(name) == false) {
			alertify.warning(t('No saved workspace yet.'));
		}
	}

	save_workspace() {
		save_custom_workspace();
		alertify.success(t('Workspace saved.'));
	}

	toggle_all() {
		toggle_all_panels();
	}
}

export default View_panels_class;
