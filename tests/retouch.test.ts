import { heal_spot, remove_red_eye, erase_similar } from '../src/js/libs/retouch.js';

function image(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return { data, width, height };
}

const px = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('retouch', () => {
  it('heals a dark spot on a flat background', () => {
    const img = image(80, 80, (x, y) => (Math.hypot(x - 40, y - 40) < 4 ? [20, 20, 20, 255] : [200, 180, 160, 255]));
    expect(heal_spot(img, 40, 40, 6)).toBe(true);
    const center = px(img, 40, 40);
    expect(Math.abs(center[0] - 200)).toBeLessThan(10);
    expect(Math.abs(center[1] - 180)).toBeLessThan(10);
    expect(center[3]).toBe(255);
  });

  it('texture only mode keeps the colors of the source', () => {
    const left = (x: number) => (x < 40 ? [60, 60, 60, 255] : [200, 200, 200, 255]);
    const img = image(120, 60, (x, y) => (Math.hypot(x - 45, y - 30) < 4 ? [0, 0, 0, 255] : left(x)));
    const reference = image(120, 60, (x, y) => (Math.hypot(x - 45, y - 30) < 4 ? [0, 0, 0, 255] : left(x)));
    heal_spot(img, 45, 30, 6, true);
    heal_spot(reference, 45, 30, 6, false);
    //both heal the spot, the variants may differ in color but neither leaves it black
    expect(px(img, 45, 30)[0]).toBeGreaterThan(40);
    expect(px(reference, 45, 30)[0]).toBeGreaterThan(40);
  });

  it('does not heal when there is no room to sample from', () => {
    const img = image(10, 10, () => [100, 100, 100, 255]);
    expect(heal_spot(img, 5, 5, 8)).toBe(false);
  });

  it('removes red from an eye but keeps other colors', () => {
    const img = image(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) < 5 ? [220, 40, 40, 255] : [90, 120, 200, 255]));
    expect(remove_red_eye(img, 20, 20, 8)).toBeGreaterThan(0);
    const eye = px(img, 20, 20);
    expect(eye[0]).toBeLessThan(120);
    expect(px(img, 2, 2)).toEqual([90, 120, 200, 255]);
  });

  it('erases only pixels similar to the sampled color', () => {
    const img = image(30, 30, (x) => (x < 15 ? [255, 255, 255, 255] : [10, 10, 10, 255]));
    const changed = erase_similar(img, 15, 15, 12, [255, 255, 255], 30);
    expect(changed).toBeGreaterThan(0);
    expect(px(img, 12, 15)[3]).toBe(0);
    expect(px(img, 20, 15)[3]).toBe(255);
  });
});

import { push_pixels } from '../src/js/libs/retouch.js';

describe('liquify', () => {
  it('pushes pixels in the direction of the movement', () => {
    const img = image(40, 20, (x) => (x < 20 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    expect(push_pixels(img, 20, 10, 10, 6, 0, 80)).toBe(true);
    //pixels just right of the old edge now come from the red side
    expect(px(img, 22, 10)[0]).toBeGreaterThan(100);
    //far away nothing changed
    expect(px(img, 39, 10)).toEqual([0, 0, 255, 255]);
    expect(push_pixels(img, 20, 10, 10, 0, 0)).toBe(false);
  });
});
