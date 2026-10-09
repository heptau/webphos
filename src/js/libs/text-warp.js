/**
 * Warp Text (Photoshop): the picture of a text is bent into a shape. Works on an image that is bigger than the text,
 * so the bent text has room; `box` says where the text is in that image.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */
import { remap } from './distort.js';

export const WARP_STYLES = ['None', 'Arc', 'Bulge', 'Flag', 'Wave', 'Rise', 'Squeeze'];

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * @param {object} params warp_style and warp_bend of a text layer
 * @returns {{style: string, bend: number}} style 'None' when the text is not bent
 */
export function warp_settings(params) {
	params = params || {};
	const style = params.warp_style && params.warp_style.value !== undefined ? params.warp_style.value : params.warp_style;
	const bend = clamp(parseFloat(params.warp_bend) || 0, -100, 100);
	if (!WARP_STYLES.includes(style) || style == 'None' || bend == 0) {
		return {style: 'None', bend: 0};
	}
	return {style, bend};
}

/**
 * @param {Image_data} image
 * @param {{style: string, bend: number}} settings from warp_settings
 * @param {{x: number, y: number, width: number, height: number}} box the text inside the image
 * @returns {Image_data} the same image, bent
 */
export function warp_text(image, settings, box) {
	let angle, radius, up, amplitude, sway;
	const bend = settings.bend / 100;
	if (settings.style == 'None' || bend == 0 || box.width < 1 || box.height < 1) {
		return image;
	}
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	switch (settings.style) {
		case 'Arc':
			//the text lies on a part of a circle, bend 100 = half of the circle
			angle = Math.abs(bend) * Math.PI;
			radius = box.width / angle;
			up = bend > 0;
			return remap(image, (x, y, position) => {
				const py = up ? y : 2 * cy - y; //a negative bend is the same arc turned over
				const center_y = cy + radius;
				const dx = x - cx;
				const dy = py - center_y;
				const r = Math.sqrt(dx * dx + dy * dy);
				const phi = Math.atan2(dx, -dy);
				const source_y = cy + (radius - r);
				position[0] = cx + phi * radius;
				position[1] = up ? source_y : 2 * cy - source_y;
			});
		case 'Bulge':
			return remap(image, (x, y, position) => {
				const u = (x - box.x) / box.width * 2 - 1;
				//in the middle the text is taller (or smaller for a negative bend)
				const factor = Math.max(0.2, 1 + bend * (1 - u * u));
				position[1] = cy + (y - cy) / factor;
			});
		case 'Flag':
			amplitude = bend * box.height * 0.3;
			return remap(image, (x, y, position) => {
				position[1] = y - amplitude * Math.sin((x - box.x) / box.width * 2 * Math.PI);
			});
		case 'Wave':
			sway = bend * box.height * 0.3;
			return remap(image, (x, y, position) => {
				position[0] = x - sway * Math.sin((y - box.y) / box.height * 4 * Math.PI);
				position[1] = y - sway * 0.5 * Math.sin((x - box.x) / box.width * 4 * Math.PI);
			});
		case 'Rise':
			return remap(image, (x, y, position) => {
				const u = (x - box.x) / box.width - 0.5;
				const factor = Math.max(0.2, 1 + bend * u);
				position[1] = cy + (y - cy) / factor;
			});
		case 'Squeeze':
			return remap(image, (x, y, position) => {
				const v = (y - box.y) / box.height * 2 - 1;
				//in the middle the text is narrower (or wider for a negative bend)
				const factor = Math.max(0.2, 1 - bend * (1 - v * v));
				position[0] = cx + (x - cx) / factor;
			});
		default:
			return image;
	}
}
