/**
 * Reader of Photoshop files (.psd): the size, the layers (pixels, place, opacity, visibility, blend mode, name) and the
 * flattened picture. 8 and 16 bits per channel, RGB and grayscale, raw and RLE data. Groups (also inside groups) are
 * read with their opacity and blend mode. Layer effects, masks, text and smart objects are not read (they are only
 * skipped).
 * Pure functions, no DOM. Every length from the file is checked, a broken file throws an Error.
 *
 * @typedef {{name: string, x: number, y: number, width: number, height: number, opacity: number, visible: boolean,
 *   composition: string, data: Uint8ClampedArray, group?: string|null}} Psd_layer pixels are RGBA, opacity 0-100,
 *   group = path of the group ('Faces/Eyes') or null
 * @typedef {{opacity: number, composition: string}} Psd_group opacity 0-100
 * @typedef {{width: number, height: number, layers: Psd_layer[], groups: Object<string, Psd_group>, composite: Uint8ClampedArray|null}} Psd_file
 *   groups = the settings of every group by its path
 */

export const MAX_PIXELS = 100 * 1000 * 1000;
export const MAX_SIDE = 30000;

//blend modes of Photoshop as canvas composite operations (unknown ones are drawn normally)
const BLEND_MODES = {
	'norm': 'source-over', 'pass': 'source-over', 'dark': 'darken', 'mul ': 'multiply', 'idiv': 'color-burn', 'lite': 'lighten',
	'scrn': 'screen', 'div ': 'color-dodge', 'over': 'overlay', 'sLit': 'soft-light', 'hLit': 'hard-light', 'diff': 'difference',
	'smud': 'exclusion', 'hue ': 'hue', 'sat ': 'saturation', 'colr': 'color', 'lum ': 'luminosity',
};

/**
 * @param {string} key four letters of the blend mode in the file
 * @returns {string} canvas globalCompositeOperation
 */
export function blend_mode(key) {
	return Object.prototype.hasOwnProperty.call(BLEND_MODES, key) ? BLEND_MODES[key] : 'source-over';
}

class Reader {
	/**
	 * @param {ArrayBuffer} buffer
	 */
	constructor(buffer) {
		this.view = new DataView(buffer);
		this.bytes = new Uint8Array(buffer);
		this.pos = 0;
	}

	need(count) {
		if (count < 0 || this.pos + count > this.bytes.length) {
			throw new Error('The file is damaged (it ends too early).');
		}
	}

	u8() {
		this.need(1);
		return this.view.getUint8(this.pos++);
	}

	u16() {
		this.need(2);
		const value = this.view.getUint16(this.pos);
		this.pos += 2;
		return value;
	}

	i16() {
		this.need(2);
		const value = this.view.getInt16(this.pos);
		this.pos += 2;
		return value;
	}

	u32() {
		this.need(4);
		const value = this.view.getUint32(this.pos);
		this.pos += 4;
		return value;
	}

	i32() {
		this.need(4);
		const value = this.view.getInt32(this.pos);
		this.pos += 4;
		return value;
	}

	text(count) {
		this.need(count);
		let result = '';
		for (let i = 0; i < count; i++) {
			result += String.fromCharCode(this.bytes[this.pos + i]);
		}
		this.pos += count;
		return result;
	}

	skip(count) {
		this.need(count);
		this.pos += count;
	}
}

/**
 * PackBits (the RLE of Photoshop) for one row
 *
 * @param {Uint8Array} source
 * @param {number} start
 * @param {number} length bytes of the packed row
 * @param {Uint8Array} target
 * @param {number} target_start
 * @param {number} expected bytes of the unpacked row
 */
export function unpack_bits(source, start, length, target, target_start, expected) {
	let i = start;
	const end = start + length;
	let out = 0;
	while (i < end && out < expected) {
		let n = source[i++];
		if (n > 127) {
			n -= 256;
		}
		if (n >= 0) {
			const count = n + 1;
			for (let k = 0; k < count && out < expected; k++) {
				target[target_start + out++] = i < end ? source[i] : 0;
				i++;
			}
		}
		else if (n != -128) {
			const value = i < end ? source[i] : 0;
			i++;
			for (let r = 0; r < 1 - n && out < expected; r++) {
				target[target_start + out++] = value;
			}
		}
	}
}

/**
 * One channel of the image: compression, then rows
 *
 * @param {Reader} reader
 * @param {number} width
 * @param {number} height
 * @param {number} depth 8 or 16
 * @param {number} end where the data of this channel ends in the file
 * @returns {Uint8Array} 8 bit values, width * height
 */
