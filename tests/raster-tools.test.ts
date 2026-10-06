import { is_tool_disabled } from '../src/js/libs/raster-tools.js';

describe('raster-only tools', () => {
	test('are disabled on vector layers', () => {
		expect(is_tool_disabled('blur', {type: 'text', is_vector: true})).toBe(true);
		expect(is_tool_disabled('fill', {type: 'rectangle', is_vector: true})).toBe(true);
	});

	test('work on image layers and on the empty layer', () => {
		expect(is_tool_disabled('blur', {type: 'image', is_vector: false})).toBe(false);
		expect(is_tool_disabled('fill', {type: null, is_vector: false})).toBe(false);
	});

	test('fill and erase refuse an image that is still vector', () => {
		expect(is_tool_disabled('fill', {type: 'image', is_vector: true})).toBe(true);
		expect(is_tool_disabled('blur', {type: 'image', is_vector: true})).toBe(false);
	});

	test('other tools are never disabled', () => {
		expect(is_tool_disabled('text', {type: 'text', is_vector: true})).toBe(false);
		expect(is_tool_disabled('hand', {type: 'rectangle', is_vector: true})).toBe(false);
		expect(is_tool_disabled('blur', null)).toBe(false);
	});
});
