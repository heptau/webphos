import config from './../config.js';
import { rect_mask } from './../libs/selection-mask.js';
import { save_selection, delete_selection, load_all_selections } from './../libs/selection-store.js';

let instance = null;

/**
 * Holds the current selection mask.
 *
 * The selection tool still owns the selection rectangle. A "custom" mask (feathered, inverted, elliptical, color range...)
 * belongs to one rectangle (`key`); as soon as the rectangle changes (new selection, undo, move) the custom mask is not valid
 * anymore and the selection is treated as a plain rectangle again. A plain rectangle is also served as a mask, so consumers
 * only have to deal with one concept.
 */
class Selection_mask_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.get_selection = null; //function returning the selection rectangle, registered by the selection tool
		this.custom = null; //{mask, key, overlay}
		this.rect_cache = null; //{id, mask}
		this.preview = null; //{mask, overlay, is_active} - mask shown while a dialog is open
		this.saved = new Map(); //named selections (Select > Save Selection), also persisted in IndexedDB
		this.restored = null; //promise of loading the persisted selections
	}

	/**
	 * Stores a copy of the mask under a name (an existing name is overwritten)
	 *
	 * @param {string} name
	 * @param {object} mask
	 * @returns {boolean} true when an existing selection was overwritten
	 */
	save(name, mask) {
		const overwritten = this.saved.has(name);
		const copy = {width: mask.width, height: mask.height, data: new Uint8ClampedArray(mask.data)};
		this.saved.set(name, copy);
		save_selection(name, copy); //persistent, failures are only logged
		return overwritten;
	}

	/**
	 * Loads selections persisted in previous sessions (once). Selections saved in this session win over stored ones.
	 *
	 * @returns {Promise<void>}
	 */
	restore_saved() {
		if (!this.restored) {
			this.restored = load_all_selections().then((list) => {
				list.forEach((item) => {
					if (!this.saved.has(item.name)) {
						this.saved.set(item.name, item.mask);
					}
				});
			});
		}
		return this.restored;
	}

	/**
	 * @param {string} name
	 * @returns {{width: number, height: number, data: Uint8ClampedArray}|null} copy of the saved mask
	 */
	load(name) {
		const mask = this.saved.get(name);
		return mask ? {width: mask.width, height: mask.height, data: new Uint8ClampedArray(mask.data)} : null;
	}

	remove(name) {
		const removed = this.saved.delete(name);
		delete_selection(name);
		return removed;
	}

	/**
	 * @returns {string[]} names of saved selections in the order they were first saved
	 */
	saved_names() {
		return Array.from(this.saved.keys());
	}

	bind(get_selection) {
		this.get_selection = get_selection;
	}

	rect_key(rect) {
		return [rect.x, rect.y, rect.width, rect.height].join(',');
	}

	/**
	 * @returns {{mask: object, kind: 'rect'|'custom', rect: object}|null} null when nothing is selected
	 */
	get() {
		const selection = this.get_selection ? this.get_selection() : null;
		if (!selection || !selection.width || !selection.height) {
			return null;
		}
		const key = this.rect_key(selection);
		const custom = this.custom;
		if (custom && custom.key === key && custom.mask.width == config.WIDTH && custom.mask.height == config.HEIGHT) {
			return {mask: custom.mask, kind: 'custom', rect: selection};
		}

		const id = `${key  },${config.WIDTH},${  config.HEIGHT}`;
		if (!this.rect_cache || this.rect_cache.id !== id) {
			this.rect_cache = {id, mask: rect_mask(selection, config.WIDTH, config.HEIGHT)};
		}
		return {mask: this.rect_cache.mask, kind: 'rect', rect: selection};
	}

	/**
	 * Registers a custom mask for the given selection rectangle
	 *
	 * @param {object} mask
	 * @param {{x: number, y: number, width: number, height: number}} rect
	 */
	set_custom(mask, rect) {
		this.custom = {mask, key: this.rect_key(rect), overlay: null};
	}

	/**
	 * Shows a mask on the canvas instead of the selection until the dialog that asked for it closes.
	 *
	 * @param {object} mask
	 * @param {function(): boolean} is_active tells whether the dialog is still open
	 */
	set_preview(mask, is_active) {
		this.preview = {mask, overlay: this.build_overlay(mask, [255, 160, 0]), is_active};
	}

	clear_preview() {
		this.preview = null;
	}

	/**
	 * @returns {{mask: object, overlay: HTMLCanvasElement}|null} null when no preview is active
	 */
	get_preview() {
		if (this.preview && !this.preview.is_active()) {
			this.preview = null;
		}
		return this.preview;
	}

	/**
	 * Raw access used by undoable actions (see actions/set-selection-mask.js)
	 *
	 * @returns {{mask: any, key: string, overlay: any}|null}
	 */
	get_custom_state() {
		return this.custom;
	}

	set_custom_state(custom) {
		this.custom = custom;
	}

	/**
	 * Forgets the custom mask. Not undoable - inside user operations use actions
	 * (Set_selection_action and Reset_selection_action clear the mask and restore it on undo).
	 */
	reset() {
		this.custom = null;
		this.rect_cache = null;
	}

	/**
	 * Semi-transparent canvas showing the mask, cached for the current custom mask
	 *
	 * @param {object} mask
	 * @returns {HTMLCanvasElement|null}
	 */
	get_overlay(mask) {
		if (!this.custom || this.custom.mask !== mask) {
			return null;
		}
		if (this.custom.overlay == null) {
			this.custom.overlay = this.build_overlay(mask, [0, 255, 0]);
		}
		return this.custom.overlay;
	}

	/**
	 * @param {object} mask
	 * @param {number[]} color [r, g, b] of the tint
	 * @returns {HTMLCanvasElement}
	 */
	build_overlay(mask, color) {
		const canvas = document.createElement('canvas');
		canvas.width = mask.width;
		canvas.height = mask.height;
		const ctx = canvas.getContext('2d');
		const image = ctx.createImageData(mask.width, mask.height);
		for (let p = 0, i = 0; p < mask.data.length; p++, i += 4) {
			image.data[i] = color[0];
			image.data[i + 1] = color[1];
			image.data[i + 2] = color[2];
			image.data[i + 3] = Math.round(mask.data[p] * 0.35);
		}
		ctx.putImageData(image, 0, 0);
		return canvas;
	}
}

export default Selection_mask_class;
