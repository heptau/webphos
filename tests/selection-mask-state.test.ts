import Selection_mask_class from '../src/js/core/selection-mask-state.js';
import { create_mask, rect_mask, resize_mask } from '../src/js/libs/selection-mask.js';

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // no IndexedDB in jsdom
});

describe('saved selections', () => {
  it('saves a copy, loads a copy and lists names in order', () => {
    const state = new Selection_mask_class();
    state.saved!.clear();
    const mask = rect_mask({ x: 1, y: 1, width: 2, height: 2 }, 6, 6);
    expect(state.save('first', mask)).toBe(false);
    mask.data.fill(0); //changing the original must not affect the saved copy
    const loaded = state.load('first')!;
    expect(Array.from(loaded.data).filter((v) => v > 0).length).toBe(4);
    loaded.data.fill(0); //nor must changing the loaded copy
    expect(Array.from(state.load('first')!.data).filter((v) => v > 0).length).toBe(4);
    state.save('second', create_mask(6, 6, 255));
    expect(state.saved_names()).toEqual(['first', 'second']);
  });

  it('overwrites and removes', () => {
    const state = new Selection_mask_class();
    state.saved!.clear();
    state.save('a', create_mask(2, 2, 10));
    expect(state.save('a', create_mask(2, 2, 20))).toBe(true);
    expect(state.load('a')!.data[0]).toBe(20);
    expect(state.remove('a')).toBe(true);
    expect(state.load('a')).toBeNull();
    expect(state.saved_names()).toEqual([]);
  });
});

describe('resize_mask', () => {
  it('copies when the size is the same', () => {
    const m = rect_mask({ x: 0, y: 0, width: 2, height: 1 }, 4, 2);
    const r = resize_mask(m, 4, 2);
    expect(r.data).toEqual(m.data);
    expect(r.data).not.toBe(m.data);
  });

  it('scales up and down', () => {
    const m = rect_mask({ x: 0, y: 0, width: 2, height: 2 }, 4, 4);
    const up = resize_mask(m, 8, 8);
    expect(up.data[0]).toBe(255);
    expect(up.data[3 * 8 + 3]).toBe(255);
    expect(up.data[4 * 8 + 4]).toBe(0);
    const down = resize_mask(m, 2, 2);
    expect(Array.from(down.data)).toEqual([255, 0, 0, 0]);
  });
});
