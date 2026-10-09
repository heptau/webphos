/**
 * Brush dynamics: every stamp of a stroke can be a bit different - moved aside (scatter), smaller, turned or fainter.
 * The "randomness" is computed from the position of the stamp in the stroke, not from a random generator, so the layer
 * looks the same every time it is drawn. Pure functions, no DOM.
 *
 * @typedef {{x: number, y: number, size: number}} Stamp
 * @typedef {{x: number, y: number, size: number, angle: number, alpha: number}} Dynamic_stamp
 */

/**
 * @param {object} params brush settings (the numbers may come as strings or {value})
 * @returns {{scatter: number, size_jitter: number, angle_jitter: number, opacity_jitter: number, follow: boolean}}
 */
export function dynamics_settings(params) {
	const number = function (value, max) {
		if (value && value.value !== undefined) {
			value = value.value;
		}
		return Math.min(max, Math.max(0, parseFloat(value) || 0));
	};
	let follow = params.follow_direction;
	if (follow && follow.value !== undefined) {
		follow = follow.value;
	}
	return {
		scatter: number(params.scatter, 300),
		size_jitter: number(params.size_jitter, 100),
		angle_jitter: number(params.angle_jitter, 100),
		opacity_jitter: number(params.opacity_jitter, 100),
		follow: follow === true,
	};
}

/**
 * @param {object} params
 * @returns {boolean} any of the dynamics is on
 */
export function has_dynamics(params) {
	const d = dynamics_settings(params);
	return d.scatter > 0 || d.size_jitter > 0 || d.angle_jitter > 0 || d.opacity_jitter > 0 || d.follow;
}

/**
 * Number between 0 and 1 that depends only on the two numbers (the same input always gives the same output).
 *
 * @param {number} a for example the number of the stroke
 * @param {number} b for example the number of the stamp
 * @param {number} channel which of the values of one stamp
 * @returns {number}
 */
export function noise(a, b, channel) {
	let h = Math.imul(a + 1, 0x9E3779B1) ^ Math.imul(b + 1, 0x85EBCA77) ^ Math.imul(channel + 1, 0xC2B2AE3D);
	h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
	h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

/**
 * @param {Stamp[]} stamps stamps of one stroke
 * @param {object} params brush settings
 * @param {number} stroke number of the stroke in the layer (changes the "random" values)
 * @returns {Dynamic_stamp[]}
 */
export function apply_dynamics(stamps, params, stroke) {
	const d = dynamics_settings(params);
	return stamps.map((stamp, i) => {
		const size = stamp.size * (1 - d.size_jitter / 100 * noise(stroke, i, 1));
		const spread = d.scatter / 100 * stamp.size;
		const x = stamp.x + (noise(stroke, i, 2) * 2 - 1) * spread;
		const y = stamp.y + (noise(stroke, i, 3) * 2 - 1) * spread;
		let angle = (noise(stroke, i, 4) * 2 - 1) * d.angle_jitter / 100 * Math.PI || 0; //(no -0)
		if (d.follow) {
			const before = stamps[Math.max(0, i - 1)];
			const after = stamps[Math.min(stamps.length - 1, i + 1)];
			angle += Math.atan2(after.y - before.y, after.x - before.x);
		}
		return {
			x,
			y,
			size: Math.max(0.5, size),
			angle,
			alpha: 1 - d.opacity_jitter / 100 * noise(stroke, i, 5),
		};
	});
}
