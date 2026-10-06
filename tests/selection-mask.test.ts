import {
  create_mask, rect_mask, ellipse_mask, invert_mask, mask_bounds, feather_mask, morph_mask,
  color_range_mask, alpha_mask, sample_mask_for_layer, blend_with_mask, erase_with_mask,
  polygon_mask, combine_masks, magic_wand_mask, keep_with_mask, paint_mask_stamp, paint_mask_line, select_similar_mask, contrast_mask, smooth_mask, border_mask, refine_mask, stroke_mask, translate_mask, guided_refine_mask,
} from '../src/js/libs/selection-mask.js';

function image(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { width, height, data };
}
const at = (m: any, x: number, y: number) => m.data[y * m.width + x];
const count = (m: any) => Array.from(m.data as Uint8ClampedArray).filter((v) => v > 0).length;

describe('basic masks', () => {
  it('creates rect mask clamped to canvas', () => {
    const m = rect_mask({ x: 2, y: 1, width: 3, height: 2 }, 10, 5);
    expect(count(m)).toBe(6);
    expect(at(m, 2, 1)).toBe(255);
    expect(at(m, 5, 1)).toBe(0);
    expect(count(rect_mask({ x: -5, y: -5, width: 100, height: 100 }, 10, 5))).toBe(50);
    expect(count(rect_mask({ x: 50, y: 50, width: 5, height: 5 }, 10, 5))).toBe(0);
  });

  it('creates an ellipse that excludes rectangle corners', () => {
    const m = ellipse_mask({ x: 0, y: 0, width: 20, height: 20 }, 20, 20);
    expect(at(m, 10, 10)).toBe(255);
    expect(at(m, 0, 0)).toBe(0);
    expect(count(m)).toBeGreaterThan(250);
    expect(count(m)).toBeLessThan(330);
    expect(count(ellipse_mask({ x: 0, y: 0, width: 0, height: 5 }, 10, 10))).toBe(0);
  });

  it('inverts and computes bounds', () => {
    const m = rect_mask({ x: 2, y: 1, width: 3, height: 2 }, 10, 5);
    const inv = invert_mask(m);
    expect(count(inv)).toBe(50 - 6);
    expect(mask_bounds(m)).toEqual({ x: 2, y: 1, width: 3, height: 2 });
    expect(mask_bounds(create_mask(4, 4))).toBeNull();
  });
});

describe('modifying masks', () => {
  it('expands and contracts', () => {
    const m = rect_mask({ x: 10, y: 10, width: 5, height: 5 }, 30, 30);
    expect(mask_bounds(morph_mask(m, 2))).toEqual({ x: 8, y: 8, width: 9, height: 9 });
    expect(mask_bounds(morph_mask(m, -1))).toEqual({ x: 11, y: 11, width: 3, height: 3 });
    expect(mask_bounds(morph_mask(m, -3))).toBeNull();
    expect(mask_bounds(morph_mask(m, 0))).toEqual({ x: 10, y: 10, width: 5, height: 5 });
  });

  it('feathers edges and keeps flat areas', () => {
    const m = rect_mask({ x: 20, y: 20, width: 20, height: 20 }, 60, 60);
    const f = feather_mask(m, 6);
    expect(at(f, 30, 30)).toBe(255);
    const edge = at(f, 20, 30);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(at(f, 15, 30)).toBeGreaterThan(0);
    expect(at(f, 0, 0)).toBe(0);
    expect(feather_mask(m, 0).data).toEqual(m.data);
  });

  it('feather keeps a full mask full (clamped edges)', () => {
    const f = feather_mask(create_mask(20, 20, 255), 8);
    expect(Array.from(f.data).every((v) => v == 255)).toBe(true);
  });
});

