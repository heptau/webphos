import config from '../config.js';
import Selection_mask_class from '../core/selection-mask-state.js';
import { Base_action } from './base.js';

export class Set_selection_mask_action extends Base_action {
	/**
	 * Sets (or clears) the custom selection mask. The mask belongs to the given selection rectangle, which should be
	 * the current one - to change both, put Set_selection_action before this action in a Bundle_action.
	 * Undo restores the previous mask, so mask changes are fully undoable.
	 *
	 * @param {object|null} mask null clears the custom mask
	 * @param {{x: number, y: number, width: number, height: number}|null} rect
	 */
	constructor(mask, rect) {
		super('set_selection_mask', 'Set Selection Mask');
		this.mask = mask;
		this.rect = rect ? {x: rect.x, y: rect.y, width: rect.width, height: rect.height} : null;
		this.state = new Selection_mask_class();
		this.previous = null;
		this.memory_estimate = mask ? mask.data.length : 0;
	}

	async do() {
		super.do();
		this.previous = this.state.get_custom_state();
		if (this.mask && this.rect) {
			this.state.set_custom(this.mask, this.rect);
		}
		else {
			this.state.set_custom_state(null);
		}
		config.need_render = true;
	}

	async undo() {
		super.undo();
		this.state.set_custom_state(this.previous);
		this.previous = null;
		config.need_render = true;
	}

	free() {
		this.mask = null;
		this.previous = null;
	}
}
