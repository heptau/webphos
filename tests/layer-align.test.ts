import { layer_bounds, align_delta, distribute_deltas, ALIGN_MODES } from '../src/js/libs/layer-align.js';

const box = (x: number, y: number, width: number, height: number, rotate = 0) => ({ x, y, width, height, rotate });
const canvas = { left: 0, top: 0, right: 800, bottom: 600 };

describe('layer_bounds', () => {
  it('is the box itself without rotation', () => {
    expect(layer_bounds(box(10, 20, 100, 50))).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
    expect(layer_bounds({ x: 1, y: 2, width: 3, height: 4, rotate: null })).toEqual({ left: 1, top: 2, right: 4, bottom: 6 });
  });

  it('swaps width and height at 90 degrees around the center', () => {
    const b = layer_bounds(box(100, 100, 200, 100, 90));
    expect(b.left).toBeCloseTo(150); expect(b.right).toBeCloseTo(250);
    expect(b.top).toBeCloseTo(50); expect(b.bottom).toBeCloseTo(250);
  });

  it('grows to include the corners at 45 degrees', () => {
    const b = layer_bounds(box(0, 0, 100, 100, 45));
    expect(b.right - b.left).toBeCloseTo(141.42, 1);
    expect((b.left + b.right) / 2).toBeCloseTo(50);
  });
});

describe('align_delta', () => {
  const bounds = layer_bounds(box(100, 200, 120, 80)); // 100..220 x 200..280

  it('moves to each edge and center of the reference', () => {
    expect(align_delta(bounds, 'left', canvas)).toEqual({ dx: -100, dy: 0 });
    expect(align_delta(bounds, 'right', canvas)).toEqual({ dx: 580, dy: 0 });
    expect(align_delta(bounds, 'center', canvas)).toEqual({ dx: 240, dy: 0 });
    expect(align_delta(bounds, 'top', canvas)).toEqual({ dx: 0, dy: -200 });
    expect(align_delta(bounds, 'bottom', canvas)).toEqual({ dx: 0, dy: 320 });
    expect(align_delta(bounds, 'middle', canvas)).toEqual({ dx: 0, dy: 60 });
  });

  it('works with any reference rectangle, e.g. a selection', () => {
    const selection = { left: 300, top: 300, right: 500, bottom: 400 };
    expect(align_delta(bounds, 'left', selection)).toEqual({ dx: 200, dy: 0 });
    expect(align_delta(bounds, 'center', selection)).toEqual({ dx: 240, dy: 0 });
  });

  it('rounds to whole pixels, does nothing for unknown modes and knows all six modes', () => {
    expect(align_delta({ left: 0, top: 0, right: 11, bottom: 11 }, 'center', canvas)).toEqual({ dx: 395, dy: 0 });
    expect(align_delta(bounds, 'nonsense', canvas)).toEqual({ dx: 0, dy: 0 });
    expect(ALIGN_MODES.length).toBe(6);
  });

  it('aligns rotated layers by their bounding box', () => {
    const rotated = layer_bounds(box(100, 100, 200, 100, 90));
    expect(align_delta(rotated, 'top', canvas).dy).toBe(-50);
    expect(align_delta(rotated, 'left', canvas).dx).toBe(-150);
  });
});

describe('distribute_deltas', () => {
  const item = (id: string, x: number, w: number) => ({ id, bounds: layer_bounds(box(x, 0, w, 10)) });

  it('creates equal gaps and keeps the outer layers', () => {
    // widths 100, 50, 50, 100 from 0 to 600 -> gaps (600 - 300) / 3 = 100
    const result = distribute_deltas([item('a', 0, 100), item('b', 130, 50), item('c', 400, 50), item('d', 500, 100)], 'x');
    expect(result.find((r) => r.id == 'a')!.dx).toBe(0);
    expect(result.find((r) => r.id == 'd')!.dx).toBe(0);
    expect(result.find((r) => r.id == 'b')!.dx).toBe(70); // 130 -> 200
    expect(result.find((r) => r.id == 'c')!.dx).toBe(-50); // 400 -> 350
    expect(result.every((r) => r.dy == 0)).toBe(true);
  });

  it('sorts by position, not by order in the list', () => {
    const result = distribute_deltas([item('c', 500, 100), item('a', 0, 100), item('b', 130, 100)], 'x');
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(result.find((r) => r.id == 'b')!.dx).toBe(120); // gap (600-300)/2 = 150 -> left 250
  });

  it('distributes vertically', () => {
    const v = (id: string, y: number) => ({ id, bounds: layer_bounds(box(0, y, 10, 20)) });
    const result = distribute_deltas([v('a', 0), v('b', 10), v('c', 180)], 'y');
    expect(result.find((r) => r.id == 'b')!.dy).toBe(80); // span 200, sizes 60, gap 70 -> top 90 (moves from 10)
    expect(result.every((r) => r.dx == 0)).toBe(true);
  });

  it('does nothing for fewer than three layers', () => {
    expect(distribute_deltas([item('a', 0, 10), item('b', 50, 10)], 'x').every((r) => r.dx == 0)).toBe(true);
    expect(distribute_deltas([], 'x')).toEqual([]);
  });
});
