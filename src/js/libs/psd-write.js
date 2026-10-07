/**
 * Writer of Photoshop files (.psd): layers with pixels, place, opacity, visibility, blend mode and name, and the
 * flattened picture. 8 bits, RGB, no compression. No effects, masks or groups. Pure functions, no DOM.
 *
 * @typedef {{name: string, x: number, y: number, width: number, height: number, opacity: number, visible: boolean,
 *   composition: string, data: Uint8ClampedArray}} Psd_out_layer pixels are RGBA (not premultiplied), opacity 0-100
 * @typedef {{section: 'end'}} Psd_group_end the divider that starts a group (the layers of the group follow it)
 * @typedef {{section: 'start', name: string, opacity: number, visible: boolean, composition: string, pass?: boolean}} Psd_group_start
 *   the record that closes a group, with its name and settings (it comes after the layers of the group)
 */

//canvas composite operations as the blend keys of Photoshop (the reverse of the table of libs/psd.js)
const BLEND_KEYS = {
	'source-over': 'norm', 'darken': 'dark', 'multiply': 'mul ', 'color-burn': 'idiv', 'lighten': 'lite', 'screen': 'scrn',
	'color-dodge': 'div ', 'overlay': 'over', 'soft-light': 'sLit', 'hard-light': 'hLit', 'difference': 'diff',
	'exclusion': 'smud', 'hue': 'hue ', 'saturation': 'sat ', 'color': 'colr', 'luminosity': 'lum ',
};

/**
 * @param {string} composition canvas globalCompositeOperation
 * @returns {string} four letters
 */
export function blend_key(composition) {
	return Object.prototype.hasOwnProperty.call(BLEND_KEYS, composition) ? BLEND_KEYS[composition] : 'norm';
}

class Writer {
	constructor() {
		/** @type {number[]} */
		this.bytes = [];
	}

	u8(value) {
		this.bytes.push(value & 255);
	}

	u16(value) {
		this.bytes.push((value >> 8) & 255, value & 255);
	}

	u32(value) {
		this.bytes.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
	}

	text(value) {
		for (var i = 0; i < value.length; i++) {
			this.bytes.push(value.charCodeAt(i) & 255);
		}
	}

	/**
	 * @param {Uint8Array|number[]} values
	 */
	append(values) {
		for (var i = 0; i < values.length; i++) {
			this.bytes.push(values[i]);
		}
	}
}

/**
 * The pixel rows of one channel of RGBA data
 *
 * @param {Uint8ClampedArray} data
 * @param {number} channel 0 red, 1 green, 2 blue, 3 alpha
 * @returns {Uint8Array}
 */
function plane(data, channel) {
	var out = new Uint8Array(data.length / 4);
	for (var i = 0; i < out.length; i++) {
		out[i] = data[i * 4 + channel];
	}
	return out;
}

/**
 * @param {string} name
 * @returns {number[]} the name as a Pascal string (ASCII, at most 255 letters) padded to a multiple of 4 bytes
 */
function pascal_name(name) {
	var ascii = Array.from(name).map(function (c) { return c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127 ? c : '_'; }).join('').slice(0, 255);
	var bytes = [ascii.length];
	for (var i = 0; i < ascii.length; i++) {
		bytes.push(ascii.charCodeAt(i));
	}
	while (bytes.length % 4 != 0) {
		bytes.push(0);
	}
	return bytes;
}

/**
 * The full name as a Unicode tagged block, so names with accents survive
 *
 * @param {string} name
 * @returns {number[]}
 */
