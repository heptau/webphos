import config from './../config.js';
import Helper_class from './../libs/helpers.js';
import Base_mask_tool_class from './../core/base-mask-tool.js';
import Edit_selection_class from './../modules/edit/selection.js';
import { magic_wand_mask } from './../libs/selection-mask.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * Magic wand - click selects pixels of the active layer similar to the clicked one.
 * Shift adds to the current selection, Alt subtracts from it, Shift+Alt intersects.
 * The result is stored as a selection mask, see core/selection-mask-state.js.
 */
class Magic_wand_class extends Base_mask_tool_class {

	constructor(ctx) {
		super(ctx, 'magic_wand');
		this.working = false;
		this.Helper = new Helper_class();
	}

	load() {
		document.addEventListener('mousedown', (event) => {
			if (config.TOOL.name == this.name) {
				this.mousedown(event);
			}
		});
		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name == this.name && event.keyCode == 46 && !this.Helper.is_input(event.target)) {
				this.Selection.delete_selection();
			}
		}, false);
	}

	async mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || mouse.valid == false || this.working) {
			return;
		}
		const layer = config.layer;
		if (layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		if (layer.rotate) {
			alertify.error(t('Rotate is not supported on this type of object. Convert to raster?'));
			return;
		}

		const params = this.getParams();
		this.working = true;
		try {
			const Edit_selection = this.Edit_selection || (this.Edit_selection = new Edit_selection_class());
			const image = Edit_selection.layer_on_canvas(layer);
			const mask = magic_wand_mask(image, mouse.x, mouse.y, params.tolerance, Boolean(params.contiguous));
			await this.commit_mask(mask, e);
		}
		finally {
			this.working = false;
		}
	}

	render_overlay(ctx) {
		this.render_mask_overlay(ctx);
	}
}

export default Magic_wand_class;
