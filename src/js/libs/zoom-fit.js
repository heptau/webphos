/**
 * Zoom that fits the picture in the free space: the next smaller whole percent, never bigger (a picture that is a few
 * pixels too big gets scrollbars or is cut). The border of the canvas takes a pixel on every side, so that is left free.
 */

export const FIT_MARGIN = 2;

/**
 * @param {number} space_width free width in pixels
 * @param {number} space_height free height in pixels
 * @param {number} width width of the picture
 * @param {number} height height of the picture
 * @returns {number} zoom in percent, a whole number from 1 up
 */
export function fit_zoom_percent(space_width, space_height, width, height) {
	if (!(width > 0) || !(height > 0)) {
		return 100;
	}
	var best = Math.min(Math.max(0, space_width - FIT_MARGIN) / width, Math.max(0, space_height - FIT_MARGIN) / height);
	//a tiny amount is added so that 0.29 * 100 = 28.999999999999996 does not cost a whole percent
	return Math.max(1, Math.floor(best * 100 + 1e-6));
}
