import { average_color, sample_radius } from '../src/js/libs/color-sampling.js';

function image(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { width, height, data };
}

describe('average_color', () => {
  const checker = image(4, 4, (x, y) => ((x + y) % 2 ? [200, 0, 0, 255] : [0, 0, 200, 255]));

  it('returns the pixel itself for radius 0', () => {
    expect(average_color(checker, 1, 0, 0)).toEqual([200, 0, 0, 255]);
  });

  it('averages the area', () => {
    const avg = average_color(image(2, 1, (x) => (x ? [100, 0, 0, 255] : [0, 100, 0, 255])), 0, 0, 1);
    expect(avg).toEqual([50, 50, 0, 255]);
    const mix = average_color(checker, 1, 1, 1);
    expect(mix[0]).toBeGreaterThan(80);
    expect(mix[2]).toBeGreaterThan(80);
  });

  it('ignores transparent pixels and positions outside of the image', () => {
    const img = image(2, 1, (x) => (x ? [0, 0, 0, 0] : [200, 100, 50, 255]));
    expect(average_color(img, 0, 0, 1)).toEqual([200, 100, 50, 128]);
    expect(average_color(img, 99, 99, 2)).toEqual([0, 0, 0, 0]);
    expect(average_color(img, 1, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('clamps the area at the edges of the image', () => {
    expect(average_color(checker, 0, 0, 1).length).toBe(4);
    expect(average_color(checker, 0, 0, 100)[3]).toBe(255);
  });
});

describe('sample_radius', () => {
  it('maps the options', () => {
    expect(sample_radius('Point')).toBe(0);
    expect(sample_radius('3x3')).toBe(1);
    expect(sample_radius('5x5')).toBe(2);
    expect(sample_radius('11x11')).toBe(5);
    expect(sample_radius('31x31')).toBe(15);
    expect(sample_radius(undefined as any)).toBe(0);
    expect(sample_radius('3x5')).toBe(0);
    expect(sample_radius('999x999')).toBe(50);
  });
});
