import {
	get_user_error_message,
	safe_execute,
	safe_execute_async,
	with_error_handling,
	safe_event_handler,
} from '../src/js/libs/error-handler.js';

describe('Error Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('get_user_error_message', () => {
		it('should return user-friendly message for network errors', () => {
			const error = new Error('Network request failed');
			expect(get_user_error_message(error)).toContain('Network error');
		});

		it('should return user-friendly message for timeout errors', () => {
			const error = new Error('Request timeout');
			expect(get_user_error_message(error)).toContain('timed out');
		});

		it('should return user-friendly message for rate limit errors', () => {
			const error = new Error('Rate limit exceeded (429)');
			expect(get_user_error_message(error)).toContain('Too many requests');
		});

		it('should return user-friendly message for auth errors', () => {
			const error = new Error('Unauthorized (401)');
			expect(get_user_error_message(error)).toContain('API key');
		});

		it('should return user-friendly message for file size errors', () => {
			const error = new Error('File too large: 100MB');
			expect(get_user_error_message(error)).toContain('too large');
		});

		it('should return user-friendly message for JSON parse errors', () => {
			const error = new Error('JSON parse error');
			expect(get_user_error_message(error)).toContain('Invalid JSON');
		});

		it('should return user-friendly message for URL blocked errors', () => {
			const error = new Error('Blocked: localhost access');
			expect(get_user_error_message(error)).toContain('cannot be accessed');
		});

		it('should return user-friendly message for image load errors', () => {
			const error = new Error('Failed to load image');
			expect(get_user_error_message(error)).toContain('Unable to read file');
		});

		it('should return user-friendly message for layer name errors', () => {
			const error = new Error('Layer name cannot be empty');
			expect(get_user_error_message(error)).toContain('cannot be empty');
		});

		it('should return user-friendly message for color errors', () => {
			const error = new Error('Invalid color format');
			expect(get_user_error_message(error)).toContain('corrupted or invalid');
		});

		it('should return user-friendly message for permission errors', () => {
			const error = new Error('Permission denied');
			expect(get_user_error_message(error)).toContain('Permission denied');
		});

		it('should return user-friendly message for unsupported features', () => {
			const error = new Error('Feature not supported in this browser');
			expect(get_user_error_message(error)).toContain('not supported');
		});

		it('should return generic message for unknown errors', () => {
			const error = new Error('Some completely unknown error');
			expect(get_user_error_message(error)).toContain('unexpected error');
		});

		it('should handle string errors', () => {
			expect(get_user_error_message('network error')).toContain('Network error');
			expect(get_user_error_message('timeout')).toContain('timed out');
		});

		it('should include context in console logging', () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
			get_user_error_message(new Error('test error'), 'MyContext');
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('MyContext'),
				expect.any(Error)
			);
			consoleSpy.mockRestore();
		});
	});

	describe('safe_execute', () => {
		it('should return result on success', () => {
			const result = safe_execute(() => 'success');
			expect(result).toBe('success');
		});

		it('should return null and show error on failure', () => {
			const alertify = require('alertifyjs');
			const result = safe_execute(() => { throw new Error('network error'); }, 'TestContext');
			expect(result).toBeNull();
			expect(alertify.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
		});
	});

	describe('safe_execute_async', () => {
		it('should return result on success', async () => {
			const result = await safe_execute_async(async () => 'async success');
			expect(result).toBe('async success');
		});

		it('should return null and show error on failure', async () => {
			const alertify = require('alertifyjs');
			const result = await safe_execute_async(async () => { throw new Error('timeout'); }, 'AsyncContext');
			expect(result).toBeNull();
			expect(alertify.error).toHaveBeenCalledWith(expect.stringContaining('timed out'));
		});
	});

	describe('with_error_handling', () => {
		it('should wrap async function and return success object', async () => {
			const wrapped = with_error_handling(async (x: number) => x * 2, 'Double');
			const result = await wrapped(5);
			expect(result).toEqual({ success: true, data: 10 });
		});

		it('should return error object on failure', async () => {
			const wrapped = with_error_handling(async () => { throw new Error('network error'); }, 'Fail');
			const result = await wrapped();
			expect(result.success).toBe(false);
			expect(result.error).toContain('Network error');
		});
	});

	describe('safe_event_handler', () => {
		it('should call handler on success', () => {
			const handler = jest.fn(() => 'result');
			const safeHandler = safe_event_handler(handler, 'ClickEvent');
			const event = { type: 'click' };
			const result = safeHandler(event);
			expect(handler).toHaveBeenCalledWith(event);
			expect(result).toBe('result');
		});

		it('should catch errors and show user-friendly message', () => {
			const handler = jest.fn(() => { throw new Error('network error'); });
			const safeHandler = safe_event_handler(handler, 'ClickEvent');
			const event = { type: 'click' };
			const alertify = require('alertifyjs');
			safeHandler(event);
			expect(alertify.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
		});
	});
});
