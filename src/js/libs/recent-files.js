/**
 * Recently opened files (File > Open Recent). Files are kept in the browser (IndexedDB), nothing is sent anywhere.
 */

const DB_NAME = 'minipaint_recent';
const STORE = 'files';
export const MAX_RECENT = 8;
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

function open_db() {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB == 'undefined') {
			reject(new Error('IndexedDB not supported'));
			return;
		}
		var request = indexedDB.open(DB_NAME, 1);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(STORE, {keyPath: 'id', autoIncrement: true});
		};
	});
}

function run(mode, action) {
	return open_db().then((db) => new Promise((resolve, reject) => {
		var transaction = db.transaction([STORE], mode);
		var result = action(transaction.objectStore(STORE));
		transaction.oncomplete = () => {
			db.close();
			resolve(result && result.result !== undefined ? result.result : undefined);
		};
		transaction.onerror = () => {
			db.close();
			reject(transaction.error);
		};
		transaction.onabort = () => {
			db.close();
			reject(transaction.error || new Error('Transaction aborted'));
		};
	}));
}

//adding files is done one by one, so two additions never work with an outdated list
var queue = Promise.resolve();

/**
 * pure helper: which items to drop so at most `max` newest items remain and duplicates by name are removed
 *
 * @param {{id:number, name:string, time:number}[]} items
 * @param {string} new_name name of the item being added
 * @param {number} max
 * @returns {number[]} ids to delete
 */
export function select_obsolete(items, new_name, max) {
	var sorted = items.slice().sort((a, b) => b.time - a.time);
	var remove = [];
	var kept = 0;
	for (var i = 0; i < sorted.length; i++) {
		if (sorted[i].name == new_name || kept >= max - 1) {
			remove.push(sorted[i].id);
		}
		else {
			kept++;
		}
	}
	return remove;
}

/**
 * @param {File} file
 * @param {string} name display name
 */
export function add_recent(file, name) {
	queue = queue.then(() => add_recent_now(file, name), () => add_recent_now(file, name));
	return queue;
}

async function add_recent_now(file, name) {
	if (!file || file.size > MAX_FILE_SIZE) {
		return;
	}
	try {
		var all = await run('readonly', (store) => store.getAll());
		var obsolete = select_obsolete((all || []).map((item) => ({id: item.id, name: item.name, time: item.time})), name, MAX_RECENT);
		await run('readwrite', (store) => {
			obsolete.forEach((id) => store.delete(id));
			return store.add({name: name, time: Date.now(), file: file});
		});
	}
	catch (e) {
		//recent files are optional
	}
}

/**
 * @returns {Promise<{id:number, name:string, time:number}[]>} newest first
 */
export async function list_recent() {
	try {
		var all = await run('readonly', (store) => store.getAll());
		return (all || []).map((item) => ({id: item.id, name: item.name, time: item.time})).sort((a, b) => b.time - a.time);
	}
	catch (e) {
		return [];
	}
}

/**
 * @param {number} id
 * @returns {Promise<File|null>}
 */
export async function get_recent(id) {
	try {
		var item = await run('readonly', (store) => store.get(id));
		return item ? item.file : null;
	}
	catch (e) {
		return null;
	}
}

export async function clear_recent() {
	try {
		await run('readwrite', (store) => store.clear());
	}
	catch (e) {
		//ignore
	}
}
