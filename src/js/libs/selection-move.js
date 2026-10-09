/**
 * Moving and resizing a selection (and the pixels in it). Pure functions, no DOM.
 *
 * @typedef {{width: number, height: number, data: Uint8ClampedArray}} Mask
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 */
import { transform_mask, mask_bounds, keep_with_mask, erase_with_mask } from './selection-mask.js';

/**
 * @param {{kind: string, mask: Mask, rect: Rect}|null} current the selection (see Selection_mask_class.get)
 * @param {{x: number, y: number}} point in pixels of the picture
 * @returns {boolean} the point is in the selection (for a soft mask: where it is selected at all)
 */
export function point_in_selection(current, point) {
	if (current == null) {
		return false;
	}
	const x = Math.floor(point.x);
	const y = Math.floor(point.y);
	if (current.kind == 'custom') {
		const mask = current.mask;
		return x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.data[y * mask.width + x] > 0;
	}
	const rect = current.rect;
	return point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
}

/**
 * The rectangle of a selection that is moved: the part that stays in the picture
 *
 * @param {Rect} rect
 * @param {number} dx
 * @param {number} dy
 * @param {number} width width of the picture
 * @param {number} height height of the picture
 * @returns {Rect|null} null when nothing of it would be left
 */
export function moved_rect(rect, dx, dy, width, height) {
	const left = Math.max(0, Math.round(rect.x + dx));
	const top = Math.max(0, Math.round(rect.y + dy));
	const right = Math.min(width, Math.round(rect.x + dx + rect.width));
	const bottom = Math.min(height, Math.round(rect.y + dy + rect.height));
	if (right <= left || bottom <= top) {
		return null;
	}
	return {x: left, y: top, width: right - left, height: bottom - top};
}

/**
 * A soft or odd shaped selection after its rectangle was resized: the mask is stretched with it
 *
 * @param {Mask} mask
 * @param {Rect} new_rect where the bounds of the mask should be
 * @returns {Mask} a new mask (the same one when it is empty or the rectangle is empty)
 */
export function fit_mask_to_rect(mask, new_rect) {
	const bounds = mask_bounds(mask);
	if (bounds == null || !(new_rect.width > 0) || !(new_rect.height > 0)) {
		return mask;
	}
	return transform_mask(mask, {
		scale_x: new_rect.width / bounds.width * 100,
		scale_y: new_rect.height / bounds.height * 100,
		rotate: 0,
		dx: (new_rect.x + new_rect.width / 2) - (bounds.x + bounds.width / 2),
		dy: (new_rect.y + new_rect.height / 2) - (bounds.y + bounds.height / 2),
	});
}

/**
 * The two parts of a layer when the selected pixels are lifted: the selected pixels alone (soft edges stay soft), and
 * the layer with a hole where they were.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image straight pixels of the layer
 * @param {Mask} mask selection mask of the picture
 * @param {{x: number, y: number, width: number, height: number}} layer place of the layer in the picture
 * @returns {{selected: {data: Uint8ClampedArray, width: number, height: number}, hole: {data: Uint8ClampedArray, width: number, height: number}}}
 */
export function lift_pixels(image, mask, layer) {
	const copy = function () {
		return {data: new Uint8ClampedArray(image.data), width: image.width, height: image.height};
	};
	return {selected: keep_with_mask(copy(), mask, layer), hole: erase_with_mask(copy(), mask, layer)};
}

/**
 * Puts the lifted pixels on a layer, shifted. Pixels that fall out of the layer are lost; the layer below shows through
 * where the pixels are not fully opaque (source-over of straight alpha).
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} base the layer (with the hole, or untouched for a copy)
 * @param {{data: Uint8ClampedArray, width: number, height: number}} selected same size as base
 * @param {number} dx
 * @param {number} dy
 * @returns {{data: Uint8ClampedArray, width: number, height: number}} base, changed in place
 */
export function put_shifted(base, selected, dx, dy) {
	const w = base.width;
	const h = base.height;
	dx = Math.round(dx) || 0;
	dy = Math.round(dy) || 0;
	for (let y = 0; y < h; y++) {
		const ty = y + dy;
		if (ty < 0 || ty >= h) {
			continue;
		}
		for (let x = 0; x < w; x++) {
			const tx = x + dx;
			if (tx < 0 || tx >= w) {
				continue;
			}
			const s = (y * w + x) * 4;
			const sa = selected.data[s + 3];
			if (sa == 0) {
				continue;
			}
			const t = (ty * w + tx) * 4;
			const ta = base.data[t + 3];
			const a = sa + ta * (255 - sa) / 255;
			for (let c = 0; c < 3; c++) {
				base.data[t + c] = a > 0 ? (selected.data[s + c] * sa + base.data[t + c] * ta * (255 - sa) / 255) / a : 0;
			}
			base.data[t + 3] = a;
		}
	}
	return base;
}
