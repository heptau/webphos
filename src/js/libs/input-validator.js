/**
 * Input validation utilities
 * 
 * @author ViliusL
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_DIMENSION = 10000; // 10000px
const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif', 'image/svg+xml'];
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.svg'];
const ALLOWED_JSON_EXTENSIONS = ['.json'];

/**
 * Validates an uploaded file
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validate_file(file) {
	if (!file) {
		return { valid: false, error: 'No file provided' };
	}

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		return { valid: false, error: `File size exceeds maximum allowed size of ${format_bytes(MAX_FILE_SIZE)}` };
	}

	// Check file type
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		// Check extension as fallback (some browsers don't set type correctly)
		const ext = get_file_extension(file.name).toLowerCase();
		if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
			return { valid: false, error: 'Invalid file type. Allowed types: PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF, SVG' };
		}
	}

	// Check extension
	const ext = get_file_extension(file.name).toLowerCase();
	if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
		return { valid: false, error: 'Invalid file extension' };
	}

	return { valid: true, error: null };
}

/**
 * Validates a JSON file
 * @param {File} file - The JSON file to validate
 * @returns {Promise<{valid: boolean, error: string|null, data?: object}>}
 */
export async function validate_json_file(file) {
	if (!file) {
		return { valid: false, error: 'No file provided' };
	}

	// Check file size
	if (file.size > MAX_JSON_SIZE) {
		return { valid: false, error: `JSON file size exceeds maximum allowed size of ${format_bytes(MAX_JSON_SIZE)}` };
	}

	// Check extension
	const ext = get_file_extension(file.name).toLowerCase();
	if (!ALLOWED_JSON_EXTENSIONS.includes(ext)) {
		return { valid: false, error: 'Invalid file extension. Must be .json' };
	}

	// Check MIME type
	if (file.type !== 'application/json' && file.type !== 'text/plain') {
		// Some systems don't set correct MIME type for JSON, so we'll allow it but validate content
	}

	try {
		const text = await file.text();
		const data = JSON.parse(text);

		// Validate JSON structure for miniPaint
		const validation = validate_json_structure(data);
		if (!validation.valid) {
			return { valid: false, error: validation.error };
		}

		return { valid: true, error: null, data };
	} catch (e) {
		return { valid: false, error: 'Invalid JSON format: ' + e.message };
	}
}

/**
 * Validates the structure of a miniPaint JSON file
 * @param {object} data - Parsed JSON data
 * @returns {{valid: boolean, error: string|null}}
 */
function validate_json_structure(data) {
	if (!data || typeof data !== 'object') {
		return { valid: false, error: 'JSON must be an object' };
	}

	// Check required fields
	if (!data.info || typeof data.info !== 'object') {
		return { valid: false, error: 'Missing or invalid "info" field' };
	}

	if (!data.info.width || !data.info.height) {
		return { valid: false, error: 'Missing width/height in info' };
	}

	const width = parseInt(data.info.width);
	const height = parseInt(data.info.height);

	if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
		return { valid: false, error: 'Invalid width/height values' };
	}

	if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
		return { valid: false, error: `Image dimensions exceed maximum of ${MAX_IMAGE_DIMENSION}px` };
	}

	// Check layers array
	if (!Array.isArray(data.layers)) {
		return { valid: false, error: 'Missing or invalid "layers" array' };
	}

	if (data.layers.length === 0) {
		return { valid: false, error: 'At least one layer is required' };
	}

	if (data.layers.length > 500) {
		return { valid: false, error: 'Too many layers (maximum 500)' };
	}

	// Validate each layer
	for (let i = 0; i < data.layers.length; i++) {
		const layer = data.layers[i];
		const layerValidation = validate_layer(layer, i);
		if (!layerValidation.valid) {
			return layerValidation;
		}
	}

	// Check image data if present
	if (data.data && Array.isArray(data.data)) {
		if (data.data.length > 500) {
			return { valid: false, error: 'Too many image data entries (maximum 500)' };
		}
	}

	return { valid: true, error: null };
}

/**
 * Validates a single layer object
 * @param {object} layer - Layer object
 * @param {number} index - Layer index for error reporting
 * @returns {{valid: boolean, error: string|null}}
 */
function validate_layer(layer, index) {
	if (!layer || typeof layer !== 'object') {
		return { valid: false, error: `Layer ${index}: must be an object` };
	}

	// Required fields
	if (!layer.name || typeof layer.name !== 'string') {
		return { valid: false, error: `Layer ${index}: missing or invalid name` };
	}

	if (layer.name.length > 200) {
		return { valid: false, error: `Layer ${index}: name too long (max 200 chars)` };
	}

	if (!layer.type || typeof layer.type !== 'string') {
		return { valid: false, error: `Layer ${index}: missing or invalid type` };
	}

	const allowedTypes = ['image', 'shape', 'text', 'rectangle', 'ellipse', 'line', 'arrow', 'triangle', 'star', 'polygon'];
	if (!allowedTypes.includes(layer.type)) {
		return { valid: false, error: `Layer ${index}: invalid layer type "${layer.type}"` };
	}

	// Validate dimensions
	if (layer.width !== undefined) {
		const w = parseInt(layer.width);
		if (isNaN(w) || w <= 0 || w > MAX_IMAGE_DIMENSION) {
			return { valid: false, error: `Layer ${index}: invalid width` };
		}
	}

	if (layer.height !== undefined) {
		const h = parseInt(layer.height);
		if (isNaN(h) || h <= 0 || h > MAX_IMAGE_DIMENSION) {
			return { valid: false, error: `Layer ${index}: invalid height` };
		}
	}

	// Validate opacity
	if (layer.opacity !== undefined) {
		const opacity = parseFloat(layer.opacity);
		if (isNaN(opacity) || opacity < 0 || opacity > 100) {
			return { valid: false, error: `Layer ${index}: opacity must be between 0 and 100` };
		}
	}

	return { valid: true, error: null };
}

