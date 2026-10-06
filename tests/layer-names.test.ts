import { apply_name_pattern } from '../src/js/libs/layer-names.js';

describe('layer name pattern', () => {
  const layer = { name: 'Old', type: 'image' };

  it('replaces the placeholders', () => {
    expect(apply_name_pattern('Layer {n}', layer, 2, 1)).toBe('Layer 3');
    expect(apply_name_pattern('{nn}-{name}', layer, 0, 5)).toBe('05-Old');
    expect(apply_name_pattern('{type}', layer, 0, 1)).toBe('image');
  });

  it('keeps the old name for an empty result and removes angle brackets', () => {
    expect(apply_name_pattern('', layer, 0, 1)).toBe('Old');
    expect(apply_name_pattern('<b>x</b>', layer, 0, 1)).toBe('bx/b');
    expect(apply_name_pattern('a'.repeat(300), layer, 0, 1)).toHaveLength(100);
  });
});
