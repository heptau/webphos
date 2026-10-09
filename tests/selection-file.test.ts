import {
	serialize_selections, parse_selections, unique_name, mask_to_pixels, image_to_mask, FILE_FORMAT,
} from '../src/js/libs/selection-file.js';
import { rect_mask, create_mask, feather_mask } from '../src/js/libs/selection-mask.js';

describe('selections file', () => {
	it('round-trips hard and soft masks', () => {
		const hard = rect_mask({ x: 5, y: 5, width: 10, height: 8 }, 40, 30);
		const soft = feather_mask(hard, 4);
		const text = serialize_selections([{ name: 'hard', mask: hard }, { name: 'soft', mask: soft }]);
		const file = JSON.parse(text);
		expect(file.format).toBe(FILE_FORMAT);
		expect(file.selections[0].encoding).toBe('rle');
		const parsed = parse_selections(text);
		expect(parsed.error).toBeNull();
		expect(parsed.skipped).toBe(0);
		expect(parsed.selections.map((s: any) => s.name)).toEqual(['hard', 'soft']);
		expect(Array.from(parsed.selections[0].mask.data)).toEqual(Array.from(hard.data));
		expect(Array.from(parsed.selections[1].mask.data)).toEqual(Array.from(soft.data));
	});

	it('rejects wrong files without throwing', () => {
		expect(parse_selections('not json').error).toBe('not_json');
		expect(parse_selections('{"a":1}').error).toBe('wrong_format');
		expect(parse_selections('null').error).toBe('wrong_format');
		expect(parse_selections(JSON.stringify({ format: FILE_FORMAT, version: 99, selections: [] })).error).toBe('newer_version');
		expect(parse_selections(JSON.stringify({ format: FILE_FORMAT, version: 1, selections: 'x' })).error).toBe('wrong_format');
	});

	it('skips invalid entries and keeps the valid ones', () => {
		const good = JSON.parse(serialize_selections([{ name: 'ok', mask: create_mask(4, 4, 255) }])).selections[0];
		const text = JSON.stringify({ format: FILE_FORMAT, version: 1, selections: [
			good,
			{ name: 'bad size', width: 4, height: 4, encoding: 'rle', values: [1], counts: [3] },
			{ name: '', width: 4, height: 4, encoding: 'rle', values: [1], counts: [16] },
			{ width: 4, height: 4 },
			null,
			{ name: 'huge', width: 1e9, height: 1e9, encoding: 'raw', data: '' },
			{ name: 'bad base64', width: 2, height: 2, encoding: 'raw', data: '***' },
		] });
		const parsed = parse_selections(text);
		expect(parsed.selections.map((s: any) => s.name)).toEqual(['ok']);
		expect(parsed.skipped).toBe(6);
	});

	it('limits name length and the number of selections', () => {
		const entry = (name: string) => ({ name, width: 2, height: 2, encoding: 'rle', values: [255], counts: [4] });
		const long = parse_selections(JSON.stringify({ format: FILE_FORMAT, version: 1, selections: [entry('x'.repeat(500))] }));
		expect(long.selections[0].name.length).toBe(100);
		const many = parse_selections(JSON.stringify({ format: FILE_FORMAT, version: 1, selections: Array.from({ length: 250 }, (_, i) => entry('s' + i)) }));
		expect(many.selections.length).toBe(200);
		expect(many.skipped).toBe(50);
	});

	it('stores noisy masks raw (base64) and restores them', () => {
		const noisy = create_mask(16, 16);
		for (let i = 0; i < noisy.data.length; i++) noisy.data[i] = (i * 53) % 256;
		const file = JSON.parse(serialize_selections([{ name: 'n', mask: noisy }]));
		expect(file.selections[0].encoding).toBe('raw');
		expect(typeof file.selections[0].data).toBe('string');
		const parsed = parse_selections(JSON.stringify(file));
		expect(Array.from(parsed.selections[0].mask.data)).toEqual(Array.from(noisy.data));
	});
});

describe('helpers', () => {
	it('makes names unique', () => {
		expect(unique_name('a', [])).toBe('a');
		expect(unique_name('a', ['a'])).toBe('a (2)');
		expect(unique_name('a', ['a', 'a (2)', 'a (3)'])).toBe('a (4)');
	});
});

describe('mask images', () => {
	it('converts a mask to opaque gray pixels', () => {
		const pixels = mask_to_pixels({ width: 2, height: 1, data: Uint8ClampedArray.from([0, 200]) });
		expect(Array.from(pixels)).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
	});

	it('uses brightness for opaque images and alpha for transparent ones', () => {
		const opaque = { width: 2, height: 1, data: Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 255]) };
		expect(Array.from(image_to_mask(opaque).data)).toEqual([255, 0]);
		const cutout = { width: 2, height: 1, data: Uint8ClampedArray.from([10, 20, 30, 255, 200, 200, 200, 0]) };
		expect(Array.from(image_to_mask(cutout).data)).toEqual([255, 0]);
	});

	it('round-trips a mask through an image', () => {
		const mask = feather_mask(rect_mask({ x: 4, y: 4, width: 8, height: 8 }, 20, 20), 3);
		const pixels = mask_to_pixels(mask);
		const back = image_to_mask({ width: 20, height: 20, data: pixels });
		for (let i = 0; i < mask.data.length; i++) expect(Math.abs(back.data[i] - mask.data[i])).toBeLessThanOrEqual(1);
	});
});
