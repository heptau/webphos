import { replace_in_text_data } from '../src/js/libs/text-replace.js';

describe('text replace', () => {
	const data = [[{ text: 'Hello world, ', meta: { bold: true } }, { text: 'WORLD', meta: {} }], [{ text: 'no match', meta: {} }]];

	it('replaces in all spans and keeps the style', () => {
		const result = replace_in_text_data(data, 'world', 'Mars', false);
		expect(result.count).toBe(2);
		expect(result.data[0][0]).toEqual({ text: 'Hello Mars, ', meta: { bold: true } });
		expect((result.data[0][1] as { text: string }).text).toBe('Mars');
		//the original is not changed
		expect((data[0][0] as { text: string }).text).toBe('Hello world, ');
	});

	it('respects the case option and treats special characters as text', () => {
		expect(replace_in_text_data(data, 'world', 'x', true).count).toBe(1);
		const special = replace_in_text_data([[{ text: 'a.b (c)', meta: {} }]], '.b (', '-', true);
		expect((special.data[0][0] as { text: string }).text).toBe('a-c)');
	});
});
