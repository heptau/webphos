/**
 * Retouching algorithms working on ImageData-like objects {data, width, height} (RGBA).
 * Pure functions - no DOM, covered by tests.
 */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, x) {
	const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

/**
 * mean color of pixels on a ring (annulus) around the center, transparent pixels are ignored
 *
 * @returns {number[]|null} [r, g, b, count] or null when there was nothing to sample
 */
function ring_mean(img, cx, cy, inner, outer, step) {
	const sum = [0, 0, 0];
	let count = 0;
	for (let y = Math.floor(cy - outer); y <= cy + outer; y += step) {
		for (let x = Math.floor(cx - outer); x <= cx + outer; x += step) {
			const d = Math.hypot(x - cx, y - cy);
			if (d < inner || d > outer || x < 0 || y < 0 || x >= img.width || y >= img.height) {
				continue;
			}
			const i = (y * img.width + x) * 4;
			if (img.data[i + 3] == 0) {
				continue;
			}
			sum[0] += img.data[i];
			sum[1] += img.data[i + 1];
			sum[2] += img.data[i + 2];
			count++;
		}
	}
	return count == 0 ? null : [sum[0] / count, sum[1] / count, sum[2] / count, count];
}

/**
 * Difference of the surroundings of two places (sum of squared differences of ring samples).
 */
function ring_difference(img, ax, ay, bx, by, inner, outer, points) {
	let total = 0;
	let counted = 0;
	for (let k = 0; k < points; k++) {
		const angle = (k / points) * Math.PI * 2;
		const radius = inner + (outer - inner) * ((k * 7) % 3) / 2;
		const xa = Math.round(ax + Math.cos(angle) * radius);
		const ya = Math.round(ay + Math.sin(angle) * radius);
		const xb = Math.round(bx + Math.cos(angle) * radius);
		const yb = Math.round(by + Math.sin(angle) * radius);
		if (xa < 0 || ya < 0 || xa >= img.width || ya >= img.height || xb < 0 || yb < 0 || xb >= img.width || yb >= img.height) {
			continue;
		}
		const ia = (ya * img.width + xa) * 4;
		const ib = (yb * img.width + xb) * 4;
		for (let c = 0; c < 3; c++) {
			const diff = img.data[ia + c] - img.data[ib + c];
			total += diff * diff;
		}
		counted++;
	}
	return counted < points / 2 ? Infinity : total / counted;
}

/**
 * Spot healing: the disk is replaced by the texture of the most similar neighbouring place,
 * its colors are shifted to the colors around the spot and the edge is feathered.
 *
 * @param {object} img image, modified in place
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} radius radius of the spot
 * @param {boolean} [match_color] adapt the colors of the texture to the surroundings, default true (false = texture only)
 * @returns {boolean} true when the image was changed
 */
export function heal_spot(img, cx, cy, radius, match_color) {
	radius = Math.max(2, radius);
	const inner = radius * 1.05;
	const outer = radius * 1.5;

	//find the source - candidates on several rings around the spot
	let best = null;
	let best_value = Infinity;
	for (let distance = radius * 2.4; distance <= radius * 5; distance += radius * 0.8) {
		const candidates = 16;
		for (let k = 0; k < candidates; k++) {
			const angle = (k / candidates) * Math.PI * 2 + distance;
			const sx = cx + Math.cos(angle) * distance;
			const sy = cy + Math.sin(angle) * distance;
			if (sx - outer < 0 || sy - outer < 0 || sx + outer >= img.width || sy + outer >= img.height) {
				continue;
			}
			const value = ring_difference(img, cx, cy, sx, sy, inner, outer, 40);
			if (value < best_value) {
				best_value = value;
				best = {x: sx, y: sy};
			}
		}
	}
	if (best == null) {
		return false;
	}

	return heal_with_source(img, cx, cy, radius, best, match_color);
}

/**
 * Healing brush with a chosen source: the disk is replaced by the texture of the place (source_x, source_y),
 * its colors are shifted to the colors around the spot and the edge is feathered.
 *
 * @param {object} img image, modified in place
 * @param {number} cx center x of the spot
 * @param {number} cy center y of the spot
 * @param {number} radius radius of the spot
 * @param {number} source_x center x of the place to copy from
 * @param {number} source_y center y of the place to copy from
 * @param {boolean} [match_color] adapt the colors of the texture to the surroundings, default true
 * @returns {boolean} true when the image was changed
 */
export function heal_from(img, cx, cy, radius, source_x, source_y, match_color) {
	return heal_with_source(img, cx, cy, Math.max(2, radius), {x: source_x, y: source_y}, match_color);
}

function heal_with_source(img, cx, cy, radius, best, match_color) {
	const inner = radius * 1.05;
	const outer = radius * 1.5;
	const target_mean = ring_mean(img, cx, cy, inner, outer, 2);
	const source_mean = ring_mean(img, best.x, best.y, inner, outer, 2);
	let shift = [0, 0, 0];
	if (match_color !== false && target_mean && source_mean) {
		shift = [target_mean[0] - source_mean[0], target_mean[1] - source_mean[1], target_mean[2] - source_mean[2]];
	}

	//copy from a snapshot, the source must not change while it is read
	const snapshot = new Uint8ClampedArray(img.data);
	let changed = false;
	for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
		for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
			const d = Math.hypot(x - cx, y - cy);
			if (d > radius || x < 0 || y < 0 || x >= img.width || y >= img.height) {
				continue;
			}
			const weight = 1 - smoothstep(radius * 0.55, radius, d);
			const sxp = Math.round(x + (best.x - cx));
			const syp = Math.round(y + (best.y - cy));
			if (sxp < 0 || syp < 0 || sxp >= img.width || syp >= img.height) {
				continue;
			}
			const from = (syp * img.width + sxp) * 4;
			const to = (y * img.width + x) * 4;
			for (let c = 0; c < 3; c++) {
				const value2 = clamp(snapshot[from + c] + shift[c], 0, 255);
				img.data[to + c] = Math.round(snapshot[to + c] * (1 - weight) + value2 * weight);
			}
			img.data[to + 3] = Math.round(snapshot[to + 3] * (1 - weight) + snapshot[from + 3] * weight);
			changed = true;
		}
	}
	return changed;
}