describe('masks from image data', () => {
  it('selects similar colors with fuzziness and ignores transparent pixels', () => {
    const img = image(4, 1, (x) => [[255, 0, 0, 255], [250, 10, 10, 255], [0, 0, 255, 255], [255, 0, 0, 0]][x]);
    const m = color_range_mask(img, [255, 0, 0], 60);
    expect(m.data[0]).toBe(255);
    expect(m.data[1]).toBeGreaterThan(200);
    expect(m.data[2]).toBe(0);
    expect(m.data[3]).toBe(0);
  });

  it('zero fuzziness selects exact color only', () => {
    const img = image(2, 1, (x) => (x == 0 ? [10, 20, 30, 255] : [11, 20, 30, 255]));
    const m = color_range_mask(img, [10, 20, 30], 0);
    expect(Array.from(m.data)).toEqual([255, 0]);
  });

  it('creates mask from alpha', () => {
    const img = image(2, 1, (x) => [0, 0, 0, x * 200]);
    expect(Array.from(alpha_mask(img).data)).toEqual([0, 200]);
  });
});

describe('applying masks to layers', () => {
  const layer = { x: 2, y: 0, width: 4, height: 2, width_original: 4, height_original: 2 };

  it('samples the mask in layer pixels', () => {
    const m = rect_mask({ x: 3, y: 0, width: 2, height: 1 }, 10, 5);
    expect(Array.from(sample_mask_for_layer(m, layer, 4, 2))).toEqual([0, 255, 255, 0, 0, 0, 0, 0]);
  });

  it('samples stretched layers', () => {
    const m = rect_mask({ x: 0, y: 0, width: 2, height: 2 }, 10, 5);
    const stretched = { x: 0, y: 0, width: 4, height: 2, width_original: 2, height_original: 1 };
    expect(Array.from(sample_mask_for_layer(m, stretched, 2, 1))).toEqual([255, 0]);
  });

  it('blends changed pixels only where selected', () => {
    const original = image(4, 2, () => [10, 10, 10, 255]);
    const changed = image(4, 2, () => [200, 200, 200, 255]);
    const m = rect_mask({ x: 3, y: 0, width: 2, height: 2 }, 10, 5);
    blend_with_mask(original, changed, m, layer);
    expect(changed.data[0]).toBe(10);
    expect(changed.data[4]).toBe(200);
    expect(changed.data[8]).toBe(200);
    expect(changed.data[12]).toBe(10);
  });

  it('blends partially for soft masks and handles transparent originals without dark fringes', () => {
    const original = image(1, 1, () => [0, 0, 0, 0]);
    const changed = image(1, 1, () => [200, 100, 50, 255]);
    const half = create_mask(5, 5, 128);
    blend_with_mask(original, changed, half, { x: 0, y: 0, width: 1, height: 1, width_original: 1, height_original: 1 });
    expect(Array.from(changed.data.slice(0, 3))).toEqual([200, 100, 50]);
    expect(changed.data[3]).toBeGreaterThan(120);
    expect(changed.data[3]).toBeLessThan(135);
  });

  it('erases selected pixels', () => {
    const img = image(4, 2, () => [1, 2, 3, 255]);
    const m = rect_mask({ x: 3, y: 0, width: 2, height: 1 }, 10, 5);
    erase_with_mask(img, m, layer);
    expect([0, 1, 2, 3].map((x) => img.data[x * 4 + 3])).toEqual([255, 0, 0, 255]);
    expect(img.data[(4 + 1) * 4 + 3]).toBe(255);
  });
});

describe('polygon mask', () => {
  it('fills a rectangle polygon exactly', () => {
    const m = polygon_mask([{ x: 2, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 2, y: 4 }], 10, 6);
    expect(count(m)).toBe(12);
    expect(at(m, 2, 1)).toBe(255);
    expect(at(m, 5, 3)).toBe(255);
    expect(at(m, 6, 3)).toBe(0);
    expect(at(m, 1, 1)).toBe(0);
  });

  it('anti-aliases fractional edges', () => {
    const m = polygon_mask([{ x: 2.5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 2.5, y: 3 }], 10, 3);
    expect(at(m, 2, 1)).toBeGreaterThan(120);
    expect(at(m, 2, 1)).toBeLessThan(135);
    expect(at(m, 3, 1)).toBe(255);
  });

  it('fills a triangle roughly to half of its bounding box', () => {
    const m = polygon_mask([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }], 20, 20);
    const sum = Array.from(m.data as Uint8ClampedArray).reduce((a, v) => a + v, 0) / 255;
    expect(sum).toBeGreaterThan(190);
    expect(sum).toBeLessThan(210);
  });

  it('uses the even-odd rule and handles degenerate input and clipping', () => {
    const star = polygon_mask([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }], 10, 10);
    expect(star.data.length).toBe(100);
    expect(count(polygon_mask([{ x: 0, y: 0 }, { x: 5, y: 5 }], 10, 10))).toBe(0);
    expect(count(polygon_mask([{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], 10, 10))).toBe(100);
  });
});

