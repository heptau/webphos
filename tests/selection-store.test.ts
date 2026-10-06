import {
  rle_encode, rle_decode, encode_selection, decode_selection, load_all_selections, save_selection, delete_selection,
} from '../src/js/libs/selection-store.js';
import { create_mask, rect_mask, feather_mask } from '../src/js/libs/selection-mask.js';

describe('rle', () => {
  it('encodes runs and decodes back', () => {
    const data = Uint8ClampedArray.from([0, 0, 0, 255, 255, 7, 0]);
    const { values, counts } = rle_encode(data);
    expect(Array.from(values)).toEqual([0, 255, 7, 0]);
    expect(Array.from(counts)).toEqual([3, 2, 1, 1]);
    expect(Array.from(rle_decode(values, counts, 7)!)).toEqual(Array.from(data));
  });

  it('handles empty data and rejects corrupted input', () => {
    const { values, counts } = rle_encode(new Uint8ClampedArray(0));
    expect(values.length).toBe(0);
    expect(rle_decode(values, counts, 0)).not.toBeNull();
    expect(rle_decode(Uint8Array.from([1]), Uint32Array.from([5]), 4)).toBeNull();
    expect(rle_decode(Uint8Array.from([1]), Uint32Array.from([3]), 4)).toBeNull();
    expect(rle_decode(Uint8Array.from([1, 2]), Uint32Array.from([3]), 3)).toBeNull();
  });
});

describe('selection records', () => {
  it('uses rle for hard masks and round-trips them', () => {
    const mask = rect_mask({ x: 10, y: 10, width: 30, height: 20 }, 100, 80);
    const record = encode_selection('box', mask);
    expect(record.encoding).toBe('rle');
    expect(record.values.length).toBeLessThan(100);
    const decoded = decode_selection(record)!;
    expect(decoded.name).toBe('box');
    expect(Array.from(decoded.mask.data)).toEqual(Array.from(mask.data));
    expect(decoded.mask.width).toBe(100);
  });

  it('stores noisy/soft masks raw when rle would be larger', () => {
    const noisy = create_mask(20, 20);
    for (let i = 0; i < noisy.data.length; i++) noisy.data[i] = (i * 37) % 256;
    const record = encode_selection('noise', noisy);
    expect(record.encoding).toBe('raw');
    expect(Array.from(decode_selection(record)!.mask.data)).toEqual(Array.from(noisy.data));

    const soft = feather_mask(rect_mask({ x: 20, y: 20, width: 20, height: 20 }, 60, 60), 8);
    expect(Array.from(decode_selection(encode_selection('soft', soft))!.mask.data)).toEqual(Array.from(soft.data));
  });

  it('returns null for invalid records', () => {
    expect(decode_selection(null as any)).toBeNull();
    expect(decode_selection({ name: 'x', width: 0, height: 5, encoding: 'raw', data: [] })).toBeNull();
    expect(decode_selection({ name: 'x', width: 2, height: 2, encoding: 'raw', data: new Uint8Array(3) })).toBeNull();
    expect(decode_selection({ name: 'x', width: 2, height: 2, encoding: 'rle', values: Uint8Array.from([1]), counts: Uint32Array.from([3]) })).toBeNull();
    expect(decode_selection({ name: 'x', width: 2, height: 2, encoding: 'unknown' })).toBeNull();
  });
});

describe('without IndexedDB', () => {
  it('never throws and reports failure', async () => {
    const original = (window as any).indexedDB;
    (window as any).indexedDB = undefined;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await load_all_selections()).toEqual([]);
    expect(await save_selection('a', create_mask(2, 2))).toBe(false);
    expect(await delete_selection('a')).toBe(false);
    (window as any).indexedDB = original;
  });
});
