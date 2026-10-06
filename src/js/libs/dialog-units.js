import { to_pixels, from_pixels, convert_size, clamp_dpi } from './units.js';

function format(value, unit) {
	if (isNaN(value)) {
		return '';
	}
	return String(unit == 'pixels' ? Math.round(value) : parseFloat(value.toFixed(3)));
}

/**
 * Connects the size fields of a dialog (width, height, units, resolution) like Photoshop does:
 * changing the unit converts the numbers, changing the resolution keeps the physical size (so the pixels change),
 * a readout shows the resulting size in pixels.
 *
 * @param {object} names ids of the fields without the "pop_data_" prefix: {width, height, units, dpi}
 * @param {string} [readout_id] id of an element that shows "W x H px"
 * @returns {{get_pixels: function(): number[], set_pixels: function(number, number)}}
 */
export function link_unit_fields(names, readout_id) {
	var field = (name) => document.getElementById('pop_data_' + names[name]);
	var unit = field('units').value;
	var dpi = () => clamp_dpi(field('dpi').value);

	var get_pixels = () => [
		to_pixels(field('width').value, unit, dpi()),
		to_pixels(field('height').value, unit, dpi()),
	];
	var update_readout = () => {
		var element = readout_id ? document.getElementById(readout_id) : null;
		if (element) {
			var pixels = get_pixels();
			element.textContent = (isNaN(pixels[0]) || isNaN(pixels[1])) ? '-' : pixels[0] + ' x ' + pixels[1] + ' px';
		}
	};

	field('units').addEventListener('change', () => {
		var next = field('units').value;
		['width', 'height'].forEach((name) => {
			var value = convert_size(field(name).value, unit, next, dpi());
			field(name).value = format(value, next);
		});
		unit = next;
		update_readout();
	});
	['width', 'height', 'dpi'].forEach((name) => {
		field(name).addEventListener('input', update_readout);
	});
	field('dpi').addEventListener('change', update_readout);
	update_readout();

	return {
		get_pixels: get_pixels,
		set_pixels: (w, h) => {
			field('width').value = format(from_pixels(w, unit, dpi()), unit);
			field('height').value = format(from_pixels(h, unit, dpi()), unit);
			update_readout();
		},
	};
}
