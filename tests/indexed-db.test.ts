import {
	is_indexeddb_available,
	get_storage_estimate,
} from '../src/js/libs/indexed-db.js';

describe('IndexedDB Module', () => {
	describe('is_indexeddb_available', () => {
		it('should return boolean', () => {
			const result = is_indexeddb_available();
			expect(typeof result).toBe('boolean');
		});
	});

	describe('get_storage_estimate', () => {
		it('should return storage estimate object', async () => {
			const result = await get_storage_estimate();
			expect(result).toHaveProperty('usage');
			expect(result).toHaveProperty('quota');
			expect(result).toHaveProperty('usagePercent');
			expect(typeof result.usage).toBe('number');
			expect(typeof result.quota).toBe('number');
			expect(typeof result.usagePercent).toBe('number');
		});
	});
});