function read_channel(reader, width, height, depth, end) {
	const compression = reader.u16();
	const row_bytes = width * (depth / 8);
	const raw = new Uint8Array(row_bytes * height);
	if (compression == 0) {
		reader.need(raw.length);
		raw.set(reader.bytes.subarray(reader.pos, reader.pos + raw.length));
		reader.pos += raw.length;
	}
	else if (compression == 1) {
		const counts = [];
		for (let y = 0; y < height; y++) {
			counts.push(reader.u16());
		}
		for (let row = 0; row < height; row++) {
			reader.need(counts[row]);
			unpack_bits(reader.bytes, reader.pos, counts[row], raw, row * row_bytes, row_bytes);
			reader.pos += counts[row];
		}
	}
	else {
		throw new Error('This compression of the picture is not supported.');
	}
	reader.pos = Math.max(reader.pos, Math.min(end, reader.bytes.length));
	if (depth == 8) {
		return raw;
	}
	const out = new Uint8Array(width * height);
	for (let i = 0; i < out.length; i++) {
		out[i] = raw[i * 2]; //the high byte of 16 bits
	}
	return out;
}

/**
 * RGBA from separate channels
 *
 * @param {Object<number, Uint8Array>} channels by channel id: 0 red, 1 green, 2 blue, -1 transparency
 * @param {number} count pixels
 * @param {number} mode 1 grayscale, 3 RGB
 * @returns {Uint8ClampedArray}
 */
function to_rgba(channels, count, mode) {
	const out = new Uint8ClampedArray(count * 4);
	const red = channels[0];
	const green = mode == 1 ? channels[0] : channels[1];
	const blue = mode == 1 ? channels[0] : channels[2];
	const alpha = channels[-1];
	for (let i = 0; i < count; i++) {
		out[i * 4] = red ? red[i] : 0;
		out[i * 4 + 1] = green ? green[i] : 0;
		out[i * 4 + 2] = blue ? blue[i] : 0;
		out[i * 4 + 3] = alpha ? alpha[i] : 255;
	}
	return out;
}

/**
 * @param {ArrayBuffer} buffer content of the .psd file
 * @returns {Psd_file}
 */
