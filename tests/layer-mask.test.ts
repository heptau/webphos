import {
  serialize_layer_mask, deserialize_layer_mask, uniform_layer_mask, layer_mask_from_selection,
  layer_mask_to_selection, apply_layer_mask,
} from '../src/js/libs/layer-mask.js';
import { rect_mask, create_mask, feather_mask } from '../src/js/libs/selection-mask.js';

const layer = { x: 10, y: 20, width: 40, height: 30 };

describe('serialization', () => {
  it('round-trips through JSON', () => {
    const mask = feather_mask(rect_mask({ x: 5, y: 5, width: 20, height: 10 }, 40, 30), 3);
    const stored = JSON.parse(JSON.stringify(serialize_layer_mask(mask)));
    const back = deserialize_layer_mask(stored)!;
    expect(back.width).toBe(40);
    expect(Array.from(back.data)).toEqual(Array.from(mask.data));
  });

  it('is compact for hard masks', () => {
    const stored = serialize_layer_mask(uniform_layer_mask(layer, 255));
    expect(stored.values).toEqual([255]);
    expect(stored.counts).toEqual([1200]);
  });

  it('rejects invalid data', () => {
    expect(deserialize_layer_mask(null as any)).toBeNull();
    expect(deserialize_layer_mask({})).toBeNull();
    expect(deserialize_layer_mask({ width: 2, height: 2, values: [1], counts: [3] })).toBeNull();
    expect(deserialize_layer_mask({ width: 2, height: 2, values: 'x', counts: [4] })).toBeNull();
    expect(deserialize_layer_mask({ width: 1e9, height: 1e9, values: [0], counts: [1] })).toBeNull();
  });
});

describe('uniform masks', () => {
  it('reveals or hides the whole layer box', () => {
    const reveal = uniform_layer_mask(layer, 255);
    expect([reveal.width, reveal.height, reveal.data.length]).toEqual([40, 30, 1200]);
    expect(reveal.data.every((v) => v === 255)).toBe(true);
    expect(uniform_layer_mask(layer, 0).data.every((v) => v === 0)).toBe(true);
  });
});

describe('selection conversion', () => {
  it('takes the part of the selection that lies over the layer', () => {
    const selection = rect_mask({ x: 20, y: 30, width: 10, height: 5 }, 100, 100);
    const mask = layer_mask_from_selection(selection, layer);
    expect(mask.data[10 * 40 + 10]).toBe(255); // canvas (20, 30) -> layer (10, 10)
    expect(mask.data[9 * 40 + 10]).toBe(0);
    expect(mask.data.filter((v) => v > 0).length).toBe(50);
  });

  it('round-trips layer mask -> selection -> layer mask', () => {
    const original = feather_mask(rect_mask({ x: 8, y: 6, width: 20, height: 10 }, 40, 30), 2);
    const selection = layer_mask_to_selection(original, layer, 100, 100);
    expect(selection.data[(20 + 6) * 100 + (10 + 8)]).toBe(original.data[6 * 40 + 8]);
    expect(selection.data[0]).toBe(0);
    expect(Array.from(layer_mask_from_selection(selection, layer).data)).toEqual(Array.from(original.data));
  });

  it('clips layers that stick out of the canvas', () => {
    const mask = uniform_layer_mask({ width: 40, height: 30 }, 255);
    const selection = layer_mask_to_selection(mask, { x: -20, y: 25 }, 30, 40);
    expect(selection.data.filter((v) => v > 0).length).toBe(20 * 15);
  });
});

describe('apply', () => {
  it('multiplies alpha by the mask and resamples to the image size', () => {
    const image = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(255) };
    const mask = create_mask(2, 1);
    mask.data[0] = 255;
    mask.data[1] = 0;
    apply_layer_mask(image, mask);
    expect([0, 1, 2, 3].map((x) => image.data[x * 4 + 3])).toEqual([255, 255, 0, 0]);
    expect(image.data[0]).toBe(255); // color is untouched
  });

  it('keeps semi-transparent pixels proportional', () => {
    const image = { width: 1, height: 1, data: Uint8ClampedArray.from([9, 9, 9, 200]) };
    apply_layer_mask(image, create_mask(1, 1, 128));
    expect(image.data[3]).toBe(100);
  });
});
