import { is_valid_session, is_session_fresh, MAX_AGE_MS } from '../src/js/libs/autosave.js';

const session = (extra: object = {}) => ({
	documents: [{ name: 'Untitled-1', json: '{}' }, { name: 'Photo', json: '{}' }],
	active: 1,
	time: 1000,
	...extra,
});

describe('autosave session', () => {
	it('accepts a well formed session', () => {
		expect(is_valid_session(session())).toBe(true);
	});

	it('rejects broken sessions', () => {
		expect(is_valid_session(null as never)).toBe(false);
		expect(is_valid_session(session({ documents: [] }))).toBe(false);
		expect(is_valid_session(session({ active: 2 }))).toBe(false);
		expect(is_valid_session(session({ documents: [{ name: 'x', json: 5 }] }))).toBe(false);
		expect(is_valid_session(session({ time: 'now' }))).toBe(false);
	});

	it('drops old sessions', () => {
		expect(is_session_fresh(session(), 1000 + MAX_AGE_MS)).toBe(true);
		expect(is_session_fresh(session(), 1001 + MAX_AGE_MS)).toBe(false);
	});
});
