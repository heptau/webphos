/**
 * Pixel grid (View > Pixel Grid): thin lines between the pixels, shown only when the image is zoomed in enough.
 */

//the grid appears from this zoom (6 = 600 %), as in Photoshop
export const PIXEL_GRID_MIN_ZOOM = 6;

/**
 * @param {number} zoom 1 = 100 %
 * @returns {boolean}
 */
export function is_pixel_grid_visible(zoom) {
	return zoom >= PIXEL_GRID_MIN_ZOOM;
}

/**
 * Positions of the pixel borders that fall into the visible part of the image.
 *
 * @param {number} from start of the visible part (image pixels, may be outside of the image)
 * @param {number} to end of the visible part
 * @param {number} size size of the image in this direction
 * @returns {number[]} integer positions 1..size-1
 */
export function pixel_grid_positions(from, to, size) {
	var start = Math.max(1, Math.floor(from));
	var end = Math.min(size - 1, Math.ceil(to));
	var result = [];
	for (var i = start; i <= end; i++) {
		result.push(i);
	}
	return result;
}
