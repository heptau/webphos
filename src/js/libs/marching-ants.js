/**
 * "Marching ants" - the animated dashed outline of a selection (like in Photoshop).
 * The outline of a mask is found once and cached, the animation only changes which pixels are light and dark.
 */

const cache = new WeakMap();

//above this number of outline pixels the outline is drawn without animation (it would be too slow)
export const MAX_ANIMATED_PIXELS = 60000;

/**
 * @param {{width: number, height: number, data: ArrayLike<number>}} mask 8 bit mask (255 = selected)
 * @param {number} [threshold] values from this up count as selected
 * @returns {Int32Array} packed pixel positions x + y * width of selected pixels that touch an unselected one
 */
export function mask_outline(mask, threshold) {
	threshold = threshold == undefined ? 128 : threshold;
	const key = mask.data;
	const cached = cache.get(key);
	if (cached && cached.threshold == threshold) {
		return cached.outline;
	}
	const w = mask.width;
	const h = mask.height;
	const data = mask.data;
	const positions = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const p = y * w + x;
			if (data[p] < threshold) {
				continue;
			}
			//the picture border is also an edge of the selection
			if (x == 0 || y == 0 || x == w - 1 || y == h - 1
				|| data[p - 1] < threshold || data[p + 1] < threshold || data[p - w] < threshold || data[p + w] < threshold) {
				positions.push(p);
			}
		}
	}
	const outline = Int32Array.from(positions);
	cache.set(key, {threshold, outline});
	return outline;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} phase animation step
 * @returns {boolean} true when the pixel is drawn light
 */
export function ant_is_light(x, y, phase) {
	return (((x + y + phase) >> 2) & 1) == 1;
}

/**
 * current animation step (changes about 12 times a second)
 */
export function ant_phase(now) {
	return Math.floor((now == undefined ? Date.now() : now) / 80) % 8;
}

/**
 * draws the outline of a mask
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width: number, height: number, data: ArrayLike<number>}} mask
 * @param {number} [phase]
 */
export function draw_mask_ants(ctx, mask, phase) {
	const outline = mask_outline(mask);
	if (outline.length == 0) {
		return;
	}
	if (outline.length > MAX_ANIMATED_PIXELS) {
		phase = 0;
	}
	const light = new Path2D();
	const dark = new Path2D();
	const w = mask.width;
	for (let i = 0; i < outline.length; i++) {
		const x = outline[i] % w;
		const y = (outline[i] - x) / w;
		(ant_is_light(x, y, phase || 0) ? light : dark).rect(x, y, 1, 1);
	}
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#000000';
	ctx.fill(dark);
	ctx.fillStyle = '#ffffff';
	ctx.fill(light);
	ctx.restore();
}

/**
 * draws the dashed outline of a rectangle
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} zoom
 * @param {number} [phase]
 */
export function draw_rect_ants(ctx, x, y, w, h, zoom, phase) {
	const unit = 1 / (zoom || 1);
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.lineWidth = unit;
	ctx.setLineDash([]);
	ctx.strokeStyle = '#ffffff';
	ctx.strokeRect(x, y, w, h);
	ctx.setLineDash([4 * unit, 4 * unit]);
	ctx.lineDashOffset = -(phase || 0) * unit;
	ctx.strokeStyle = '#000000';
	ctx.strokeRect(x, y, w, h);
	ctx.restore();
}
