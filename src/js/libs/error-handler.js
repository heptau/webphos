/**
 * Error handling utilities - prevents information leakage
 * 
 * @author ViliusL
 */

// Error codes for user-friendly messages
const ERROR_MESSAGES = {
	// Network errors
	NETWORK_ERROR: 'Network error. Please check your connection and try again.',
	TIMEOUT_ERROR: 'Request timed out. Please try again.',
	
	// API errors
	API_ERROR: 'Service temporarily unavailable. Please try again later.',
	API_RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
	API_KEY_MISSING: 'API key not configured. Please contact administrator.',
	
	// File errors
	FILE_TOO_LARGE: 'File is too large. Maximum size is 50MB.',
	FILE_INVALID_TYPE: 'Invalid file type. Please select a valid image file.',
	FILE_CORRUPT: 'File appears to be corrupted or invalid.',
	FILE_READ_ERROR: 'Unable to read file. Please try again.',
	
	// JSON errors
	JSON_INVALID: 'Invalid JSON file format.',
	JSON_STRUCTURE: 'JSON file structure is not compatible.',
	JSON_TOO_LARGE: 'JSON file is too large.',
	
	// URL errors
	URL_INVALID: 'Invalid URL format.',
	URL_BLOCKED: 'This URL cannot be accessed for security reasons.',
	URL_NOT_FOUND: 'Resource not found at the specified URL.',
	URL_NO_IMAGE: 'No image found at the specified URL.',
	
	// Data URL errors
	DATA_URL_INVALID: 'Invalid data URL format.',
	DATA_URL_TOO_LARGE: 'Data URL exceeds maximum size.',
	
	// Image errors
	IMAGE_LOAD_FAILED: 'Failed to load image. The file may be corrupted or unsupported.',
	IMAGE_DIMENSIONS: 'Image dimensions exceed maximum allowed size.',
	
	// Layer errors
	LAYER_NAME_EMPTY: 'Layer name cannot be empty.',
	LAYER_NAME_INVALID: 'Layer name contains invalid characters.',
	LAYER_NAME_TOO_LONG: 'Layer name is too long (maximum 200 characters).',
	LAYER_LIMIT: 'Maximum number of layers reached.',
	
	// Color errors
	COLOR_INVALID: 'Invalid color value.',
	
	// General errors
	UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
	OPERATION_CANCELLED: 'Operation was cancelled.',
	PERMISSION_DENIED: 'Permission denied. Please check browser settings.',
	FEATURE_NOT_SUPPORTED: 'This feature is not supported in your browser.',
};

/**
 * Gets a user-friendly error message
 * @param {Error|string} error - The error object or message
 * @param {string} context - Optional context for debugging (not shown to user)
 * @returns {string} - User-friendly error message
 */
