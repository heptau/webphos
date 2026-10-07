/**
 * Rotate View / Flip View: only the way the picture is shown is turned or mirrored (with CSS), the document does not
 * change. The mouse has to be mapped back, so the tools still work on the right place. Pure functions, no DOM.
 *
 * @typedef {{rotate: number, flip: boolean}} View
 */

/**
 * @param {object|null} view
 * @returns {View} the angle in degrees between -180 and 180 (clockwise), flip = mirrored left to right
 */
export function normalize_view(view) {
	var angle = parseFloat(view && view.rotate) || 0;
	angle = ((angle % 360) + 360) % 360;
	if (angle > 180) {
		angle -= 360;
	}
	return {rotate: Math.round(angle * 100) / 100 || 0, flip: Boolean(view && view.flip)};
}

/**
 * @param {View} view
 * @returns {boolean} the view is turned or mirrored
 */
export function is_transformed(view) {
	var v = normalize_view(view);
	return v.rotate != 0 || v.flip;
}

/**
 * @param {View} view
 * @returns {string} value of the CSS property transform ('' when nothing is changed)
 */
export function css_transform(view) {
	var v = normalize_view(view);
	if (!is_transformed(v)) {
		return '';
	}
	//the picture is mirrored first, then turned
	return 'rotate(' + v.rotate + 'deg)' + (v.flip ? ' scaleX(-1)' : '');
}

/**
 * Where a point of the screen is on the picture (as if the view was not changed)
 *
 * @param {{x: number, y: number}} point point on the screen (client coordinates)
 * @param {{x: number, y: number}} center the middle of the shown picture on the screen
 * @param {{width: number, height: number}} size size of the picture as it is without the change
 * @param {View} view
 * @returns {{x: number, y: number}} position from the top left corner of the picture
 */
export function screen_to_picture(point, center, size, view) {
	var v = normalize_view(view);
	var radians = v.rotate * Math.PI / 180;
	var dx = point.x - center.x;
	var dy = point.y - center.y;
	//undo the rotation, then the mirroring
	var x = dx * Math.cos(radians) + dy * Math.sin(radians);
	var y = -dx * Math.sin(radians) + dy * Math.cos(radians);
	if (v.flip) {
		x = -x;
	}
	return {x: x + size.width / 2, y: y + size.height / 2};
}

/**
 * A movement on the screen as a movement of the picture (for panning)
 *
 * @param {number} dx
 * @param {number} dy
 * @param {View} view
 * @returns {{x: number, y: number}}
 */
export function screen_delta_to_picture(dx, dy, view) {
	var v = normalize_view(view);
	var radians = v.rotate * Math.PI / 180;
	var x = dx * Math.cos(radians) + dy * Math.sin(radians);
	var y = -dx * Math.sin(radians) + dy * Math.cos(radians);
	return {x: v.flip ? -x : x, y: y};
}
