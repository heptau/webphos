/**
 * IndexedDB wrapper for project storage
 * Provides persistent storage for large projects
 * 
 * @author ViliusL
 */

const DB_NAME = 'minipaint_projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

/**
 * Opens the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function open_db() {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			reject(new Error('IndexedDB not supported'));
			return;
		}
		
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		
		request.onerror = () => reject(new Error('Failed to open IndexedDB'));
		request.onsuccess = () => resolve(request.result);
		
		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
				store.createIndex('name', 'name', { unique: false });
				store.createIndex('created', 'created', { unique: false });
				store.createIndex('modified', 'modified', { unique: false });
			}
		};
	});
}

/**
 * Saves a project to IndexedDB
 * @param {Object} project - Project data
 * @returns {Promise<number>} - Project ID
 */
export async function save_project(project) {
	const db = await open_db();
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		
		const projectData = {
			...project,
			modified: new Date().toISOString(),
		};
		
		// If project has ID, update; otherwise add new
		let request;
		if (project.id) {
			projectData.id = project.id;
			request = store.put(projectData);
		} else {
			request = store.add(projectData);
		}
		
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error('Failed to save project'));
	});
}

/**
 * Loads a project from IndexedDB
 * @param {number} id - Project ID
 * @returns {Promise<Object|null>} - Project data or null if not found
 */
export async function load_project(id) {
	const db = await open_db();
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(id);
		
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(new Error('Failed to load project'));
	});
}

/**
 * Loads all projects from IndexedDB
 * @returns {Promise<Array>} - Array of projects
 */
export async function load_all_projects() {
	const db = await open_db();
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.getAll();
		
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(new Error('Failed to load projects'));
	});
}

/**
 * Deletes a project from IndexedDB
 * @param {number} id - Project ID
 * @returns {Promise<void>}
 */
export async function delete_project(id) {
	const db = await open_db();
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(id);
		
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to delete project'));
	});
}

/**
 * Exports a project as JSON file
 * @param {Object} project - Project data
 * @param {string} filename - Optional filename
 */
export function export_project(project, filename) {
	const data = JSON.stringify(project, null, 2);
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = filename || `minipaint_${project.name || 'project'}_${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Imports a project from JSON file
 * @param {File} file - JSON file
 * @returns {Promise<Object>} - Parsed project data
 */
export function import_project(file) {
	return new Promise((resolve, reject) => {
		if (!file) {
			reject(new Error('No file provided'));
			return;
		}
		
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const project = JSON.parse(e.target.result);
				// Validate project structure
				if (!project.layers || !Array.isArray(project.layers)) {
					throw new Error('Invalid project format: missing layers');
				}
				resolve(project);
			} catch (err) {
				reject(new Error('Invalid JSON file: ' + err.message));
			}
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});
}

/**
 * Checks if IndexedDB is available
 * @returns {boolean}
 */
export function is_indexeddb_available() {
	try {
		return 'indexedDB' in window && window.indexedDB !== null;
	} catch (e) {
		return false;
	}
}

/**
 * Gets storage usage estimate
 * @returns {Promise<{usage: number, quota: number, usagePercent: number}>} - { usage, quota, usagePercent }
 */
export async function get_storage_estimate() {
	if (navigator.storage && navigator.storage.estimate) {
		const estimate = await navigator.storage.estimate();
		return {
			usage: estimate.usage || 0,
			quota: estimate.quota || 0,
			usagePercent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0,
		};
	}
	return { usage: 0, quota: 0, usagePercent: 0 };
}

/**
 * Clears all project data
 * @returns {Promise<void>}
 */
export async function clear_all_projects() {
	const db = await open_db();
	
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();
		
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error('Failed to clear projects'));
	});
}