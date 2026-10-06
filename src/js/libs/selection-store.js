/**
 * Persistent storage of saved selections (Select > Save Selection) in IndexedDB.
 * Masks are stored run-length encoded when that is smaller than the raw data (typical for hard-edged masks).
 * Failures (private mode, no IndexedDB, quota) never throw - the selections then simply stay in memory.
 */

const DB_NAME = 'minipaint_selections';
const DB_VERSION = 1;
const STORE_NAME = 'selections';

/**
 * Run-length encoding of a byte array
 *
 * @param {Uint8ClampedArray|Uint8Array} data
 * @returns {{values: Uint8Array, counts: Uint32Array}}
 */
export function rle_encode(data) {
	var values = [];
	var counts = [];
	var i = 0;
	while (i < data.length) {
		var value = data[i];
		var run = 1;
		while (i + run < data.length && data[i + run] === value) {
			run++;
		}
		values.push(value);
		counts.push(run);
		i += run;
	}
	return {values: Uint8Array.from(values), counts: Uint32Array.from(counts)};
}

/**
 * @param {Uint8Array} values
 * @param {Uint32Array} counts
 * @param {number} length expected length of the decoded data
 * @returns {Uint8ClampedArray|null} null when the data is corrupted
 */
export function rle_decode(values, counts, length) {
	if (!values || !counts || values.length !== counts.length) {
		return null;
	}
	var data = new Uint8ClampedArray(length);
	var position = 0;
	for (var i = 0; i < values.length; i++) {
		if (position + counts[i] > length) {
			return null;
		}
		data.fill(values[i], position, position + counts[i]);
		position += counts[i];
	}
	return position === length ? data : null;
}

/**
 * Database record of a named mask
 *
 * @param {string} name
 * @param {{width: number, height: number, data: Uint8ClampedArray}} mask
 * @returns {any}
 */
export function encode_selection(name, mask) {
	var record = {name: name, width: mask.width, height: mask.height, saved: new Date().toISOString()};
	var rle = rle_encode(mask.data);
	if (rle.values.length * 5 < mask.data.length) {
		record.encoding = 'rle';
		record.values = rle.values;
		record.counts = rle.counts;
	}
	else {
		record.encoding = 'raw';
		record.data = new Uint8Array(mask.data);
	}
	return record;
}

/**
 * @param {*} record from the database
 * @returns {{name: string, mask: {width: number, height: number, data: Uint8ClampedArray}}|null} null for invalid records
 */
export function decode_selection(record) {
	if (!record || typeof record.name !== 'string' || !(record.width > 0) || !(record.height > 0)) {
		return null;
	}
	var length = record.width * record.height;
	var data = null;
	if (record.encoding === 'rle') {
		data = rle_decode(record.values, record.counts, length);
	}
	else if (record.encoding === 'raw' && record.data && record.data.length === length) {
		data = new Uint8ClampedArray(record.data);
	}
	return data ? {name: record.name, mask: {width: record.width, height: record.height, data: data}} : null;
}

function open_db() {
	return new Promise((resolve, reject) => {
		if (typeof window === 'undefined' || !window.indexedDB) {
			reject(new Error('IndexedDB not supported'));
			return;
		}
		var request = window.indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(new Error('Failed to open IndexedDB'));
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			var db = event.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, {keyPath: 'name'});
			}
		};
	});
}

function run(mode, action) {
	return open_db().then((db) => new Promise((resolve, reject) => {
		var transaction = db.transaction([STORE_NAME], mode);
		var request = action(transaction.objectStore(STORE_NAME));
		transaction.oncomplete = () => {
			db.close();
			resolve(request.result);
		};
		transaction.onerror = () => {
			db.close();
			reject(transaction.error || new Error('IndexedDB transaction failed'));
		};
		transaction.onabort = transaction.onerror;
	}));
}

/**
 * Stores (or replaces) a selection
 *
 * @returns {Promise<boolean>} false when it could not be stored
 */
export async function save_selection(name, mask) {
	try {
		await run('readwrite', (store) => store.put(encode_selection(name, mask)));
		return true;
	}
	catch (error) {
		console.warn('Saved selection is not persistent:', error.message);
		return false;
	}
}

/**
 * @returns {Promise<{name: string, mask: object}[]>} all stored selections, oldest first (empty when unavailable)
 */
export async function load_all_selections() {
	try {
		var records = await run('readonly', (store) => store.getAll());
		return (records || [])
			.sort((a, b) => String(a.saved).localeCompare(String(b.saved)))
			.map(decode_selection)
			.filter(Boolean);
	}
	catch (error) {
		return [];
	}
}

/**
 * @returns {Promise<boolean>}
 */
export async function delete_selection(name) {
	try {
		await run('readwrite', (store) => store.delete(name));
		return true;
	}
	catch (error) {
		console.warn('Saved selection could not be deleted from storage:', error.message);
		return false;
	}
}
