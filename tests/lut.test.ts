import { parse_cube, lookup, apply_lut } from '../src/js/libs/lut.js';

//identity table of size 2, plus a table that inverts colors
function cube(size: number, map: (r: number, g: number, b: number) => number[]) {
  const lines = ['# test', 'TITLE "t"', 'LUT_3D_SIZE ' + size];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        lines.push(map(r / (size - 1), g / (size - 1), b / (size - 1)).join(' '));
      }
    }
  }
  return lines.join('\n');
}

describe('lut', () => {
  it('parses a valid .cube file and rejects broken ones', () => {
    const lut = parse_cube(cube(3, (r, g, b) => [r, g, b]));
    expect(lut?.size).toBe(3);
    expect(lut?.data).toHaveLength(81);
    expect(parse_cube('LUT_3D_SIZE 2\n0 0 0')).toBeNull();
    expect(parse_cube('LUT_1D_SIZE 4\n0 0 0')).toBeNull();
    expect(parse_cube('hello')).toBeNull();
  });

  it('identity table keeps colors (trilinear interpolation)', () => {
    const lut = parse_cube(cube(5, (r, g, b) => [r, g, b]))!;
    const out = lookup(lut, 0.3, 0.6, 0.9);
    expect(out[0]).toBeCloseTo(0.3, 5);
    expect(out[1]).toBeCloseTo(0.6, 5);
    expect(out[2]).toBeCloseTo(0.9, 5);
  });

  it('applies a look with strength', () => {
    const invert = parse_cube(cube(2, (r, g, b) => [1 - r, 1 - g, 1 - b]))!;
    const full = { data: new Uint8ClampedArray([255, 0, 100, 255]), width: 1, height: 1 };
    apply_lut(full, invert, 100);
    expect(Array.from(full.data)).toEqual([0, 255, 155, 255]);
    const half = { data: new Uint8ClampedArray([200, 200, 200, 255]), width: 1, height: 1 };
    apply_lut(half, invert, 50);
    expect(half.data[0]).toBeGreaterThan(110);
    expect(half.data[0]).toBeLessThan(150);
  });
});
