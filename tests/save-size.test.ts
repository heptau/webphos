jest.mock('../src/js/libs/canvastotiff.js', () => ({ __esModule: true, default: {} }));
jest.mock('../src/js/modules/file/save-helpers.js', () => ({}));
jest.mock('../src/js/config.js', () => ({ __esModule: true, default: {} }));

import File_save_size_class from '../src/js/modules/file/save-size.js';

describe('export dialog file size', () => {
	const owner = {Helper: {number_format: (value: number, digits: number) => value.toFixed(digits)}};

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('writes the size into the dialog', () => {
		document.body.innerHTML = '<span id="file_size">-</span>';
		const size = new File_save_size_class(owner);
		size.update_file_size(2048);
		expect(document.getElementById('file_size')!.innerHTML).toBe('2.00 KB');
		size.update_file_size('...');
		expect(document.getElementById('file_size')!.innerHTML).toBe('...');
	});

	it('does not fail when the dialog was closed before the size was known', () => {
		const size = new File_save_size_class(owner);
		expect(() => size.update_file_size(1234)).not.toThrow();
		expect(() => size.update_file_size('-')).not.toThrow();
	});
});