function unicode_name_block(name) {
	var text = name.slice(0, 250);
	var data = [(text.length >>> 24) & 255, (text.length >>> 16) & 255, (text.length >>> 8) & 255, text.length & 255];
	for (var i = 0; i < text.length; i++) {
		var code = text.charCodeAt(i);
		data.push((code >> 8) & 255, code & 255);
	}
	while (data.length % 4 != 0) {
		data.push(0);
	}
	var block = [0x38, 0x42, 0x49, 0x4d, 0x6c, 0x75, 0x6e, 0x69];
	block.push((data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255);
	return block.concat(data);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {(Psd_out_layer|Psd_group_end|Psd_group_start)[]} layers from the bottom to the top, with the records of groups
 * @param {Uint8ClampedArray} composite RGBA of the whole picture (the alpha is dropped)
 * @returns {Uint8Array} the file
 */
export function build_psd(width, height, layers, composite) {
	var w = new Writer();
	w.text('8BPS');
	w.u16(1);
	w.append([0, 0, 0, 0, 0, 0]);
	w.u16(3);
	w.u32(height);
	w.u32(width);
	w.u16(8);
	w.u16(3);
	w.u32(0); //color mode data
	w.u32(0); //image resources

	//layer records, then the pixels of every channel
	var info = new Writer();
	info.u16(layers.length);
	var channel_ids = [-1, 0, 1, 2];
	var empty_plane = new Uint8Array(0);
	var planes = layers.map(function (layer) {
		if (layer.section) {
			return [empty_plane, empty_plane, empty_plane, empty_plane];
		}
		return [plane(layer.data, 3), plane(layer.data, 0), plane(layer.data, 1), plane(layer.data, 2)];
	});
	layers.forEach(function (layer, index) {
		var marker = layer.section ? layer : null;
		var box = marker ? {x: 0, y: 0, width: 0, height: 0} : layer;
		info.u32(box.y);
		info.u32(box.x);
		info.u32(box.y + box.height);
		info.u32(box.x + box.width);
		info.u16(4);
		channel_ids.forEach(function (id) {
			info.u16(id & 0xffff);
			info.u32(2 + planes[index][0].length);
		});
		info.text('8BIM');
		info.text(marker && marker.section == 'start' ? (marker.pass ? 'pass' : blend_key(marker.composition)) : blend_key(marker ? 'source-over' : layer.composition));
		var opacity = marker && marker.section == 'end' ? 100 : layer.opacity;
		info.u8(Math.round(Math.min(100, Math.max(0, opacity)) / 100 * 255));
		info.u8(0);
		info.u8(layer.visible === false ? 2 : 0);
		info.u8(0);
		var layer_name = marker && marker.section == 'end' ? '</Layer group>' : layer.name;
		var name = pascal_name(layer_name);
		var unicode = unicode_name_block(layer_name);
		var section = [];
		if (marker) {
			//the type of the section: 1 an open folder (the record that closes the group), 3 the divider that starts it
			var kind = marker.section == 'start' ? 1 : 3;
			section = [0x38, 0x42, 0x49, 0x4d, 0x6c, 0x73, 0x63, 0x74, 0, 0, 0, 12, 0, 0, 0, kind, 0x38, 0x42, 0x49, 0x4d];
			var key = marker.section == 'start' ? (marker.pass ? 'pass' : blend_key(marker.composition)) : 'norm';
			section.push(key.charCodeAt(0), key.charCodeAt(1), key.charCodeAt(2), key.charCodeAt(3));
		}
		info.u32(4 + 4 + name.length + unicode.length + section.length);
		info.u32(0); //layer mask
		info.u32(0); //blending ranges
		info.append(name);
		info.append(unicode);
		info.append(section);
	});
	planes.forEach(function (list) {
		list.forEach(function (channel) {
			info.u16(0); //raw
			info.append(channel);
		});
	});
	if (info.bytes.length % 2 != 0) {
		info.u8(0);
	}
	w.u32(4 + info.bytes.length + 4);
	w.u32(info.bytes.length);
	w.append(info.bytes);
	w.u32(0); //global layer mask info

	//the flattened picture, over white
	w.u16(0);
	var count = width * height;
	for (var c = 0; c < 3; c++) {
		var out = new Uint8Array(count);
		for (var i = 0; i < count; i++) {
			var alpha = composite[i * 4 + 3] / 255;
			out[i] = Math.round(composite[i * 4 + c] * alpha + 255 * (1 - alpha));
		}
		w.append(out);
	}
	return new Uint8Array(w.bytes);
}

/**
 * The smallest rectangle that holds all the visible (not fully transparent) pixels
 *
 * @param {Uint8ClampedArray} data RGBA
 * @param {number} width
 * @param {number} height
 * @returns {{x: number, y: number, width: number, height: number}|null} null for an empty picture
 */
export function content_bounds(data, width, height) {
	var min_x = width, min_y = height, max_x = -1, max_y = -1;
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			if (data[(y * width + x) * 4 + 3] != 0) {
				if (x < min_x) { min_x = x; }
				if (x > max_x) { max_x = x; }
				if (y < min_y) { min_y = y; }
				if (y > max_y) { max_y = y; }
			}
		}
	}
	if (max_x < 0) {
		return null;
	}
	return {x: min_x, y: min_y, width: max_x - min_x + 1, height: max_y - min_y + 1};
}
