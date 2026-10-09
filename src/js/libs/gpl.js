/**
 * GIMP / Inkscape palette files (.gpl) - a plain text list of colors, understood by many programs.
 */

function hex2(value) {
	return (`0${  Math.max(0, Math.min(255, value)).toString(16)}`).slice(-2);
}

/**
 * @param {string} text content of a .gpl file
 * @returns {string[]|null} colors as "#rrggbb" or null when this is not a palette file
 */
export function parse_gpl(text) {
	const lines = String(text).split(/\r?\n/);
	if (!lines.length || lines[0].trim() != 'GIMP Palette') {
		return null;
	}
	const colors = [];
	for (let i = 1; i < lines.length; i++) {
		const match = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/.exec(lines[i]);
		if (match) {
			colors.push(`#${hex2(parseInt(match[1], 10))}${hex2(parseInt(match[2], 10))  }${hex2(parseInt(match[3], 10))}`);
		}
	}
	return colors.length > 0 ? colors : null;
}

/**
 * @param {string} name name of the palette
 * @param {string[]} colors "#rrggbb" values
 * @returns {string} content of a .gpl file
 */
export function build_gpl(name, colors) {
	const lines = ['GIMP Palette', `Name: ${  String(name).replace(/[\r\n]/g, ' ')}`, 'Columns: 7', '#'];
	colors.forEach((color, index) => {
		const match = /^#?([0-9a-f]{6})$/i.exec(color);
		if (!match) {
			return;
		}
		const n = parseInt(match[1], 16);
		const pad = function (value) {
			return (`   ${  value}`).slice(-3);
		};
		lines.push(`${pad((n >> 16) & 255)  } ${pad((n >> 8) & 255)} ${pad(n & 255)} Color ${  index + 1}`);
	});
	return `${lines.join('\n')  }\n`;
}
