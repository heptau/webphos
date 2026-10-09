/**
 * Rectangle of the marquee tool while dragging, with the Photoshop options: Fixed Ratio, Fixed Size,
 * Shift (square) and Alt (from the center). Pure function, no DOM.
 */

/**
 * @param {{x: number, y: number}} start where the mouse button went down
 * @param {{x: number, y: number}} point where the mouse is now
 * @param {object} [options] style ('Normal'|'Fixed Ratio'|'Fixed Size'), fixed_width, fixed_height
 *   (the ratio terms or the size in pixels), shift (square in the Normal style), alt (the start is the center)
 * @returns {{x: number, y: number, width: number, height: number}} rectangle with a positive size
 */
export function marquee_rect(start, point, options) {
	options = options || {};
	const style = options.style || 'Normal';
	const fixed_w = Math.max(1, parseFloat(options.fixed_width) || 1);
	const fixed_h = Math.max(1, parseFloat(options.fixed_height) || 1);
	const from_center = options.alt === true;

	const dx = point.x - start.x;
	const dy = point.y - start.y;
	let sign_x = dx < 0 ? -1 : 1;
	let sign_y = dy < 0 ? -1 : 1;
	let width = Math.abs(dx);
	let height = Math.abs(dy);

	if (style == 'Fixed Size') {
		width = Math.round(fixed_w);
		height = Math.round(fixed_h);
		//the size does not depend on the mouse, the rectangle grows from the start to the right and down
		sign_x = 1;
		sign_y = 1;
	}
	else if (style == 'Fixed Ratio') {
		const ratio = fixed_w / fixed_h;
		//the larger rectangle that keeps the ratio and contains the dragged one
		width = Math.max(width, height * ratio);
		height = width / ratio;
	}
	else if (options.shift === true) {
		width = height = Math.max(width, height);
	}

	if (from_center) {
		return {x: start.x - width, y: start.y - height, width: width * 2, height: height * 2};
	}
	return {
		x: sign_x < 0 ? start.x - width : start.x,
		y: sign_y < 0 ? start.y - height : start.y,
		width,
		height,
	};
}
