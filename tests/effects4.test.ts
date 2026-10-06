import { surface_blur, hdr_toning, white_balance, find_palette, reduce_to_palette, adjustment_to_cube } from '../src/js/libs/effects4.js';
import { parse_cube, lookup } from '../src/js/libs/lut.js';
import { invert } from '../src/js/libs/adjustments.js';

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

describe('effects 4', () => {
  it('surface blur smooths small noise but keeps a strong edge', () => {
    const img = image(40, 20, (x, y) => (x < 20 ? [100 + ((x + y) % 2) * 8, 100, 100] : [220 + ((x + y) % 2) * 8, 220, 220]));
    surface_blur(img, 5, 20);
    const flat = Math.abs(px(img, 5, 5)[0] - px(img, 6, 5)[0]);
    expect(flat).toBeLessThan(8);
    expect(px(img, 18, 10)[0]).toBeLessThan(130);
    expect(px(img, 22, 10)[0]).toBeGreaterThan(200);
  });

  it('hdr toning increases local contrast', () => {
    const img = image(40, 20, (x) => (x < 20 ? [110, 110, 110] : [140, 140, 140]));
    hdr_toning(img, 8, 80, 0);
    expect(px(img, 21, 10)[0] - px(img, 18, 10)[0]).toBeGreaterThan(30);
  });

  it('white balance makes the chosen color gray', () => {
    const img = image(2, 1, () => [200, 150, 100]);
    white_balance(img, '#c89664', 100);
    const [r, g, b] = px(img, 0, 0);
    expect(Math.abs(r - g)).toBeLessThan(4);
    expect(Math.abs(g - b)).toBeLessThan(4);
  });

  it('finds a palette and reduces the picture to it', () => {
    const img = image(20, 20, (x) => (x < 10 ? [250, 10, 10] : [10, 10, 250]));
    const palette = find_palette(img, 2);
    expect(palette).toHaveLength(2);
    const used = reduce_to_palette(img, 2, true);
    expect(used).toHaveLength(2);
    const colors = new Set(Array.from({ length: 400 }, (_, k) => img.data.slice(k * 4, k * 4 + 3).join(',')));
    expect(colors.size).toBeLessThanOrEqual(2);
  });

  it('turns an adjustment into a .cube file that the parser reads back', () => {
    const text = adjustment_to_cube((img: never) => invert(img), 5, 'inverted');
    const lut = parse_cube(text)!;
    expect(lut.size).toBe(5);
    const out = lookup(lut, 1, 0, 0.5);
    expect(out[0]).toBeCloseTo(0, 2);
    expect(out[1]).toBeCloseTo(1, 2);
    expect(out[2]).toBeCloseTo(0.5, 1);
  });
});
