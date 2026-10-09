/**
 * Detection of image formats the browser can really encode (canvas.toDataURL / toBlob).
 * Browsers silently fall back to PNG for unknown MIME types, so the result type is checked.
 */

//MIME type that canvas has to encode natively; formats not listed (GIF, TIFF, BMP) are encoded by bundled libraries
export const NATIVE_MIME_TYPES = {
	PNG: 'image/png',
	JPG: 'image/jpeg',
	WEBP: 'image/webp',
	AVIF: 'image/avif',
};

const cache = {};

function default_canvas() {
	if (typeof document == 'undefined') {
		return null;
	}
	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	return canvas;
}

/**
 * @param {string} mime e.g. "image/webp"
 * @param {function} [create_canvas] factory returning a canvas (for tests)
 * @returns {boolean} true if canvas can encode this MIME type
 */
export function can_encode_mime(mime, create_canvas) {
	if (create_canvas == undefined && cache[mime] !== undefined) {
		return cache[mime];
	}
	let result = false;
	try {
		const canvas = (create_canvas || default_canvas)();
		if (canvas) {
			const data = canvas.toDataURL(mime);
			result = typeof data == 'string' && data.indexOf(`data:${  mime}`) == 0;
		}
	}
	catch {
		result = false;
	}
	if (create_canvas == undefined) {
		cache[mime] = result;
	}
	return result;
}

/**
 * keep only file types the browser can save
 *
 * @param {object} types map extension -> description, e.g. {PNG: '...', WEBP: '...'}
 * @param {function} [create_canvas] factory returning a canvas (for tests)
 * @returns {object} filtered copy, order is kept
 */
export function filter_supported_types(types, create_canvas) {
	const result = {};
	for (const key in types) {
		const mime = NATIVE_MIME_TYPES[key];
		if (mime == undefined || can_encode_mime(mime, create_canvas)) {
			result[key] = types[key];
		}
	}
	return result;
}