export function get_user_error_message(error, context = '') {
	// Log the actual error for debugging (server-side or console)
	if (typeof console !== 'undefined' && console.error) {
		console.error(`[Error${context ? ' - ' + context : ''}]:`, error);
	}

	// If it's a string, check if it matches known patterns
	if (typeof error === 'string') {
		const lowerError = error.toLowerCase();
		
		// Network errors
		if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
			return ERROR_MESSAGES.NETWORK_ERROR;
		}
		if (lowerError.includes('timeout')) {
			return ERROR_MESSAGES.TIMEOUT_ERROR;
		}
		
		// API errors
		if (lowerError.includes('rate limit') || lowerError.includes('too many requests') || lowerError.includes('429')) {
			return ERROR_MESSAGES.API_RATE_LIMIT;
		}
		if (lowerError.includes('api key') || lowerError.includes('unauthorized') || lowerError.includes('401') || lowerError.includes('403')) {
			return ERROR_MESSAGES.API_KEY_MISSING;
		}
		if (lowerError.includes('api') || lowerError.includes('service')) {
			return ERROR_MESSAGES.API_ERROR;
		}
		
		// File errors
		if (lowerError.includes('file') && (lowerError.includes('large') || lowerError.includes('size'))) {
			return ERROR_MESSAGES.FILE_TOO_LARGE;
		}
		if (lowerError.includes('file') && (lowerError.includes('type') || lowerError.includes('format'))) {
			return ERROR_MESSAGES.FILE_INVALID_TYPE;
		}
		if (lowerError.includes('corrupt') || lowerError.includes('invalid')) {
			return ERROR_MESSAGES.FILE_CORRUPT;
		}
		if (lowerError.includes('read') || lowerError.includes('load')) {
			return ERROR_MESSAGES.FILE_READ_ERROR;
		}
		
		// JSON errors
		if (lowerError.includes('json') && lowerError.includes('parse')) {
			return ERROR_MESSAGES.JSON_INVALID;
		}
		if (lowerError.includes('json') && lowerError.includes('structure')) {
			return ERROR_MESSAGES.JSON_STRUCTURE;
		}
		
		// URL errors
		if (lowerError.includes('url') && lowerError.includes('invalid')) {
			return ERROR_MESSAGES.URL_INVALID;
		}
		if (lowerError.includes('blocked') || lowerError.includes('private') || lowerError.includes('localhost') || lowerError.includes('internal')) {
			return ERROR_MESSAGES.URL_BLOCKED;
		}
		if (lowerError.includes('not found') || lowerError.includes('404')) {
			return ERROR_MESSAGES.URL_NOT_FOUND;
		}
		
		// Data URL errors
		if (lowerError.includes('data url') || lowerError.includes('data:')) {
			if (lowerError.includes('large') || lowerError.includes('size')) {
				return ERROR_MESSAGES.DATA_URL_TOO_LARGE;
			}
			return ERROR_MESSAGES.DATA_URL_INVALID;
		}
		
		// Image errors
		if (lowerError.includes('image') && (lowerError.includes('load') || lowerError.includes('failed'))) {
			return ERROR_MESSAGES.IMAGE_LOAD_FAILED;
		}
		if (lowerError.includes('dimension') || lowerError.includes('width') || lowerError.includes('height')) {
			return ERROR_MESSAGES.IMAGE_DIMENSIONS;
		}
		
		// Layer errors
		if (lowerError.includes('layer') && lowerError.includes('name')) {
			if (lowerError.includes('empty')) {
				return ERROR_MESSAGES.LAYER_NAME_EMPTY;
			}
			if (lowerError.includes('invalid') || lowerError.includes('character')) {
				return ERROR_MESSAGES.LAYER_NAME_INVALID;
			}
			if (lowerError.includes('long') || lowerError.includes('length')) {
				return ERROR_MESSAGES.LAYER_NAME_TOO_LONG;
			}
		}
		if (lowerError.includes('layer') && lowerError.includes('limit')) {
			return ERROR_MESSAGES.LAYER_LIMIT;
		}
		
		// Color errors
		if (lowerError.includes('color')) {
			return ERROR_MESSAGES.COLOR_INVALID;
		}
		
		// Permission errors
		if (lowerError.includes('permission') || lowerError.includes('denied')) {
			return ERROR_MESSAGES.PERMISSION_DENIED;
		}
		
		// Feature not supported
		if (lowerError.includes('not supported') || lowerError.includes('unsupported')) {
			return ERROR_MESSAGES.FEATURE_NOT_SUPPORTED;
		}
	}
	
	// If it's an Error object
	if (error instanceof Error) {
		return get_user_error_message(error.message, context);
	}
	
	// Default fallback
	return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - The async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} - Wrapped function that returns { success: boolean, data?: any, error?: string }
 */
export function with_error_handling(fn, context = '') {
	return async function(...args) {
		try {
			const data = await fn.apply(this, args);
			return { success: true, data };
		} catch (error) {
			const userMessage = get_user_error_message(error, context);
			return { success: false, error: userMessage };
		}
	};
}

/**
 * Creates a safe error handler for event listeners
 * @param {Function} handler - The event handler
 * @param {string} context - Context for error logging
 * @returns {Function} - Safe event handler
 */
export function safe_event_handler(handler, context = '') {
	return function(event) {
		try {
			return handler.call(this, event);
		} catch (error) {
			const userMessage = get_user_error_message(error, context + ' - event handler');
			if (typeof alertify !== 'undefined') {
				alertify.error(userMessage);
			} else if (typeof console !== 'undefined') {
				console.error(userMessage);
			}
		}
	};
}

/**
 * Safely executes a function and shows user-friendly error
 * @param {Function} fn - Function to execute
 * @param {string} context - Context for error logging
 */
export function safe_execute(fn, context = '') {
	try {
		return fn();
	} catch (error) {
		const userMessage = get_user_error_message(error, context);
		if (typeof alertify !== 'undefined') {
			alertify.error(userMessage);
		} else if (typeof console !== 'undefined') {
			console.error(userMessage);
		}
		return null;
	}
}

/**
 * Safely executes an async function and shows user-friendly error
 * @param {Function} fn - Async function to execute
 * @param {string} context - Context for error logging
 * @returns {Promise<any>} - Result or null on error
 */
export async function safe_execute_async(fn, context = '') {
	try {
		return await fn();
	} catch (error) {
		const userMessage = get_user_error_message(error, context);
		if (typeof alertify !== 'undefined') {
			alertify.error(userMessage);
		} else if (typeof console !== 'undefined') {
			console.error(userMessage);
		}
		return null;
	}
}