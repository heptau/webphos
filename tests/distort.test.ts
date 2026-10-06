import { remap, twirl, wave, cloud_noise, clouds, lensFlare } from '../src/js/libs/distort.js';

function image(width: number, height: number, fill: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { width, height, data };
}
const px = (img: any, x: number, y: number): number[] => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('remap', () => {
  it('identity mapper keeps the image', () => {
    const img = image(4, 3, (x, y) => [x * 40, y * 60, 7, 255]);
    const before = Array.from(img.data);
    remap(img, () => {});
    expect(Array.from(img.data)).toEqual(before);
  });

  it('can shift pixels and extends the edge pixels', () => {
    const img = image(4, 1, (x) => [x * 50, 0, 0, 255]);
    remap(img, (x, y, position) => { position[0] = x - 1; });
    expect([0, 1, 2, 3].map((x) => px(img, x, 0)[0])).toEqual([0, 0, 50, 100]);
  });

  it('does not bleed color from transparent pixels', () => {
    const img = image(2, 1, (x) => (x == 0 ? [255, 0, 0, 255] : [0, 255, 0, 0]));
    remap(img, (x, y, position) => { position[0] = x + 0.5; });
    const result = px(img, 0, 0);
    expect(result[0]).toBeGreaterThan(250); // red stays red, no green mixed in
    expect(result[1]).toBeLessThan(5);
    expect(result[3]).toBeGreaterThan(100);
    expect(result[3]).toBeLessThan(160);
  });
});

describe('twirl', () => {
  const ramp = () => image(41, 41, (x, y) => [x * 6, y * 6, 0, 255]);

  it('is identity for angle 0 and leaves the center and the outside of the radius alone', () => {
    const a = ramp();
    twirl(a, { angle: 0 });
    expect(Array.from(a.data)).toEqual(Array.from(ramp().data));
    const b = ramp();
    twirl(b, { angle: 180, radius: 50 });
    expect(px(b, 20, 20)).toEqual(px(ramp(), 20, 20)); // center does not move
    expect(px(b, 0, 0)).toEqual(px(ramp(), 0, 0)); // outside of the radius
    expect(px(b, 20, 10)).not.toEqual(px(ramp(), 20, 10)); // inside it moved
  });

  it('opposite angles rotate in opposite directions', () => {
    const a = ramp(), b = ramp();
    twirl(a, { angle: 90 });
    twirl(b, { angle: -90 });
    expect(px(a, 20, 10)).not.toEqual(px(b, 20, 10));
  });
});

describe('wave', () => {
  it('is identity without amplitude and displaces rows sideways otherwise', () => {
    const base = () => image(20, 20, (x) => [x * 12, 0, 0, 255]);
    const a = base();
    wave(a, { amplitude: 0 });
    expect(Array.from(a.data)).toEqual(Array.from(base().data));
    const b = base();
    wave(b, { amplitude: 20, wavelength: 50, direction: 'horizontal' });
    const rows = new Set([0, 3, 6, 9].map((y) => px(b, 10, y)[0]));
    expect(rows.size).toBeGreaterThan(1);
  });

  it('vertical waves move columns, not rows', () => {
    const base = () => image(20, 20, (x, y) => [y * 12, 0, 0, 255]);
    const b = base();
    wave(b, { amplitude: 20, wavelength: 50, direction: 'vertical' });
    const cols = new Set([0, 3, 6, 9].map((x) => px(b, x, 10)[0]));
    expect(cols.size).toBeGreaterThan(1);
  });
});

describe('clouds', () => {
  it('noise is deterministic, in range and varies with the seed', () => {
    const a = cloud_noise(32, 32, 16, 5);
    const b = cloud_noise(32, 32, 16, 5);
    const c = cloud_noise(32, 32, 16, 6);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(0.2);
  });

  it('is smooth (neighbouring pixels are close)', () => {
    const n = cloud_noise(64, 64, 32, 1);
    let worst = 0;
    for (let i = 1; i < n.length; i++) if (i % 64) worst = Math.max(worst, Math.abs(n[i] - n[i - 1]));
    expect(worst).toBeLessThan(0.15);
  });

  it('fills transparent images with the two colors and respects opacity', () => {
    const img = image(32, 32, () => [0, 0, 0, 0]);
    clouds(img, { color1: '#000000', color2: '#ffffff', seed: 3, scale: 50 });
    expect(Array.from(img.data).filter((_, i) => i % 4 == 3).every((a) => a === 255)).toBe(true);
    const grays = new Set(Array.from(img.data).filter((_, i) => i % 4 == 0));
    expect(grays.size).toBeGreaterThan(10);
    const original = image(8, 8, () => [10, 20, 30, 255]);
    clouds(original, { opacity: 0 });
    expect(px(original, 0, 0)).toEqual([10, 20, 30, 255]);
    const half = image(8, 8, () => [255, 0, 0, 255]);
    clouds(half, { color1: '#0000ff', color2: '#0000ff', opacity: 50 });
    expect(px(half, 3, 3)).toEqual([128, 0, 128, 255]);
  });

  it('is repeatable and independent of previous content for full opacity', () => {
    const a = image(16, 16, () => [200, 10, 10, 255]);
    const b = image(16, 16, () => [0, 0, 0, 0]);
    clouds(a, { seed: 9, scale: 40 });
    clouds(b, { seed: 9, scale: 40 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});

describe('lens flare', () => {
  const dark = () => image(60, 40, () => [10, 10, 10, 255]);

  it('is identity without brightness and keeps alpha', () => {
    const a = dark();
    lensFlare(a, { brightness: 0 });
    expect(Array.from(a.data)).toEqual(Array.from(dark().data));
    const t = image(10, 10, () => [0, 0, 0, 90]);
    lensFlare(t, { x: 50, y: 50, brightness: 100 });
    expect(t.data[3]).toBe(90);
  });

  it('adds a bright glow at the light position and leaves far corners almost untouched', () => {
    const img = dark();
    lensFlare(img, { x: 25, y: 25, brightness: 100 });
    const center = px(img, 15, 10);
    expect(center[0]).toBeGreaterThan(200);
    expect(center[2]).toBeGreaterThan(150);
    const far = px(img, 59, 39);
    expect(far[0]).toBeLessThan(80);
  });

  it('brighter setting gives a brighter flare and values never exceed 255', () => {
    const a = dark(), b = dark();
    lensFlare(a, { x: 40, y: 40, brightness: 30 });
    lensFlare(b, { x: 40, y: 40, brightness: 300 });
    expect(px(b, 24, 16)[0]).toBeGreaterThanOrEqual(px(a, 24, 16)[0]);
    expect(Math.max(...b.data)).toBeLessThanOrEqual(255);
  });

  it('puts ghosts on the opposite side of the image center', () => {
    const img = image(200, 100, () => [0, 0, 0, 255]);
    lensFlare(img, { x: 20, y: 50, brightness: 100 });
    // ghost 0.45 along the line: x = 40 + (100 - 40) * 1.45 = 127
    const column = Array.from({ length: 200 }, (_, x) => px(img, x, 50)[2]);
    const right = Math.max(...column.slice(100, 170));
    expect(right).toBeGreaterThan(20);
  });
});
