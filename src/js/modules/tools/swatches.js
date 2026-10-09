import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { parse_gpl, build_gpl } from './../../libs/gpl.js';
import { save_blob } from './../../libs/file-save.js';
import { t } from '../tools/translate.js';

/**
 * Swatches of the Colors panel can be saved to and loaded from .gpl palette files (GIMP, Inkscape, Krita...)
 */
class Tools_swatches_class {

	current_colors() {
		const colors = app.GUI.GUI_colors.inputs.swatches.uiSwatches('get_all_hex');
		return (Array.isArray(colors) ? colors : [colors]).filter((color) => /^#[0-9a-f]{6}$/i.test(color || ''));
	}

	export_swatches() {
		const colors = this.current_colors();
		if (colors.length == 0) {
			alertify.warning(t('There are no swatches to export.'));
			return;
		}
		const blob = new Blob([build_gpl('Lumifex', colors)], {type: 'text/plain'});
		save_blob(blob, 'Lumifex-swatches.gpl', false);
	}

	import_swatches() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.gpl,text/plain';
		input.addEventListener('change', () => {
			const file = input.files && input.files[0];
			if (!file || file.size > 1024 * 1024) {
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				const colors = parse_gpl(String(reader.result));
				if (!colors) {
					alertify.error(t('This is not a valid .gpl palette.'));
					return;
				}
				const swatches = app.GUI.GUI_colors.inputs.swatches;
				swatches.uiSwatches('set_all_hex', colors.slice(0, 21));
				config.swatches.default = swatches.uiSwatches('get_all_hex');
				alertify.success(t('Swatches loaded.'));
			};
			reader.readAsText(file);
		});
		input.click();
	}
}

export default Tools_swatches_class;
