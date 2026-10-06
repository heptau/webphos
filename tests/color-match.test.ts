import { match_color, color_statistics } from '../src/js/libs/color-match.js';

function flat(r: number, g: number, b: number, size = 4) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { data, width: size, height: size };
}

describe('match color', () => {
  it('moves the average color to the reference', () => {
    const image = flat(100, 100, 100);
    const reference = flat(200, 80, 60);
    match_color(image, reference, 100);
    expect(image.data[0]).toBeGreaterThan(170);
    expect(image.data[1]).toBeLessThan(110);
    expect(image.data[2]).toBeLessThan(90);
  });

  it('strength 0 changes nothing, 50 goes half way', () => {
    const untouched = flat(100, 100, 100);
    match_color(untouched, flat(200, 80, 60), 0);
    expect(untouched.data[0]).toBe(100);
    const half = flat(100, 100, 100);
    match_color(half, flat(200, 100, 100), 50);
    expect(half.data[0]).toBeGreaterThan(120);
    expect(half.data[0]).toBeLessThan(180);
  });

  it('ignores transparent pixels in statistics', () => {
    const image = flat(100, 100, 100);
    image.data[3] = 0;
    expect(color_statistics(image).count).toBe(15);
  });
});
