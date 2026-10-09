import { defringe, blur_background, sharpen_edges, reduce_color_noise, sprite_layout, print_tiles } from '../src/js/libs/effects3.js';

function image(width: number, height: number, fill: (x: number, y: number) => number[]) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const [r, g, b, a = 255] = fill(x, y);
			const i = (y * width + x) * 4;
			data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
		}
	}
	return { data, width, height };
}
const px = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('retouch helpers', () => {
	it('defringe repaints the edge with the color of the object', () => {
		//red object, a half transparent white fringe, transparent outside
		const img = image(12, 4, (x) => (x < 5 ? [200, 20, 20, 255] : x == 5 ? [255, 255, 255, 120] : [0, 0, 0, 0]));
		defringe(img, 2);
		const fringe = px(img, 5, 1);
		expect(fringe[0]).toBeGreaterThan(180);
		expect(fringe[1]).toBeLessThan(60);
		expect(fringe[3]).toBe(120);
	});

	it('background blur keeps the subject and blurs the background', () => {
		const img = image(40, 40, (x, y) => {
			if (x > 14 && x < 26 && y > 14 && y < 26) return [0, 0, 0];
			//a calm background with one dark speck
			return x == 3 && y == 3 ? [150, 150, 150] : [230, 230, 230];
		});
		blur_background(img, 6, 100, 0);
		expect(px(img, 20, 20)[0]).toBe(0);
		expect(px(img, 3, 3)[0]).toBeGreaterThan(190);
	});

	it('edge sharpening changes pixels at an edge but not in a flat area', () => {
		const img = image(30, 10, (x) => (x < 15 ? [90, 90, 90] : [170, 170, 170]));
		sharpen_edges(img, 200, 60);
		expect(px(img, 14, 5)[0]).toBeLessThan(90);
		expect(px(img, 2, 5)[0]).toBe(90);
	});

	it('color noise reduction keeps brightness and smooths the color', () => {
		const img = image(20, 20, (x, y) => ((x + y) % 2 ? [150, 120, 120] : [120, 150, 120]));
		const before = px(img, 10, 10);
		reduce_color_noise(img, 3, 100);
		const after = px(img, 10, 10);
		expect(Math.abs(after[0] - after[1])).toBeLessThan(Math.abs(before[0] - before[1]));
		expect(Math.abs(after[3] - 255)).toBe(0);
	});
});

describe('layouts', () => {
	it('sprite sheet puts items into equal cells', () => {
		const layout = sprite_layout([{ width: 10, height: 10 }, { width: 20, height: 10 }, { width: 10, height: 30 }], 2, 1);
		expect(layout.cell).toEqual({ width: 20, height: 30 });
		expect(layout.width).toBe(2 * 22);
		expect(layout.height).toBe(2 * 32);
		//the small first sprite is centered in its cell
		expect(layout.items[0]).toEqual({ x: 1 + 5, y: 1 + 10 });
		expect(layout.items[2].y).toBeGreaterThan(layout.items[0].y);
	});

	it('print tiles cover the picture with overlap', () => {
		const tiles = print_tiles(250, 100, 100, 100, 10);
		expect(tiles.map((t) => t.x)).toEqual([0, 90, 180]);
		expect(tiles[2].width).toBe(70);
		expect(tiles.every((t) => t.y == 0 && t.height == 100)).toBe(true);
		expect(print_tiles(50, 50, 100, 100, 0)).toHaveLength(1);
	});
});
