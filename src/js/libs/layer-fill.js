/**
 * Fill opacity of a layer (Photoshop): fades only the pixels of the layer itself, the layer styles
 * (stroke, overlays, inner shadow) stay fully visible. Stored as `layer.fill_opacity` (0-100, missing = 100).
 *
 * @param {{fill_opacity?: number}|null} layer
 * @returns {number} multiplier 0-1
 */
export function fill_alpha(layer) {
	if (!layer || layer.fill_opacity === undefined || layer.fill_opacity === null) {
		return 1;
	}
	const value = parseFloat(layer.fill_opacity);
	if (isNaN(value)) {
		return 1;
	}
	return Math.min(100, Math.max(0, value)) / 100;
}

const HALO_FILTERS = ['shadow', 'drop-shadow', 'glow'];

/**
 * Shadow and glow are drawn by a CSS filter around the pixels, so fading the pixels would fade them too.
 * Photoshop keeps them at full strength, so they are rendered on their own.
 *
 * @param {{name?: string}[]|null|undefined} filters filters of a layer
 * @returns {{halo: any[], rest: any[]}} the shadows and glows, and all the other filters (order kept)
 */
export function split_halo_filters(filters) {
	const halo = [];
	const rest = [];
	(Array.isArray(filters) ? filters : []).forEach((filter) => {
		if (filter && HALO_FILTERS.includes(filter.name)) {
			halo.push(filter);
		}
		else {
			rest.push(filter);
		}
	});
	return {halo, rest};
}
