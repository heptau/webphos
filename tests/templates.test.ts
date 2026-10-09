import { clean_template_name } from '../src/js/libs/templates.js';

describe('template names', () => {
	it('removes control characters and angle brackets and shortens long names', () => {
		expect(clean_template_name('  Poster <b>\n 1 ')).toBe('Poster b 1');
		expect(clean_template_name('x'.repeat(100))).toHaveLength(60);
		expect(clean_template_name(undefined as never)).toBe('');
	});
});
