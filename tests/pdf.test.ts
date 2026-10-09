import { build_pdf } from '../src/js/libs/pdf.js';

const text = (bytes: Uint8Array) => Array.from(bytes).map((b) => String.fromCharCode(b)).join('');

describe('pdf writer', () => {
	const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
	const pdf = build_pdf(jpeg, 100, 50, 72, 36);
	const source = text(pdf);

	it('has the PDF structure', () => {
		expect(source.startsWith('%PDF-1.4')).toBe(true);
		expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
		expect(source).toContain('/Filter /DCTDecode /Length 7');
		expect(source).toContain('/MediaBox [0 0 72 36]');
	});

	it('startxref points to the xref table and object offsets are right', () => {
		const start = parseInt(/startxref\n(\d+)/.exec(source)![1], 10);
		expect(source.slice(start, start + 4)).toBe('xref');
		const entries = source.slice(start).match(/\d{10} 00000 n /g)!;
		expect(entries).toHaveLength(5);
		entries.forEach((entry, index) => {
			const offset = parseInt(entry.slice(0, 10), 10);
			expect(source.slice(offset, offset + 7)).toBe((index + 1) + ' 0 obj');
		});
	});

	it('keeps the JPEG bytes intact', () => {
		const at = source.indexOf('stream\n', source.indexOf('/Subtype /Image')) + 7;
		expect(Array.from(pdf.slice(at, at + 7))).toEqual(Array.from(jpeg));
	});
});
