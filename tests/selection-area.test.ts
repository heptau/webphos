import { selection_to_layer_rect, grow_rect } from '../src/js/libs/selection-area.js';

const layer = { x: 10, y: 20, width: 200, height: 100, width_original: 200, height_original: 100 };

describe('selection_to_layer_rect', () => {
  it('translates canvas coordinates to layer pixels', () => {
    expect(selection_to_layer_rect({ x: 30, y: 40, width: 50, height: 20 }, layer)).toEqual({ x: 20, y: 20, width: 50, height: 20 });
  });

  it('clamps to the layer image', () => {
    expect(selection_to_layer_rect({ x: 0, y: 0, width: 1000, height: 1000 }, layer)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('scales for stretched layers', () => {
    const stretched = { ...layer, width: 400, height: 200 };
    expect(selection_to_layer_rect({ x: 10, y: 20, width: 100, height: 100 }, stretched)).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('returns null for empty or outside selections', () => {
    expect(selection_to_layer_rect({ x: 0, y: 0, width: 0, height: 0 }, layer)).toBeNull();
    expect(selection_to_layer_rect({ x: 500, y: 500, width: 10, height: 10 }, layer)).toBeNull();
    expect(selection_to_layer_rect(null as any, layer)).toBeNull();
  });
});

describe('grow_rect', () => {
  it('expands and contracts symmetrically', () => {
    expect(grow_rect({ x: 50, y: 50, width: 20, height: 20 }, 5, 200, 200)).toEqual({ x: 45, y: 45, width: 30, height: 30 });
    expect(grow_rect({ x: 50, y: 50, width: 20, height: 20 }, -5, 200, 200)).toEqual({ x: 55, y: 55, width: 10, height: 10 });
  });

  it('clamps to the canvas', () => {
    expect(grow_rect({ x: 2, y: 2, width: 20, height: 20 }, 10, 30, 30)).toEqual({ x: 0, y: 0, width: 30, height: 30 });
  });

  it('returns null when the selection vanishes', () => {
    expect(grow_rect({ x: 50, y: 50, width: 20, height: 20 }, -10, 200, 200)).toBeNull();
  });
});
