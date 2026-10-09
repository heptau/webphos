/**
 * Document templates - a project (JSON) saved under a name in the browser (IndexedDB).
 */

const DB_NAME = 'minipaint_templates';
const STORE = 'templates';
export const MAX_TEMPLATES = 30;

function open_db() {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB == 'undefined') {
			reject(new Error('IndexedDB not supported'));
			return;
		}
		const request = indexedDB.open(DB_NAME, 1);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: 'name'});
	});
}

function run(mode, action) {
	return open_db().then((db) => new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE], mode);
		const request = action(transaction.objectStore(STORE));
		transaction.oncomplete = () => {
			db.close();
			resolve(request ? request.result : undefined);
		};
		transaction.onerror = () => {
			db.close();
			reject(transaction.error);
		};
		transaction.onabort = () => {
			db.close();
			reject(transaction.error || new Error('aborted'));
		};
	}));
}

/**
 * @param {string} name
 * @returns {string} name without control characters, at most 60 characters
 */
export function clean_template_name(name) {
	//control characters (code below 32) are dropped together with angle brackets
	return Array.from(String(name == undefined ? '' : name)).filter((ch) => ch.charCodeAt(0) >= 32 && ch != '<' && ch != '>').join('').trim().slice(0, 60);
}

export async function save_template(name, json) {
	name = clean_template_name(name);
	if (name == '' || typeof json != 'string') {
		return false;
	}
	try {
		const all = await list_templates();
		if (all.length >= MAX_TEMPLATES && !all.some((item) => item.name == name)) {
			return false;
		}
		await run('readwrite', (store) => store.put({name, json, time: Date.now()}));
		return true;
	}
	catch {
		return false;
	}
}

/**
 * @returns {Promise<{name: string, time: number}[]>} newest first
 */
export async function list_templates() {
	try {
		const all = await run('readonly', (store) => store.getAll());
		return (all || []).map((item) => ({name: item.name, time: item.time})).sort((a, b) => b.time - a.time);
	}
	catch {
		return [];
	}
}

/**
 * @returns {Promise<string|null>} the project JSON
 */
export async function load_template(name) {
	try {
		const item = await run('readonly', (store) => store.get(name));
		return item && typeof item.json == 'string' ? item.json : null;
	}
	catch {
		return null;
	}
}

export async function delete_template(name) {
	try {
		await run('readwrite', (store) => store.delete(name));
	}
	catch {
		//ignore
	}
}