describe('combine masks', () => {
  const a = rect_mask({ x: 0, y: 0, width: 4, height: 1 }, 8, 1);
  const b = rect_mask({ x: 2, y: 0, width: 4, height: 1 }, 8, 1);

  it('adds, subtracts and intersects', () => {
    expect(Array.from(combine_masks(a, b, 'add').data)).toEqual([255, 255, 255, 255, 255, 255, 0, 0]);
    expect(Array.from(combine_masks(a, b, 'subtract').data)).toEqual([255, 255, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(combine_masks(a, b, 'intersect').data)).toEqual([0, 0, 255, 255, 0, 0, 0, 0]);
  });
});

describe('magic wand', () => {
  // 6x3 image: left 3 columns red, right 3 columns blue, a red pixel at (5,2) disconnected from the left red area
  const img = image(6, 3, (x, y) => ((x < 3 || (x == 5 && y == 2)) ? [255, 0, 0, 255] : [0, 0, 255, 255]));

  it('selects the connected area of the seed color', () => {
    const m = magic_wand_mask(img, 0, 0, 0, true);
    expect(count(m)).toBe(9);
    expect(at(m, 5, 2)).toBe(0);
    expect(at(m, 3, 0)).toBe(0);
  });

  it('selects all matching pixels when not contiguous', () => {
    const m = magic_wand_mask(img, 0, 0, 0, false);
    expect(count(m)).toBe(10);
    expect(at(m, 5, 2)).toBe(255);
  });

  it('respects tolerance', () => {
    const soft = image(3, 1, (x) => [100 + x * 20, 100, 100, 255]);
    expect(count(magic_wand_mask(soft, 0, 0, 10, true))).toBe(1);
    expect(count(magic_wand_mask(soft, 0, 0, 20, true))).toBe(2);
    expect(count(magic_wand_mask(soft, 0, 0, 255, true))).toBe(3);
  });

  it('treats alpha as a channel and ignores seeds outside the image', () => {
    const t = image(2, 1, (x) => [10, 10, 10, x == 0 ? 255 : 0]);
    expect(count(magic_wand_mask(t, 0, 0, 0, false))).toBe(1);
    expect(count(magic_wand_mask(t, -1, 0, 0, true))).toBe(0);
    expect(count(magic_wand_mask(t, 99, 0, 0, true))).toBe(0);
  });

  it('fills snake-like areas', () => {
    const snake = image(5, 5, (x, y) => ((y % 2 == 0) || (y == 1 && x == 4) || (y == 3 && x == 0) ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const m = magic_wand_mask(snake, 0, 0, 0, true);
    expect(count(m)).toBe(5 + 1 + 5 + 1 + 5);
  });
});

describe('keep_with_mask', () => {
  const layer = { x: 0, y: 0, width: 4, height: 1, width_original: 4, height_original: 1 };

  it('keeps only selected pixels and is the opposite of erase', () => {
    const m = rect_mask({ x: 1, y: 0, width: 2, height: 1 }, 4, 1);
    const kept = keep_with_mask(image(4, 1, () => [1, 2, 3, 200]), m, layer);
    expect([0, 1, 2, 3].map((x) => kept.data[x * 4 + 3])).toEqual([0, 200, 200, 0]);
    const erased = erase_with_mask(image(4, 1, () => [1, 2, 3, 200]), m, layer);
    expect([0, 1, 2, 3].map((x) => erased.data[x * 4 + 3])).toEqual([200, 0, 0, 200]);
  });

  it('keeps colors and scales alpha for soft masks', () => {
    const soft = create_mask(4, 1, 128);
    const kept = keep_with_mask(image(4, 1, () => [9, 8, 7, 255]), soft, layer);
    expect(Array.from(kept.data.slice(0, 3))).toEqual([9, 8, 7]);
    expect(kept.data[3]).toBe(128);
  });
});

describe('painting masks', () => {
  it('adds a hard round dab', () => {
    const m = create_mask(20, 20);
    const dirty = paint_mask_stamp(m, 10, 10, 3, 0, 'add');
    expect(dirty).toEqual({ x: 7, y: 7, width: 7, height: 7 });
    expect(at(m, 10, 10)).toBe(255);
    expect(at(m, 0, 0)).toBe(0);
    expect(count(m)).toBeGreaterThan(20);
    expect(count(m)).toBeLessThan(36);
  });

  it('subtracts with a dab', () => {
    const m = create_mask(20, 20, 255);
    paint_mask_stamp(m, 10, 10, 3, 0, 'subtract');
    expect(at(m, 10, 10)).toBe(0);
    expect(at(m, 0, 0)).toBe(255);
  });

  it('soft dabs fade out from the center', () => {
    const m = create_mask(40, 40);
    paint_mask_stamp(m, 20, 20, 10, 1, 'add');
    expect(at(m, 20, 20)).toBeGreaterThan(230);
    expect(at(m, 26, 20)).toBeLessThan(150);
    expect(at(m, 26, 20)).toBeGreaterThan(0);
    expect(at(m, 29, 20)).toBeLessThan(40);
  });

  it('add never lowers values and clips at the canvas edge', () => {
    const m = create_mask(10, 10, 200);
    paint_mask_stamp(m, 0, 0, 4, 1, 'add');
    expect(at(m, 0, 0)).toBeGreaterThan(200);
    expect(at(m, 9, 9)).toBe(200);
    expect(paint_mask_stamp(m, 100, 100, 3, 0, 'add')).toBeNull();
  });

  it('paints a connected stroke and returns the dirty area', () => {
    const m = create_mask(40, 10);
    const dirty = paint_mask_line(m, { x: 5, y: 5 }, { x: 35, y: 5 }, 2, 0, 'add');
    expect(at(m, 20, 5)).toBe(255);
    expect(at(m, 20, 0)).toBe(0);
    expect(dirty!.x).toBeLessThanOrEqual(3);
    expect(dirty!.x + dirty!.width).toBeGreaterThanOrEqual(37);
    for (let x = 4; x <= 36; x++) expect(at(m, x, 5)).toBe(255);
  });
});

describe('select similar / grow', () => {
  // 8x3: x<3 red, x==3 slightly different red, x 4-5 blue, x 6-7 red again (not connected to the left red)
  const img = image(8, 3, (x) => (x < 3 ? [255, 0, 0, 255] : x == 3 ? [245, 10, 5, 255] : x < 6 ? [0, 0, 255, 255] : [255, 0, 0, 255]));
  const seed = () => rect_mask({ x: 0, y: 0, width: 1, height: 3 }, 8, 3);

  it('grows only through connected similar pixels', () => {
    const m = select_similar_mask(img, seed(), 0, true);
    expect(count(m)).toBe(9);
    expect(at(m, 3, 0)).toBe(0);
    expect(at(m, 6, 0)).toBe(0);
    const tolerant = select_similar_mask(img, seed(), 12, true);
    expect(count(tolerant)).toBe(12);
    expect(at(tolerant, 4, 0)).toBe(0);
  });

  it('selects similar pixels everywhere when not contiguous', () => {
    const m = select_similar_mask(img, seed(), 0, false);
    expect(count(m)).toBe(15);
    expect(at(m, 6, 1)).toBe(255);
    expect(at(m, 3, 1)).toBe(0);
    expect(at(m, 4, 1)).toBe(0);
  });

  it('keeps the original selection and returns a new mask', () => {
    const original = seed();
    const before = Array.from(original.data);
    const m = select_similar_mask(img, original, 0, true);
    expect(Array.from(original.data)).toEqual(before);
    expect(m).not.toBe(original);
    for (let i = 0; i < before.length; i++) if (before[i] >= 128) expect(m.data[i]).toBe(before[i]);
  });

  it('never adds transparent pixels and handles empty selections', () => {
    const t = image(3, 1, (x) => [10, 10, 10, x == 1 ? 0 : 255]);
    const m = select_similar_mask(t, rect_mask({ x: 0, y: 0, width: 1, height: 1 }, 3, 1), 0, false);
    expect(Array.from(m.data)).toEqual([255, 0, 255]);
    expect(count(select_similar_mask(img, create_mask(8, 3), 50, false))).toBe(0);
  });

  it('uses all selected colors and a large tolerance reaches everything', () => {
    const two = rect_mask({ x: 0, y: 0, width: 8, height: 1 }, 8, 3); //the whole first row: red, red-ish and blue
    const m = select_similar_mask(img, two, 0, false);
    expect(count(m)).toBe(24); //row 1 contains all three colors, so every pixel is similar to one of them
    expect(count(select_similar_mask(img, seed(), 255, true))).toBe(24);
  });

  it('copes with images with very many colors', () => {
    const photo = image(200, 200, (x, y) => [x * 1.2, y * 1.2, (x + y) % 256, 255]);
    const m = select_similar_mask(photo, rect_mask({ x: 0, y: 0, width: 200, height: 200 }, 200, 200), 5, false);
    expect(count(m)).toBe(40000);
  });
});

describe('refine edge', () => {
  const square = () => rect_mask({ x: 20, y: 20, width: 20, height: 20 }, 60, 60);

  it('contrast makes soft edges steeper and keeps hard ones', () => {
    const soft = feather_mask(square(), 8);
    const steep = contrast_mask(soft, 100);
    const mid = at(soft, 20, 30);
    expect(mid).toBeGreaterThan(60);
    expect(mid).toBeLessThan(200);
    const count_soft = Array.from(soft.data as Uint8ClampedArray).filter((v) => v > 0 && v < 255).length;
    const count_steep = Array.from(steep.data as Uint8ClampedArray).filter((v) => v > 0 && v < 255).length;
    expect(count_steep).toBeLessThan(count_soft);
    expect(contrast_mask(square(), 100).data).toEqual(square().data);
    expect(contrast_mask(soft, 0).data).toEqual(soft.data);
  });

  it('smooth rounds the corners of a square', () => {
    const smooth = smooth_mask(square(), 6);
    expect(at(smooth, 30, 30)).toBe(255);
    expect(at(smooth, 20, 20)).toBeLessThan(128);
    expect(count(smooth)).toBeLessThan(count(square()));
    expect(count(smooth)).toBeGreaterThan(count(square()) * 0.8);
    expect(smooth_mask(square(), 0).data).toEqual(square().data);
  });

  it('border selects a band along the edge', () => {
    const border = border_mask(square(), 4);
    expect(at(border, 20, 30)).toBe(255);
    expect(at(border, 18, 30)).toBe(255);
    expect(at(border, 21, 30)).toBe(255);
    expect(at(border, 30, 30)).toBe(0);
    expect(at(border, 10, 30)).toBe(0);
    expect(mask_bounds(border)).toEqual({ x: 18, y: 18, width: 24, height: 24 });
  });

  it('refine combines shift and smooth and leaves the input untouched', () => {
    const input = square();
    const before = Array.from(input.data);
    const out = refine_mask(input, { smooth: 0, feather: 0, contrast: 0, shift: 3 });
    expect(mask_bounds(out)).toEqual({ x: 17, y: 17, width: 26, height: 26 });
    expect(Array.from(input.data)).toEqual(before);
    expect(refine_mask(input, {}).data).toEqual(input.data);
    const shrink = refine_mask(input, { smooth: 4, shift: -2 });
    expect(count(shrink)).toBeLessThan(count(input));
  });

  it('refine with feather and contrast gives a softened but steeper edge', () => {
    const out = refine_mask(square(), { feather: 10, contrast: 100 });
    expect(at(out, 30, 30)).toBe(255);
    expect(at(out, 5, 5)).toBe(0);
  });
});

describe('stroke mask', () => {
  const square = () => rect_mask({ x: 20, y: 20, width: 20, height: 20 }, 60, 60);

  it('outside is a band around the selection', () => {
    const m = stroke_mask(square(), 4, 'outside');
    expect(at(m, 30, 30)).toBe(0);
    expect(at(m, 20, 30)).toBe(0);
    expect(at(m, 17, 30)).toBe(255);
    expect(mask_bounds(m)).toEqual({ x: 16, y: 16, width: 28, height: 28 });
  });

  it('inside is a band inside the selection', () => {
    const m = stroke_mask(square(), 4, 'inside');
    expect(at(m, 20, 30)).toBe(255);
    expect(at(m, 23, 30)).toBe(255);
    expect(at(m, 24, 30)).toBe(0);
    expect(at(m, 17, 30)).toBe(0);
    expect(mask_bounds(m)).toEqual({ x: 20, y: 20, width: 20, height: 20 });
  });

  it('center straddles the edge and the three variants do not overlap the interior wrongly', () => {
    const m = stroke_mask(square(), 4, 'center');
    expect(at(m, 18, 30)).toBe(255);
    expect(at(m, 21, 30)).toBe(255);
    expect(at(m, 30, 30)).toBe(0);
    const outside = stroke_mask(square(), 4, 'outside');
    const inside = stroke_mask(square(), 4, 'inside');
    for (let i = 0; i < outside.data.length; i++) expect(outside.data[i] > 0 && inside.data[i] > 0).toBe(false);
  });

  it('a stroke wider than the selection leaves the center empty or fills everything inside', () => {
    expect(count(stroke_mask(rect_mask({ x: 10, y: 10, width: 6, height: 6 }, 30, 30), 10, 'inside'))).toBe(36);
  });
});

describe('translate mask', () => {
  const square = () => rect_mask({ x: 10, y: 10, width: 10, height: 10 }, 40, 30);

  it('moves the mask and keeps its shape', () => {
    const m = translate_mask(square(), 5, -3);
    expect(mask_bounds(m)).toEqual({ x: 15, y: 7, width: 10, height: 10 });
    expect(count(m)).toBe(100);
  });

  it('loses what moves out of the canvas', () => {
    expect(mask_bounds(translate_mask(square(), -15, 0))).toEqual({ x: 0, y: 10, width: 5, height: 10 });
    expect(mask_bounds(translate_mask(square(), 0, 15))).toEqual({ x: 10, y: 25, width: 10, height: 5 });
    expect(mask_bounds(translate_mask(square(), 100, 0))).toBeNull();
  });

  it('rounds, ignores bad values and does not touch the input', () => {
    const input = square();
    const before = Array.from(input.data);
    expect(mask_bounds(translate_mask(input, 2.4, 0.6))).toEqual({ x: 12, y: 11, width: 10, height: 10 });
    expect(Array.from(translate_mask(input, NaN, undefined as any).data)).toEqual(before);
    expect(Array.from(input.data)).toEqual(before);
  });
});

describe('guided (edge aware) refine', () => {
  // dark | light edge at x = 30
  const photo = (w = 80, h = 20) => image(w, h, (x) => (x < 30 ? [20, 20, 20, 255] : [220, 220, 220, 255]));
  const rough = () => rect_mask({ x: 34, y: 0, width: 46, height: 20 }, 80, 20); // starts 4 px too far right

  it('pulls the mask edge to the image edge', () => {
    const before = rough();
    const after = guided_refine_mask(before, photo(), 8, 100);
    expect(at(before, 31, 10)).toBe(0);
    expect(at(after, 31, 10)).toBeGreaterThan(100); // the mask now reaches towards the image edge
    expect(at(after, 31, 10)).toBeGreaterThan(at(guided_refine_mask(before, image(80, 20, () => [100, 100, 100, 255]), 8, 100), 31, 10));
    const crossing = (m: any) => { let x = 0; while (x < 80 && at(m, x, 10) < 128) x++; return x; };
    expect(crossing(before)).toBe(34);
    expect(crossing(after)).toBeLessThanOrEqual(32); // the edge moved from x=34 almost to the image edge at x=30
    expect(crossing(after)).toBeGreaterThanOrEqual(29);
    expect(at(after, 20, 10)).toBeLessThan(40); // dark side stays unselected
    expect(at(after, 60, 10)).toBeGreaterThan(220); // light side stays selected
  });

  it('does nothing without radius or with a guide of another size, and keeps the input', () => {
    const input = rough();
    const before = Array.from(input.data);
    expect(Array.from(guided_refine_mask(input, photo(), 0, 50).data)).toEqual(before);
    expect(Array.from(guided_refine_mask(input, photo(40, 20), 8, 50).data)).toEqual(before);
    guided_refine_mask(input, photo(), 8, 50);
    expect(Array.from(input.data)).toEqual(before);
  });

  it('a flat guide image only smooths the mask', () => {
    const flat = image(80, 20, () => [100, 100, 100, 255]);
    const after = guided_refine_mask(rough(), flat, 6, 50);
    expect(at(after, 20, 10)).toBeLessThan(40);
    expect(at(after, 60, 10)).toBeGreaterThan(215);
    const edge = at(after, 34, 10);
    expect(edge).toBeGreaterThan(40);
    expect(edge).toBeLessThan(215);
  });

  it('keeps values in range and handles fully selected or empty masks', () => {
    const full = guided_refine_mask(create_mask(80, 20, 255), photo(), 8, 50);
    expect(Array.from(full.data).every((v) => v >= 250)).toBe(true);
    const empty = guided_refine_mask(create_mask(80, 20), photo(), 8, 50);
    expect(Array.from(empty.data).every((v) => v <= 5)).toBe(true);
  });
});

import { select_subject_mask } from '../src/js/libs/selection-mask.js';

describe('select_subject_mask', () => {
  it('selects a dark object on a white background and nothing else', () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inside = x >= 12 && x < 28 && y >= 12 && y < 28;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = inside ? 20 : 250;
        data[i + 3] = 255;
      }
    }
    const mask = select_subject_mask({ data, width, height }, 30, 0);
    expect(mask.data[20 * width + 20]).toBe(255);
    expect(mask.data[2 * width + 2]).toBe(0);
    expect(mask.data[20 * width + 2]).toBe(0);
  });
});

