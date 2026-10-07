import { apply_meta, read_meta, toggle_flag, change_case, replace_text } from '../src/js/libs/text-style.js';

const defaults = {size: 40, family: 'Arial', bold: false, italic: false, fill_color: '#008800', kerning: 0};
const data = () => [[{text: 'Hello ', meta: {fill_color: '#111111'}}, {text: 'world', meta: {bold: true, fill_color: '#111111'}}], [{text: 'two words', meta: {}}]];

describe('apply_meta', () => {
	it('sets the style on all spans and keeps the original untouched', () => {
		const source = data();
		const result = apply_meta(source, {size: 20, italic: true}, defaults);
		expect(result[0][0].meta).toEqual({fill_color: '#111111', size: 20, italic: true});
		expect(result[0][1].meta.bold).toBe(true);
		expect(source[0][0].meta).toEqual({fill_color: '#111111'});
	});
	it('does not store values equal to the defaults', () => {
		const result = apply_meta(data(), {size: 40, bold: false}, defaults);
		expect(result[0]).toEqual([{text: 'Hello world', meta: {fill_color: '#111111'}}]);
	});
	it('stores the color even when it equals the default', () => {
		const result = apply_meta(data(), {fill_color: '#008800'}, defaults);
		expect(result[1][0].meta).toEqual({fill_color: '#008800'});
	});
});

describe('read_meta', () => {
	it('returns the style of the first span with text over the defaults', () => {
		expect(read_meta(data(), defaults)).toEqual({...defaults, fill_color: '#111111'});
	});
	it('works for an empty layer', () => {
		expect(read_meta([[{text: '', meta: {size: 10}}]], defaults).size).toBe(10);
		expect(read_meta(null, defaults).size).toBe(40);
	});
});

describe('toggle_flag', () => {
	it('turns a flag on when some text lacks it and off when all have it', () => {
		const on = toggle_flag(data(), 'bold', defaults);
		expect(on.every((line) => line.every((span) => span.meta.bold === true))).toBe(true);
		const off = toggle_flag(on, 'bold', defaults);
		expect(off.every((line) => line.every((span) => !span.meta.bold))).toBe(true);
	});
});

describe('change_case', () => {
	it('changes upper, lower and title case without touching the style', () => {
		expect(change_case(data(), 'upper')[0][1]).toEqual({text: 'WORLD', meta: {bold: true, fill_color: '#111111'}});
		expect(change_case(data(), 'lower')[0][0].text).toBe('hello ');
		expect(change_case(data(), 'title')[1][0].text).toBe('Two Words');
	});
});

describe('replace_text', () => {
	it('puts new text into lines with the style of the first span', () => {
		const result = replace_text(data(), 'a\nb');
		expect(result).toEqual([[{text: 'a', meta: {fill_color: '#111111'}}], [{text: 'b', meta: {fill_color: '#111111'}}]]);
	});
});

import { order_range, is_empty_range } from '../src/js/libs/text-style.js';

describe('a range of the text', () => {
	const range = (a: number, b: number, line = 0, end_line = line) => ({start: {line, character: a}, end: {line: end_line, character: b}});
	const simple = () => [[{text: 'Hello world', meta: {fill_color: '#111111'}}], [{text: 'second line', meta: {}}]];

	it('cuts a span and styles only the range', () => {
		const result = apply_meta(simple(), {bold: true}, defaults, range(6, 11));
		expect(result[0]).toEqual([
			{text: 'Hello ', meta: {fill_color: '#111111'}},
			{text: 'world', meta: {fill_color: '#111111', bold: true}},
		]);
		expect(result[1]).toEqual([{text: 'second line', meta: {}}]);
	});
	it('accepts a selection made backwards and spans over lines', () => {
		expect(order_range(range(5, 2)).first.character).toBe(2);
		const result = apply_meta(simple(), {italic: true}, defaults, {start: {line: 1, character: 6}, end: {line: 0, character: 8}});
		expect(result[0].map((span) => span.text)).toEqual(['Hello wo', 'rld']);
		expect(result[0][1].meta.italic).toBe(true);
		expect(result[1].map((span) => span.text)).toEqual(['second', ' line']);
		expect(result[1][0].meta.italic).toBe(true);
	});
	it('joins the pieces again when the style is taken back', () => {
		const bold = apply_meta(simple(), {bold: true}, defaults, range(0, 5));
		const back = apply_meta(bold, {bold: false}, defaults, range(0, 5));
		expect(back[0]).toEqual([{text: 'Hello world', meta: {fill_color: '#111111'}}]);
	});
	it('toggles and changes case only in the range', () => {
		const toggled = toggle_flag(simple(), 'bold', defaults, range(0, 5));
		expect(toggled[0][0]).toEqual({text: 'Hello', meta: {fill_color: '#111111', bold: true}});
		expect(change_case(simple(), 'upper', range(6, 11))[0].map((span) => span.text).join('')).toBe('Hello WORLD');
	});
	it('reads the style of the beginning of the range and knows an empty range', () => {
		const data = apply_meta(simple(), {size: 10}, defaults, range(6, 11));
		expect(read_meta(data, defaults, range(6, 11)).size).toBe(10);
		expect(read_meta(data, defaults, range(0, 5)).size).toBe(40);
		expect(is_empty_range(range(3, 3))).toBe(true);
	});
});
