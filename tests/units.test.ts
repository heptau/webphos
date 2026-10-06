import { to_pixels, from_pixels, dpi_for, convert_size, clamp_dpi, is_unit } from '../src/js/libs/units.js';

describe('units', () => {
	test('A4 at 96 dpi', () => {
		expect(to_pixels(210, 'millimetres', 96)).toBe(794);
		expect(to_pixels(297, 'millimetres', 96)).toBe(1123);
	});

	test('pixels, inches, points and picas', () => {
		expect(to_pixels(100, 'pixels', 300)).toBe(100);
		expect(to_pixels(2, 'inches', 300)).toBe(600);
		expect(to_pixels(72, 'points', 300)).toBe(300);
		expect(to_pixels(6, 'picas', 300)).toBe(300);
	});

	test('from_pixels is the inverse of to_pixels', () => {
		expect(from_pixels(600, 'inches', 300)).toBe(2);
		expect(from_pixels(300, 'centimeters', 300)).toBe(2.54);
		expect(from_pixels(123.4, 'pixels', 72)).toBe(123);
	});

	test('dpi for a physical size keeps the pixels', () => {
		expect(dpi_for(794, 210, 'millimetres')).toBe(96.04);
		expect(dpi_for(300, 1, 'inches')).toBe(300);
		expect(dpi_for(300, 0, 'inches')).toBeNaN();
		expect(dpi_for(300, 5, 'pixels')).toBeNaN();
	});

	test('conversion between units keeps the physical size', () => {
		expect(convert_size(1, 'inches', 'millimetres', 96)).toBe(25.4);
		expect(convert_size(25.4, 'millimetres', 'inches', 300)).toBe(1);
		expect(convert_size(210, 'millimetres', 'pixels', 96)).toBe(794);
	});

	test('invalid input', () => {
		expect(to_pixels('abc' as unknown as number, 'inches', 72)).toBeNaN();
		expect(to_pixels(1, 'furlongs', 72)).toBeNaN();
		expect(clamp_dpi(-5)).toBe(72);
		expect(clamp_dpi(99999)).toBe(2400);
		expect(is_unit('toString')).toBe(false);
	});
});
