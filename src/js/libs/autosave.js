/**
 * Automatic saving of the work in progress (all open documents) to the browser (IndexedDB),
 * so it can be restored after a crash or an accidental reload. Nothing leaves the browser.
 */

const DB_NAME = 'minipaint_autosave';
const STORE = 'session';
const KEY = 'current';
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function open_db() {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB == 'undefined') {
			reject(new Error('IndexedDB not supported'));
			return;
		}
		var request = indexedDB.open(DB_NAME, 1);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
	});
}

function run(mode, action) {
	return open_db().then((db) => new Promise((resolve, reject) => {
		var transaction = db.transaction([STORE], mode);
		var request = action(transaction.objectStore(STORE));
		transaction.oncomplete = () => {
			db.close();
			resolve(request ? request.result : undefined);
		};
		transaction.onerror = () => reject(transaction.error);
	}));
}

/**
 * @param {object} session {documents: [{name, json}], active: number, time: number}
 * @returns {boolean} true when the session has the expected shape
 */
export function is_valid_session(session) {
	return Boolean(session)
		&& Array.isArray(session.documents)
		&& session.documents.length > 0
		&& session.documents.every((doc) => doc && typeof doc.name == 'string' && typeof doc.json == 'string')
		&& Number.isInteger(session.active)
		&& session.active >= 0
		&& session.active < session.documents.length
		&& typeof session.time == 'number';
}

/**
 * @param {object} session
 * @param {number} now timestamp
 * @returns {boolean} the session is valid and not older than MAX_AGE_MS
 */
export function is_session_fresh(session, now) {
	return is_valid_session(session) && now - session.time <= MAX_AGE_MS;
}

export async function save_session(session) {
	try {
		await run('readwrite', (store) => store.put(session, KEY));
		return true;
	}
	catch (e) {
		return false;
	}
}

export async function load_session() {
	try {
		var session = await run('readonly', (store) => store.get(KEY));
		return is_session_fresh(session, Date.now()) ? session : null;
	}
	catch (e) {
		return null;
	}
}

export async function clear_session() {
	try {
		await run('readwrite', (store) => store.delete(KEY));
	}
	catch (e) {
		//ignore
	}
}