import { luminosity_mask, edges_mask, select_sky_mask } from '../src/js/libs/selection-mask.js';

function gradient_image(width: number, height: number, value: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = value(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('luminosity, edges and sky masks', () => {
  const image = gradient_image(4, 1, (x) => [x * 85, x * 85, x * 85]);

  it('lights select bright pixels, darks the dark ones, midtones the middle', () => {
    const lights = luminosity_mask(image, 'lights');
    const darks = luminosity_mask(image, 'darks');
    const mids = luminosity_mask(image, 'midtones');
    expect(lights.data[3]).toBeGreaterThan(lights.data[0]);
    expect(darks.data[0]).toBeGreaterThan(darks.data[3]);
    expect(mids.data[1]).toBeGreaterThan(mids.data[0]);
    expect(mids.data[2]).toBeGreaterThan(mids.data[3]);
  });

  it('a higher strength narrows the range', () => {
    expect(luminosity_mask(image, 'lights', 3).data[2]).toBeLessThan(luminosity_mask(image, 'lights', 1).data[2]);
  });

  it('edges are found where the picture changes', () => {
    const step = gradient_image(20, 20, (x) => (x < 10 ? [0, 0, 0] : [255, 255, 255]));
    const mask = edges_mask(step, 50);
    expect(mask.data[10 * 20 + 10]).toBeGreaterThan(100);
    expect(mask.data[10 * 20 + 3]).toBe(0);
  });

  it('selects the blue top of the picture as sky, not the ground', () => {
    const scene = gradient_image(30, 30, (x, y) => (y < 15 ? [90, 140, 230] : [40, 90, 30]));
    const mask = select_sky_mask(scene, 30);
    expect(mask.data[3 * 30 + 15]).toBe(255);
    expect(mask.data[25 * 30 + 15]).toBe(0);
  });
});