/**
 * Red eye removal: red pixels in the disk lose their redness (red channel is lowered to the mean of green and blue).
 *
 * @param {object} img image, modified in place
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} radius
 * @param {number} [strength] 0 - 100, default 100
 * @returns {number} number of changed pixels
 */
export function remove_red_eye(img, cx, cy, radius, strength) {
	strength = clamp(strength == undefined ? 100 : strength, 0, 100) / 100;
	let changed = 0;
	for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
		for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
			const d = Math.hypot(x - cx, y - cy);
			if (d > radius || x < 0 || y < 0 || x >= img.width || y >= img.height) {
				continue;
			}
			const i = (y * img.width + x) * 4;
			const r = img.data[i];
			const g = img.data[i + 1];
			const b = img.data[i + 2];
			if (img.data[i + 3] == 0 || r < 60 || r < 1.6 * Math.max(g, b)) {
				continue;
			}
			const weight = (1 - smoothstep(radius * 0.7, radius, d)) * strength;
			let target = (g + b) / 2;
			//darker than the neighbours - an eye reflection is not red but pupil is dark
			target = target * 0.85;
			img.data[i] = Math.round(r * (1 - weight) + target * weight);
			changed++;
		}
	}
	return changed;
}

/**
 * Background eraser: makes pixels of the disk transparent when their color is close to the sampled color.
 *
 * @param {object} img image, modified in place
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} radius
 * @param {number[]} color [r, g, b] sampled color (under the center when the stroke started)
 * @param {number} tolerance 0 - 255 maximal color distance that is erased completely
 * @returns {number} number of changed pixels
 */
export function erase_similar(img, cx, cy, radius, color, tolerance) {
	let changed = 0;
	const soft = Math.max(1, tolerance * 0.4);
	for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
		for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
			const d = Math.hypot(x - cx, y - cy);
			if (d > radius || x < 0 || y < 0 || x >= img.width || y >= img.height) {
				continue;
			}
			const i = (y * img.width + x) * 4;
			if (img.data[i + 3] == 0) {
				continue;
			}
			const distance = Math.sqrt(
				Math.pow(img.data[i] - color[0], 2) + Math.pow(img.data[i + 1] - color[1], 2) + Math.pow(img.data[i + 2] - color[2], 2)
			) / Math.sqrt(3);
			if (distance > tolerance + soft) {
				continue;
			}
			const amount = 1 - smoothstep(tolerance, tolerance + soft, distance);
			const edge = 1 - smoothstep(radius * 0.8, radius, d);
			const next = Math.round(img.data[i + 3] * (1 - amount * edge));
			if (next != img.data[i + 3]) {
				img.data[i + 3] = next;
				changed++;
			}
		}
	}
	return changed;
}

function sample_bilinear(data, width, height, x, y, out) {
	x = clamp(x, 0, width - 1);
	y = clamp(y, 0, height - 1);
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = Math.min(width - 1, x0 + 1);
	const y1 = Math.min(height - 1, y0 + 1);
	const fx = x - x0;
	const fy = y - y0;
	for (let c = 0; c < 4; c++) {
		const top = data[(y0 * width + x0) * 4 + c] * (1 - fx) + data[(y0 * width + x1) * 4 + c] * fx;
		const bottom = data[(y1 * width + x0) * 4 + c] * (1 - fx) + data[(y1 * width + x1) * 4 + c] * fx;
		out[c] = top * (1 - fy) + bottom * fy;
	}
}

/**
 * Liquify "forward warp": pixels in the disk are pushed in the direction of the movement,
 * the effect is strongest in the middle and fades to the edge.
 *
 * @param {object} img image, modified in place
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} radius
 * @param {number} dx movement of the brush in x
 * @param {number} dy movement of the brush in y
 * @param {number} [strength] 0 - 100, default 50
 * @returns {boolean} true when something changed
 */
export function push_pixels(img, cx, cy, radius, dx, dy, strength) {
	strength = clamp(strength == undefined ? 50 : strength, 0, 100) / 100;
	if (dx == 0 && dy == 0) {
		return false;
	}
	const snapshot = new Uint8ClampedArray(img.data);
	const color = [0, 0, 0, 0];
	for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
		for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
			const d = Math.hypot(x - cx, y - cy);
			if (d >= radius || x < 0 || y < 0 || x >= img.width || y >= img.height) {
				continue;
			}
			const falloff = Math.pow(1 - d / radius, 2) * strength * 2;
			sample_bilinear(snapshot, img.width, img.height, x - dx * falloff, y - dy * falloff, color);
			const i = (y * img.width + x) * 4;
			img.data[i] = color[0];
			img.data[i + 1] = color[1];
			img.data[i + 2] = color[2];
			img.data[i + 3] = color[3];
		}
	}
	return true;
}
