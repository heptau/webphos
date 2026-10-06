import { histogram_scale } from '../src/js/libs/histogram-view.js';

describe('histogram scale', () => {
  it('is zero for an empty histogram', () => {
    expect(histogram_scale([new Uint32Array(256)])).toBe(0);
  });

  it('uses the highest bar when the data is even', () => {
    const h = new Uint32Array(256).fill(10);
    h[100] = 30;
    expect(histogram_scale([h])).toBe(30);
  });

  it('ignores a lone extreme bar', () => {
    const h = new Uint32Array(256).fill(10);
    h[0] = 100000;
    expect(histogram_scale([h])).toBe(20);
  });
});
