/**
 * Import / export of selections.
 * - JSON file "minipaint-selections" with any number of named masks (run-length encoded when smaller)
 * - grayscale image of a mask (white = selected), see mask_to_image_data / image_to_mask
 */
import { encode_selection, decode_selection } from './selection-store.js';

export const FILE_FORMAT = 'minipaint-selections';
export const FILE_VERSION = 1;
const MAX_SELECTIONS = 200;
const MAX_PIXELS = 64 * 1000 * 1000;
const MAX_NAME_LENGTH = 100;

function bytes_to_base64(bytes) {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function base64_to_bytes(text) {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * @param {{name: string, mask: {width: number, height: number, data: Uint8ClampedArray}}[]} selections
 * @returns {string} JSON text of the file
 */
export function serialize_selections(selections) {
	const list = selections.map((item) => {
		const record = encode_selection(item.name, item.mask);
		const entry = {name: record.name, width: record.width, height: record.height, encoding: record.encoding};
		if (record.encoding === 'rle') {
			entry.values = Array.from(record.values);
			entry.counts = Array.from(record.counts);
		} else {
			entry.data = bytes_to_base64(record.data);
		}
		return entry;
	});
	return JSON.stringify({format: FILE_FORMAT, version: FILE_VERSION, selections: list});
}

/**
 * Parses and validates the content of a selections file. Never throws.
 *
 * @param {string} text
 * @returns {{selections: {name: string, mask: {width: number, height: number, data: Uint8ClampedArray}}[], skipped: number, error: string|null}}
 */
export function parse_selections(text) {
	const result = {selections: [], skipped: 0, error: null};
	let file;
	try {
		file = JSON.parse(text);
	}
	catch {
		result.error = 'not_json';
		return result;
	}
	if (!file || file.format !== FILE_FORMAT || !Array.isArray(file.selections)) {
		result.error = 'wrong_format';
		return result;
	}
	if (file.version > FILE_VERSION) {
		result.error = 'newer_version';
		return result;
	}

	file.selections.slice(0, MAX_SELECTIONS).forEach((entry) => {
		let mask = null;
		try {
			if (entry && typeof entry.name === 'string' && entry.width * entry.height <= MAX_PIXELS) {
				const record = {name: entry.name.trim().slice(0, MAX_NAME_LENGTH), width: entry.width, height: entry.height, encoding: entry.encoding};
				if (entry.encoding === 'rle' && Array.isArray(entry.values) && Array.isArray(entry.counts)) {
					record.values = Uint8Array.from(entry.values);
					record.counts = Uint32Array.from(entry.counts);
				}
				else if (entry.encoding === 'raw' && typeof entry.data === 'string') {
					record.data = base64_to_bytes(entry.data);
				}
				mask = record.name ? decode_selection(record) : null;
			}
		}
		catch {
			mask = null;
		}
		if (mask) {
			result.selections.push(mask);
		} else {
			result.skipped++;
		}
	});
	result.skipped += Math.max(0, file.selections.length - MAX_SELECTIONS);
	return result;
}

/**
 * A name that is not in the list yet: "name", "name (2)", "name (3)"...
 *
 * @param {string} name
 * @param {string[]} existing
 * @returns {string}
 */
export function unique_name(name, existing) {
	if (existing.indexOf(name) < 0) {
		return name;
	}
	let number = 2;
	while (existing.indexOf(`${name  } (${number})`) >= 0) {
		number++;
	}
	return `${name  } (${number})`;
}

/**
 * Grayscale RGBA pixels of a mask (white = selected), always opaque
 *
 * @param {{width: number, height: number, data: Uint8ClampedArray}} mask
 * @returns {Uint8ClampedArray}
 */
export function mask_to_pixels(mask) {
	const pixels = new Uint8ClampedArray(mask.width * mask.height * 4);
	for (let p = 0, i = 0; p < mask.data.length; p++, i += 4) {
		pixels[i] = pixels[i + 1] = pixels[i + 2] = mask.data[p];
		pixels[i + 3] = 255;
	}
	return pixels;
}

/**
 * Mask from image pixels. Images with transparency use the alpha channel (e.g. a cut-out),
 * opaque images use the brightness (white = selected).
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @returns {{width: number, height: number, data: Uint8ClampedArray}}
 */
export function image_to_mask(image) {
	const data = new Uint8ClampedArray(image.width * image.height);
	let has_alpha = false;
	for (let i = 3; i < image.data.length; i += 4) {
		if (image.data[i] < 255) {
			has_alpha = true;
			break;
		}
	}
	for (let p = 0, k = 0; p < data.length; p++, k += 4) {
		if (has_alpha) {
			data[p] = image.data[k + 3];
		} else {
			data[p] = 0.299 * image.data[k] + 0.587 * image.data[k + 1] + 0.114 * image.data[k + 2];
		}
	}
	return {width: image.width, height: image.height, data};
}
