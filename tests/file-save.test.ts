import { picker_types, can_use_file_picker } from '../src/js/libs/file-save.js';

describe('file save', () => {
	it('builds the type filter of the save dialog from the file name', () => {
		expect(picker_types('photo.PNG')).toEqual([{ description: 'PNG', accept: { 'image/png': ['.png'] } }]);
		expect(picker_types('doc.pdf')?.[0].accept).toEqual({ 'application/pdf': ['.pdf'] });
		expect(picker_types('noextension')).toBeUndefined();
		expect(picker_types('file.xyz')).toBeUndefined();
	});

	it('knows that the picker is not available in a plain test environment', () => {
		expect(can_use_file_picker()).toBe(false);
	});
});
