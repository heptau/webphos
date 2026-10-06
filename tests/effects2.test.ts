import { vignette, dehaze, tilt_shift, split_toning, chromatic_aberration, halftone, film_grain, dust_scratches, blur_rgba } from '../src/js/libs/effects2.js';

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

describe('effects', () => {
  it('vignette darkens the corners and keeps the center', () => {
    const img = image(40, 40, () => [200, 200, 200]);
    vignette(img, 80, 30, 40);
    expect(px(img, 0, 0)[0]).toBeLessThan(120);
    expect(px(img, 20, 20)[0]).toBe(200);
  });

  it('negative vignette lightens the corners', () => {
    const img = image(40, 40, () => [100, 100, 100]);
    vignette(img, -80, 30, 40);
    expect(px(img, 0, 0)[0]).toBeGreaterThan(150);
  });

  it('dehaze increases the contrast of a foggy picture', () => {
    const img = image(30, 30, (x) => (x < 15 ? [150, 150, 160] : [210, 210, 215]));
    const before = 210 - 150;
    dehaze(img, 80);
    expect(px(img, 25, 5)[0] - px(img, 5, 5)[0]).toBeGreaterThan(before);
  });

  it('tilt shift keeps the focus band sharp and blurs the rest', () => {
    const img = image(30, 60, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
    tilt_shift(img, 50, 20, 6);
    expect(px(img, 10, 30)[0] == 0 || px(img, 10, 30)[0] == 255).toBe(true);
    const top = px(img, 10, 2)[0];
    expect(top).toBeGreaterThan(20);
    expect(top).toBeLessThan(235);
  });

  it('split toning tints shadows and highlights differently', () => {
    const img = image(2, 1, (x) => (x == 0 ? [30, 30, 30] : [230, 230, 230]));
    split_toning(img, '#0000ff', '#ff0000', 0, 100);
    expect(px(img, 0, 0)[2]).toBeGreaterThan(px(img, 0, 0)[0]);
    expect(px(img, 1, 0)[0]).toBeGreaterThan(px(img, 1, 0)[2]);
  });

  it('chromatic aberration moves red and blue in opposite directions', () => {
    const img = image(10, 1, (x) => (x == 5 ? [255, 255, 255] : [0, 0, 0]));
    chromatic_aberration(img, 2);
    expect(px(img, 7, 0)[0]).toBe(255);
    expect(px(img, 3, 0)[2]).toBe(255);
    expect(px(img, 5, 0)[1]).toBe(255);
  });

  it('halftone makes dark areas big dots and white areas empty', () => {
    const dark = image(16, 16, () => [20, 20, 20]);
    halftone(dark, 8);
    const dark_black = Array.from({ length: 256 }, (_, k) => dark.data[k * 4]).filter((v) => v == 0).length;
    const light = image(16, 16, () => [250, 250, 250]);
    halftone(light, 8);
    const light_black = Array.from({ length: 256 }, (_, k) => light.data[k * 4]).filter((v) => v == 0).length;
    expect(dark_black).toBeGreaterThan(light_black + 80);
  });

  it('film grain changes pixels but keeps alpha', () => {
    const img = image(10, 10, () => [128, 128, 128, 200]);
    let seed = 1;
    film_grain(img, 80, 2, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    const values = new Set(Array.from({ length: 100 }, (_, k) => img.data[k * 4]));
    expect(values.size).toBeGreaterThan(3);
    expect(px(img, 0, 0)[3]).toBe(200);
  });

  it('dust and scratches removes a single bright speck', () => {
    const img = image(11, 11, () => [100, 100, 100]);
    img.data[(5 * 11 + 5) * 4] = 255;
    img.data[(5 * 11 + 5) * 4 + 1] = 255;
    img.data[(5 * 11 + 5) * 4 + 2] = 255;
    dust_scratches(img, 2, 40);
    expect(px(img, 5, 5)).toEqual([100, 100, 100, 255]);
  });

  it('blur spreads a point', () => {
    const img = image(21, 21, (x, y) => (x == 10 && y == 10 ? [255, 255, 255] : [0, 0, 0]));
    const blurred = blur_rgba(img, 6);
    expect(blurred[(10 * 21 + 10) * 4]).toBeLessThan(255);
    expect(blurred[(10 * 21 + 12) * 4]).toBeGreaterThan(0);
  });
});
