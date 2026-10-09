import { encode_bmp } from '../src/js/libs/bmp.js';

describe('BMP encoder', () => {
	it('writes a valid 24 bit bottom-up file with padded rows', () => {
		//2x2: top row red, green; bottom row blue, transparent
		const data = new Uint8ClampedArray([
			255, 0, 0, 255, 0, 255, 0, 255,
			0, 0, 255, 255, 0, 0, 0, 0,
		]);
		const bmp = encode_bmp({ data, width: 2, height: 2 });
		const view = new DataView(bmp.buffer);

		expect(String.fromCharCode(bmp[0], bmp[1])).toBe('BM');
		expect(bmp.length).toBe(54 + 8 * 2); //row 6 bytes padded to 8
		expect(view.getUint32(2, true)).toBe(bmp.length);
		expect(view.getInt32(18, true)).toBe(2);
		expect(view.getInt32(22, true)).toBe(2);
		expect(view.getUint16(28, true)).toBe(24);

		//bottom row is stored first: blue (BGR = 255,0,0), then transparent -> white
		expect(Array.from(bmp.slice(54, 60))).toEqual([255, 0, 0, 255, 255, 255]);
		//top row: red (0,0,255), green (0,255,0)
		expect(Array.from(bmp.slice(62, 68))).toEqual([0, 0, 255, 0, 255, 0]);
	});
});