export function parse_psd(buffer) {
	const reader = new Reader(buffer);
	if (reader.text(4) != '8BPS') {
		throw new Error('This is not a Photoshop file.');
	}
	if (reader.u16() != 1) {
		throw new Error('Large Photoshop files (PSB) are not supported.');
	}
	reader.skip(6);
	const channel_count = reader.u16();
	const height = reader.u32();
	const width = reader.u32();
	const depth = reader.u16();
	const mode = reader.u16();
	if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) {
		throw new Error('The picture is too big.');
	}
	if (depth != 8 && depth != 16) {
		throw new Error('Only 8 and 16 bit Photoshop files are supported.');
	}
	if (mode != 1 && mode != 3) {
		throw new Error('Only RGB and grayscale Photoshop files are supported.');
	}
	reader.skip(reader.u32()); //color mode data
	reader.skip(reader.u32()); //image resources

	/** @type {Psd_layer[]} */
	const layers = [];
	/** @type {Object<string, Psd_group>} */
	const groups = Object.create(null);
	const layer_section = reader.u32();
	const section_end = reader.pos + layer_section;
	if (layer_section > 0) {
		const info_length = reader.u32();
		const info_end = reader.pos + info_length;
		if (info_length > 0) {
			let count = reader.i16();
			count = Math.abs(count);
			const records = [];
			for (let l = 0; l < count; l++) {
				const top = reader.i32();
				const left = reader.i32();
				const bottom = reader.i32();
				const right = reader.i32();
				const channels = reader.u16();
				if (channels > 56) {
					throw new Error('The file is damaged (too many channels).');
				}
				const list = [];
				for (let c = 0; c < channels; c++) {
					list.push({id: reader.i16(), length: reader.u32()});
				}
				if (reader.text(4) != '8BIM') {
					throw new Error('The file is damaged (a layer record).');
				}
				const key = reader.text(4);
				const opacity = reader.u8();
				reader.u8(); //clipping
				const flags = reader.u8();
				reader.u8();
				const extra = reader.u32();
				const extra_end = reader.pos + extra;
				reader.need(extra);
				reader.skip(reader.u32()); //layer mask
				reader.skip(reader.u32()); //blending ranges
				const name_start = reader.pos;
				const name_length = reader.u8();
				let name = reader.text(name_length);
				//tagged blocks: the Unicode name (luni) is better than the ASCII one, lsct marks the start / end of a group
				reader.pos = name_start + Math.ceil((1 + name_length) / 4) * 4;
				let section = 0;
				while (reader.pos + 12 <= extra_end) {
					const signature = reader.text(4);
					const tag = reader.text(4);
					const tag_length = reader.u32();
					if (signature != '8BIM' || reader.pos + tag_length > extra_end) {
						break;
					}
					const tag_end = reader.pos + tag_length + (tag_length % 2);
					if (tag == 'luni' && tag_length >= 4) {
						const letters = Math.min(reader.u32(), 250, Math.floor((tag_length - 4) / 2));
						let unicode = '';
						for (let u = 0; u < letters; u++) {
							unicode += String.fromCharCode(reader.u16());
						}
						if (unicode != '') {
							name = unicode;
						}
					}
					else if (tag == 'lsct' && tag_length >= 4) {
						section = reader.u32();
					}
					reader.pos = Math.min(tag_end, extra_end);
				}
				reader.pos = extra_end;
				records.push({
					x: left, y: top, width: right - left, height: bottom - top, channels: list,
					opacity: Math.round(opacity / 255 * 100), visible: (flags & 2) == 0, composition: blend_mode(key),
					name: Array.from(name).filter((c) => c.charCodeAt(0) >= 32).join('').slice(0, 100) || 'Layer',
					section,
				});
			}
			//groups: the end of a group comes first (a divider), then its layers, then the record with its name and settings
			/** @type {any[][]} */
			const open_groups = [];
			records.forEach((record) => {
				const empty = record.width <= 0 || record.height <= 0;
				if (empty == false && (record.width > MAX_SIDE || record.height > MAX_SIDE || record.width * record.height > MAX_PIXELS)) {
					throw new Error('A layer is too big.');
				}
				/** @type {Object<number, Uint8Array>} */
				const planes = {};
				record.channels.forEach((channel) => {
					const end = reader.pos + channel.length;
					if (empty || channel.id < -1 || channel.length < 2) {
						reader.skip(channel.length);
						return;
					}
					planes[channel.id] = read_channel(reader, record.width, record.height, depth, end);
				});
				if (record.section == 3) {
					open_groups.push([]);
					return;
				}
				if (record.section == 1 || record.section == 2) {
					const members = open_groups.pop() || [];
					const label = Array.from(record.name).map((c) => { return c == '/' ? '-' : c; }).join('').trim() || 'Group';
					members.forEach((member) => {
						member.chain.push({name: label, opacity: record.opacity, composition: record.composition, visible: record.visible});
					});
					if (open_groups.length > 0) {
						Array.prototype.push.apply(open_groups[open_groups.length - 1], members);
					}
					return;
				}
				if (empty) {
					return; //an empty layer
				}
				const layer = {
					name: record.name, x: record.x, y: record.y, width: record.width, height: record.height,
					opacity: record.opacity, visible: record.visible, composition: record.composition,
					data: to_rgba(planes, record.width * record.height, mode), group: null, chain: [],
				};
				layers.push(layer);
				if (open_groups.length > 0) {
					open_groups[open_groups.length - 1].push(layer);
				}
			});
			layers.forEach((layer) => {
				const chain = layer['chain'].slice().reverse(); //outermost group first
				delete layer['chain'];
				const path = [];
				chain.slice(0, 5).forEach((entry) => {
					path.push(entry.name.slice(0, 60));
					groups[path.join('/')] = {opacity: entry.opacity, composition: entry.composition};
					if (entry.visible == false) {
						layer.visible = false; //a hidden group hides its layers
					}
				});
				layer.group = path.length > 0 ? path.join('/') : null;
			});
		}
		reader.pos = Math.min(Math.max(reader.pos, info_end), section_end);
	}
	reader.pos = section_end;

	//the flattened picture is the fallback when a file has no layers
	/** @type {Uint8ClampedArray|null} */
	let composite = null;
	try {
		const compression = reader.u16();
		const plane_size = width * height * (depth / 8);
		const wanted = Math.min(channel_count, 4);
		const planes_all = {};
		if (compression == 0 || compression == 1) {
			const counts_all = [];
			if (compression == 1) {
				for (let n = 0; n < channel_count * height; n++) {
					counts_all.push(reader.u16());
				}
			}
			for (let ch = 0; ch < wanted; ch++) {
				const raw = new Uint8Array(plane_size);
				const row_bytes = width * (depth / 8);
				for (let y = 0; y < height; y++) {
					if (compression == 0) {
						reader.need(row_bytes);
						raw.set(reader.bytes.subarray(reader.pos, reader.pos + row_bytes), y * row_bytes);
						reader.pos += row_bytes;
					}
					else {
						const packed = counts_all[ch * height + y];
						reader.need(packed);
						unpack_bits(reader.bytes, reader.pos, packed, raw, y * row_bytes, row_bytes);
						reader.pos += packed;
					}
				}
				const plane = new Uint8Array(width * height);
				for (let p = 0; p < plane.length; p++) {
					plane[p] = depth == 8 ? raw[p] : raw[p * 2];
				}
				planes_all[ch] = plane;
			}
			//the fourth channel of a flattened RGB file is transparency
			if (mode == 3 && wanted >= 4) {
				planes_all[-1] = planes_all[3];
			}
			else if (mode == 1 && wanted >= 2) {
				planes_all[-1] = planes_all[1];
			}
			composite = to_rgba(planes_all, width * height, mode);
		}
	}
	catch {
		composite = null;
	}

	return {width, height, layers, groups, composite};
}
