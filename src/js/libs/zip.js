/**
 * Minimal ZIP writer (files are stored without compression - PNG and JPEG are compressed already).
 */

var table = null;

function crc_table() {
	if (table) {
		return table;
	}
	table = new Uint32Array(256);
	for (var n = 0; n < 256; n++) {
		var c = n;
		for (var k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
}

/**
 * @param {Uint8Array} bytes
 * @returns {number} CRC-32 of the bytes
 */
export function crc32(bytes) {
	var t = crc_table();
	var crc = 0xffffffff;
	for (var i = 0; i < bytes.length; i++) {
		crc = t[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function utf8(text) {
	return new TextEncoder().encode(text);
}

function dos_time(date) {
	return {
		time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
		date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
	};
}

/**
 * @param {{name: string, data: Uint8Array}[]} files
 * @param {Date} [date] modification time of all files
 * @returns {Uint8Array} the ZIP file
 */
export function build_zip(files, date) {
	var stamp = dos_time(date || new Date());
	var parts = [];
	var central = [];
	var offset = 0;

	files.forEach(function (file) {
		var name = utf8(file.name);
		var crc = crc32(file.data);
		var local = new Uint8Array(30 + name.length);
		var view = new DataView(local.buffer);
		view.setUint32(0, 0x04034b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 0x0800, true); //UTF-8 names
		view.setUint16(8, 0, true); //stored
		view.setUint16(10, stamp.time, true);
		view.setUint16(12, stamp.date, true);
		view.setUint32(14, crc, true);
		view.setUint32(18, file.data.length, true);
		view.setUint32(22, file.data.length, true);
		view.setUint16(26, name.length, true);
		local.set(name, 30);
		parts.push(local, file.data);

		var entry = new Uint8Array(46 + name.length);
		var cv = new DataView(entry.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(8, 0x0800, true);
		cv.setUint16(10, 0, true);
		cv.setUint16(12, stamp.time, true);
		cv.setUint16(14, stamp.date, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, file.data.length, true);
		cv.setUint32(24, file.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		entry.set(name, 46);
		central.push(entry);
		offset += local.length + file.data.length;
	});

	var central_size = central.reduce(function (sum, entry) {
		return sum + entry.length;
	}, 0);
	var end = new Uint8Array(22);
	var ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, central_size, true);
	ev.setUint32(16, offset, true);

	var all = parts.concat(central, [end]);
	var total = all.reduce(function (sum, part) {
		return sum + part.length;
	}, 0);
	var result = new Uint8Array(total);
	var position = 0;
	all.forEach(function (part) {
		result.set(part, position);
		position += part.length;
	});
	return result;
}