/**
 * Validates an image URL
 * @param {string} url - The URL to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validate_image_url(url) {
	if (!url || typeof url !== 'string') {
		return { valid: false, error: 'Invalid URL' };
	}

	// Basic URL format validation
	try {
		const parsed = new URL(url);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
		}
	} catch (e) {
		return { valid: false, error: 'Invalid URL format' };
	}

	// Check for suspicious patterns
	if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.') || url.includes('10.0.') || url.includes('172.16.')) {
		return { valid: false, error: 'Local/private URLs are not allowed' };
	}

	return { valid: true, error: null };
}

/**
 * Validates a data URL
 * @param {string} dataUrl - The data URL to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validate_data_url(dataUrl) {
	if (!dataUrl || typeof dataUrl !== 'string') {
		return { valid: false, error: 'Invalid data URL' };
	}

	// Check format: data:[<mediatype>][;base64],<data>
	const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.+)$/);
	if (!match) {
		return { valid: false, error: 'Invalid data URL format' };
	}

	const mimeType = match[1].toLowerCase();
	const isBase64 = match[2] === ';base64';
	const data = match[3];

	// Check MIME type
	if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
		return { valid: false, error: 'Unsupported image type in data URL' };
	}

	// Estimate size (base64 is ~33% larger than binary)
	const estimatedSize = isBase64 ? data.length * 0.75 : data.length;
	if (estimatedSize > MAX_FILE_SIZE) {
		return { valid: false, error: `Data URL exceeds maximum size of ${format_bytes(MAX_FILE_SIZE)}` };
	}

	return { valid: true, error: null };
}

/**
 * Sanitizes a filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitize_filename(filename) {
	if (!filename || typeof filename !== 'string') {
		return 'unnamed';
	}

	// Drop ".." path segments (path traversal) and replace slashes and backslashes
	filename = filename.split(/[\/\\]/).filter(function (part) {
		return part !== '..';
	}).join('_');
	// Remove any remaining multiple dots
	filename = filename.replace(/\.{2,}/g, '.');

	// Remove control characters
	// eslint-disable-next-line no-control-regex -- stripping control chars from filenames is the intent
	filename = filename.replace(/[\x00-\x1F\x7F]/g, '');

	// Limit length
	if (filename.length > 255) {
		const ext = get_file_extension(filename);
		const name = filename.substring(0, 255 - ext.length);
		filename = name + ext;
	}

	return filename || 'unnamed';
}

/**
 * Gets file extension from filename
 * @param {string} filename
 * @returns {string}
 */
function get_file_extension(filename) {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1) return '';
	return filename.substring(lastDot).toLowerCase();
}

/**
 * Formats bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
function format_bytes(bytes) {
	if (bytes >= 1024 * 1024 * 1024) {
		return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
	}
	if (bytes >= 1024 * 1024) {
		return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
	}
	if (bytes >= 1024) {
		return (bytes / 1024).toFixed(2) + ' KB';
	}
	return bytes + ' B';
}

/**
 * Validates layer name input
 * @param {string} name
 * @returns {{valid: boolean, error: string|null, sanitized: string}}
 */
export function validate_layer_name(name) {
	if (!name || typeof name !== 'string') {
		return { valid: false, error: 'Layer name is required', sanitized: '' };
	}

	const sanitized = name.trim().substring(0, 200);
	
	if (sanitized.length === 0) {
		return { valid: false, error: 'Layer name cannot be empty', sanitized: '' };
	}

	// Check for potentially dangerous characters
	if (/[<>\"'&]/.test(sanitized)) {
		return { valid: false, error: 'Layer name contains invalid characters', sanitized: sanitized.replace(/[<>\"'&]/g, '_') };
	}

	return { valid: true, error: null, sanitized };
}

/**
 * Validates color value
 * @param {string} color
 * @returns {{valid: boolean, error: string|null}}
 */
export function validate_color(color) {
	if (!color || typeof color !== 'string') {
		return { valid: false, error: 'Invalid color value' };
	}

	// Hex color
	if (color.startsWith('#')) {
		const hex = color.substring(1);
		if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(hex)) {
			return { valid: false, error: 'Invalid hex color format' };
		}
		return { valid: true, error: null };
	}

	// RGB/RGBA
	const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
	if (rgbMatch) {
		const r = parseInt(rgbMatch[1]);
		const g = parseInt(rgbMatch[2]);
		const b = parseInt(rgbMatch[3]);
		if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
			return { valid: false, error: 'RGB values must be 0-255' };
		}
		if (rgbMatch[4]) {
			const a = parseFloat(rgbMatch[4]);
			if (a < 0 || a > 1) {
				return { valid: false, error: 'Alpha must be 0-1' };
			}
		}
		return { valid: true, error: null };
	}

	// Named colors (basic check)
	const namedColors = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta'];
	if (namedColors.includes(color.toLowerCase())) {
		return { valid: true, error: null };
	}

	return { valid: false, error: 'Unsupported color format' };
}