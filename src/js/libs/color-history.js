/**
 * Recently used colors (Color panel). Pure helpers, the panel keeps the list in a cookie.
 */

export const COLOR_HISTORY_SIZE = 16;

/**
 * @param {string} hex
 * @returns {string|null} normalized "#rrggbb" in lower case or null when it is not a color
 */
export function normalize_hex(hex) {
	var match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
	return match ? '#' + match[1].toLowerCase() : null;
}

/**
 * Adds the color to the front of the list; a color that is already there only moves to the front.
 *
 * @param {string[]} list
 * @param {string} hex
 * @param {number} [max]
 * @returns {string[]} new list
 */
export function push_color(list, hex, max) {
	var color = normalize_hex(hex);
	var result = Array.isArray(list) ? list.map(normalize_hex).filter(Boolean) : [];
	if (color == null) {
		return result.slice(0, max || COLOR_HISTORY_SIZE);
	}
	result = [color].concat(result.filter((item) => item != color));
	return result.slice(0, max || COLOR_HISTORY_SIZE);
}

/**
 * @param {string} text value from the cookie ("#aabbcc,#112233")
 * @returns {string[]}
 */
export function parse_history(text) {
	return push_list(String(text || '').split(','));
}

function push_list(items) {
	var seen = {};
	var result = [];
	items.forEach((item) => {
		var color = normalize_hex(item);
		if (color && !seen[color]) {
			seen[color] = true;
			result.push(color);
		}
	});
	return result.slice(0, COLOR_HISTORY_SIZE);
}
