/**
 * Units of document size (pure functions, no DOM). The document keeps its pixel size, the unit and the
 * resolution (dpi) only say how big it is on paper - as in Photoshop.
 */

//how many of the unit fit into one inch (pixels depend on the resolution)
export const UNIT_PER_INCH = {
	pixels: null,
	inches: 1,
	centimeters: 2.54,
	millimetres: 25.4,
	points: 72,
	picas: 6,
};

export const UNIT_SHORT = {
	pixels: 'px',
	inches: '"',
	centimeters: 'cm',
	millimetres: 'mm',
	points: 'pt',
	picas: 'pc',
};

export const UNIT_NAMES = Object.keys(UNIT_PER_INCH);

export function is_unit(name) {
	return Object.prototype.hasOwnProperty.call(UNIT_PER_INCH, name);
}

export function clamp_dpi(dpi) {
	dpi = parseFloat(dpi);
	if (!(dpi > 0)) {
		return 72;
	}
	return Math.max(1, Math.min(2400, dpi));
}

/**
 * @param {number} value size in the unit
 * @param {string} unit
 * @param {number} dpi
 * @returns {number} size in pixels (rounded, at least 1), NaN for invalid input
 */
export function to_pixels(value, unit, dpi) {
	value = parseFloat(value);
	if (isNaN(value) || !is_unit(unit)) {
		return NaN;
	}
	var pixels = unit == 'pixels' ? value : value * clamp_dpi(dpi) / UNIT_PER_INCH[unit];
	return Math.max(1, Math.round(pixels));
}

/**
 * @param {number} pixels
 * @param {string} unit
 * @param {number} dpi
 * @returns {number} size in the unit (rounded to 3 decimals, whole numbers for pixels)
 */
export function from_pixels(pixels, unit, dpi) {
	pixels = parseFloat(pixels);
	if (isNaN(pixels) || !is_unit(unit)) {
		return NaN;
	}
	if (unit == 'pixels') {
		return Math.round(pixels);
	}
	return Math.round(pixels / clamp_dpi(dpi) * UNIT_PER_INCH[unit] * 1000) / 1000;
}

/**
 * resolution that gives the pixels the wanted physical size (resampling off in Photoshop)
 *
 * @param {number} pixels
 * @param {number} size physical size in the unit
 * @param {string} unit
 * @returns {number} dpi, clamped to 1 .. 2400, rounded to 2 decimals
 */
export function dpi_for(pixels, size, unit) {
	pixels = parseFloat(pixels);
	size = parseFloat(size);
	if (!(pixels > 0) || !(size > 0) || !is_unit(unit) || unit == 'pixels') {
		return NaN;
	}
	return Math.round(clamp_dpi(pixels / size * UNIT_PER_INCH[unit]) * 100) / 100;
}

/**
 * converts a size between units at the same resolution
 */
export function convert_size(value, from_unit, to_unit, dpi) {
	var pixels = to_pixels(value, from_unit, dpi);
	if (from_unit != 'pixels' && !isNaN(parseFloat(value))) {
		//keep the physical size exact instead of going through rounded pixels
		var inches = parseFloat(value) / UNIT_PER_INCH[from_unit];
		return to_unit == 'pixels' ? Math.round(inches * clamp_dpi(dpi)) : Math.round(inches * UNIT_PER_INCH[to_unit] * 1000) / 1000;
	}
	return from_pixels(pixels, to_unit, dpi);
}
