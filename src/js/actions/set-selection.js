import app from '../app.js';
import config from '../config.js';
import Selection_mask_class from '../core/selection-mask-state.js';
import { Base_action } from './base.js';

export class Set_selection_action extends Base_action {
	/**
	 * Sets the selection to the specified position and dimensions
	 */
	constructor(x, y, width, height, old_settings_override) {
		super('set_selection', 'Set Selection');
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.settings_reference = null;
		this.old_settings_data = null;
		this.old_settings_override = old_settings_override ? JSON.parse(JSON.stringify(old_settings_override)) || null : null;
		this.old_custom_mask = null;
	}

	async do() {
		super.do();
		//the selection rectangle belongs to the selection tool, whichever tool is active (the Move tool can drag a selection;
		//its own settings are the layer)
		this.settings_reference = app.Layers.Base_selection.find_settings('selection');
		this.old_settings_data = JSON.parse(JSON.stringify(this.settings_reference.data));
		if (this.x != null)
			this.settings_reference.data.x = this.x;
		if (this.y != null)
			this.settings_reference.data.y = this.y;
		if (this.width != null)
			this.settings_reference.data.width = this.width;
		if (this.height != null)
			this.settings_reference.data.height = this.height;

		//a custom (soft, inverted...) mask belongs to the old rectangle - it is brought back by undo
		var mask_state = new Selection_mask_class();
		this.old_custom_mask = mask_state.get_custom_state();
		mask_state.set_custom_state(null);
		this.memory_estimate = this.old_custom_mask ? this.old_custom_mask.mask.data.length : 0;

		config.need_render = true;
	}

	async undo() {
		super.undo()
		if (this.old_settings_override) {
			for (let prop in this.old_settings_override) {
				this.settings_reference.data[prop] = this.old_settings_override[prop];   
			}
		} else {
			for (let prop in this.old_settings_data) {
				this.settings_reference.data[prop] = this.old_settings_data[prop];   
			}
		}
		new Selection_mask_class().set_custom_state(this.old_custom_mask);
		this.old_custom_mask = null;
		this.settings_reference = null;
		this.old_settings_data = null;
		config.need_render = true;
	}

	free() {
		this.old_custom_mask = null;
		this.settings_reference = null;
		this.old_settings_override = null;
		this.old_settings_data = null;
	}
}