import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './base-tools.js';
import Base_selection_class, { schedule_ants_redraw } from './base-selection.js';
import { draw_mask_ants, ant_phase } from './../libs/marching-ants.js';
import Selection_mask_class from './selection-mask-state.js';
import Selection_class from './../tools/selection.js';
import Edit_selection_class from './../modules/edit/selection.js';
import { feather_mask, combine_masks } from './../libs/selection-mask.js';

/**
 * Common part of tools that create a selection mask (lasso, magic wand).
 *
 * The tool shares the selection rectangle (= bounds of the mask) and the mask state with the selection tool.
 * Tool attribute `feather` (optional) softens the new mask. Shift adds to the current selection,
 * Alt subtracts from it, Shift+Alt intersects.
 */
class Base_mask_tool_class extends Base_tools_class {

	constructor(ctx, name) {
		super();
		this.ctx = ctx;
		this.name = name;
		this.Selection = new Selection_class(ctx);
		this.Selection_mask = new Selection_mask_class();
		this.Edit_selection = null; //created lazily, it needs all tools to be registered

		this.sel_config = {
			ants: true,
			enable_background: true,
			enable_borders: true,
			enable_controls: false,
			enable_rotation: false,
			enable_move: false,
			data_function: () => this.Selection.selection,
		};
		this.Base_selection = new Base_selection_class(ctx, this.sel_config, this.name);
	}

	/**
	 * Draws the tint of a custom mask; plain rectangles use the selection fill.
	 */
	render_mask_overlay(ctx) {
		var current = this.Selection_mask.get();
		var preview = this.Selection_mask.get_preview();
		var custom = preview != null || (current != null && current.kind == 'custom');
		if (this.sel_config.enable_background === custom) {
			this.sel_config.enable_background = !custom;
			setTimeout(() => {
				config.need_render = true;
			}, 0);
		}
		if (preview) {
			ctx.drawImage(preview.overlay, 0, 0);
		}
		else if (custom) {
			//marching ants along the edge of the mask
			draw_mask_ants(ctx, current.mask, ant_phase());
			schedule_ants_redraw();
		}
	}

	/**
	 * Makes the mask the selection - softened and combined with the current selection according to modifier keys.
	 *
	 * @param {object} mask
	 * @param {{shiftKey: boolean, altKey: boolean}} e
	 */
	async commit_mask(mask, e) {
		var feather = parseInt(this.getParams().feather) || 0;
		if (feather > 0) {
			mask = feather_mask(mask, feather);
		}

		var current = this.Selection_mask.get();
		if (current != null && (e.shiftKey || e.altKey)) {
			var mode = e.shiftKey && e.altKey ? 'intersect' : (e.shiftKey ? 'add' : 'subtract');
			mask = combine_masks(current.mask, mask, mode);
		}

		if (this.Edit_selection == null) {
			this.Edit_selection = new Edit_selection_class();
		}
		await this.Edit_selection.set_mask(mask, false);
	}

	render(ctx, layer) {
		//nothing
	}

	on_leave() {
		if (!app.Layers || !app.Layers.Base_selection) {
			return [];
		}
		return this.Selection.on_leave();
	}
}

export default Base_mask_tool_class;
