import { measure, format_measure } from '../src/js/libs/measure.js';

describe('measure', () => {
  it('measures a horizontal and a diagonal line', () => {
    expect(measure({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ dx: 10, dy: 0, length: 10, angle: 0 });
    const diagonal = measure({ x: 0, y: 0 }, { x: 3, y: -4 });
    expect(diagonal.length).toBe(5);
    expect(Math.round(diagonal.angle)).toBe(53);
  });

  it('formats the result', () => {
    expect(format_measure(measure({ x: 0, y: 0 }, { x: 120, y: -45 }))).toBe('W: 120  H: 45  L: 128.2  A: 20.6°');
  });
});
