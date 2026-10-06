import { parse_commands, apply_steps, RECIPES } from '../src/js/libs/quick-commands.js';

function pixel(r: number, g: number, b: number) {
  return { data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 };
}

describe('quick commands', () => {
  it('understands English phrases and amounts', () => {
    expect(parse_commands('brighter').steps).toEqual([{ op: 'brightness', value: 20 }]);
    expect(parse_commands('a bit darker').steps).toEqual([{ op: 'brightness', value: -10 }]);
    expect(parse_commands('much more contrast').steps).toEqual([{ op: 'contrast', value: 40 }]);
    expect(parse_commands('less contrast').steps).toEqual([{ op: 'contrast', value: -20 }]);
    expect(parse_commands('black and white').steps).toEqual([{ op: 'desaturate' }]);
    expect(parse_commands('less saturation').steps).toEqual([{ op: 'saturation', value: -25 }]);
    expect(parse_commands('cooler').steps).toEqual([{ op: 'temperature', value: -25 }]);
  });

  it('understands Czech phrases without diacritics too', () => {
    expect(parse_commands('světlejší').steps).toEqual([{ op: 'brightness', value: 20 }]);
    expect(parse_commands('trochu tmavší').steps).toEqual([{ op: 'brightness', value: -10 }]);
    expect(parse_commands('černobílé').steps).toEqual([{ op: 'desaturate' }]);
    expect(parse_commands('teplejší').steps).toEqual([{ op: 'temperature', value: 25 }]);
  });

  it('splits several commands and reports unknown parts', () => {
    const result = parse_commands('brighter, more contrast and make it purple');
    expect(result.steps.map((s: { op?: string }) => s.op)).toEqual(['brightness', 'contrast']);
    expect(result.unknown).toEqual(['make it purple']);
  });

  it('applies steps to pixels', () => {
    const image = pixel(100, 100, 100);
    apply_steps(image, parse_commands('brighter').steps);
    expect(image.data[0]).toBeGreaterThan(100);
    const gray = pixel(200, 50, 50);
    apply_steps(gray, parse_commands('black and white').steps);
    expect(gray.data[0]).toBe(gray.data[1]);
  });

  it('every recipe can be applied to an image', () => {
    for (const text of Object.values(RECIPES)) {
      const image = { data: new Uint8ClampedArray(16 * 16 * 4).fill(120), width: 16, height: 16 };
      expect(() => apply_steps(image, parse_commands(text).steps)).not.toThrow();
    }
  });

  it('all recipes are understood completely', () => {
    for (const text of Object.values(RECIPES)) {
      const result = parse_commands(text);
      expect(result.unknown).toEqual([]);
      expect(result.steps.length).toBeGreaterThan(0);
    }
  });
});
