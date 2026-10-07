import { vibrance, replaceColor, sponge, colorToAlpha, blackWhite, solarize } from '../src/js/libs/adjustments.js';
import { emboss, findEdges } from '../src/js/libs/filters.js';
import { marquee_rect } from '../src/js/libs/marquee.js';
import { fill_alpha, split_halo_filters } from '../src/js/libs/layer-fill.js';

function image(width: number, height: number, pixels: number[][]) {
  return { width, height, data: new Uint8ClampedArray(pixels.flat()) };
}

function sat(r: number, g: number, b: number) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

describe('vibrance', () => {
  it('boosts dull colors more than vivid ones and keeps alpha', () => {
    const img = vibrance(image(2, 1, [[140, 120, 120, 77], [255, 0, 0, 255]]), { vibrance: 100 });
    const d = Array.from(img.data);
    expect(sat(d[0], d[1], d[2])).toBeGreaterThan(20); //was 20
    expect(d[3]).toBe(77);
    expect(d.slice(4, 7)).toEqual([255, 0, 0]); //the vivid red is already at the limit
  });

  it('negative values reduce the saturation', () => {
    const img = vibrance(image(1, 1, [[200, 100, 100, 255]]), { vibrance: -100, saturation: 0 });
    expect(sat(img.data[0], img.data[1], img.data[2])).toBeLessThan(100);
  });

  it('does not touch grays', () => {
    const img = vibrance(image(1, 1, [[90, 90, 90, 255]]), { vibrance: 100, saturation: 100 });
    expect(Array.from(img.data)).toEqual([90, 90, 90, 255]);
  });
});

describe('replaceColor', () => {
  it('shifts the hue only of colors close to the chosen one', () => {
    const img = replaceColor(image(2, 1, [[255, 0, 0, 255], [0, 0, 255, 255]]), { color: '#ff0000', fuzziness: 40, hue: 120 });
    const d = Array.from(img.data);
    expect(d[1]).toBeGreaterThan(200); //red became green
    expect(d[0]).toBeLessThan(10);
    expect(d.slice(4, 8)).toEqual([0, 0, 255, 255]); //blue stays
  });

  it('zero fuzziness changes only the exact color', () => {
    const img = replaceColor(image(2, 1, [[255, 0, 0, 255], [250, 0, 0, 255]]), { color: '#ff0000', fuzziness: 0, lightness: -100 });
    const d = Array.from(img.data);
    expect(d.slice(0, 3)).toEqual([0, 0, 0]);
    expect(d.slice(4, 7)).toEqual([250, 0, 0]);
  });
});

describe('sponge', () => {
  it('desaturates and saturates', () => {
    const down = sponge(image(1, 1, [[200, 100, 100, 255]]), { mode: 'desaturate', flow: 100 });
    const up = sponge(image(1, 1, [[200, 100, 100, 255]]), { mode: 'saturate', flow: 100 });
    expect(sat(down.data[0], down.data[1], down.data[2])).toBeLessThan(100);
    expect(sat(up.data[0], up.data[1], up.data[2])).toBeGreaterThan(100);
  });
});

describe('emboss and find edges', () => {
  const edge = () => image(4, 1, [[0, 0, 0, 255], [0, 0, 0, 255], [255, 255, 255, 255], [255, 255, 255, 255]]);

  it('emboss gives a gray relief and a flat area stays middle gray', () => {
    const img = emboss(edge(), { angle: 0, amount: 100 });
    const d = Array.from(img.data);
    expect(d[0]).toBe(128); //flat area
    expect(d[4]).toBe(d[5]); //gray
    expect(d[4]).not.toBe(128); //the edge is visible
    expect(d[3]).toBe(255);
  });

  it('find edges is white where nothing changes and dark on the edge', () => {
    const img = findEdges(edge());
    const d = Array.from(img.data);
    expect(d[0]).toBe(255);
    expect(d[12]).toBe(255);
    expect(d[4]).toBeLessThan(255);
  });
});

describe('marquee_rect', () => {
  const start = { x: 100, y: 100 };

  it('normal drag, also to the left and up', () => {
    expect(marquee_rect(start, { x: 150, y: 130 })).toEqual({ x: 100, y: 100, width: 50, height: 30 });
    expect(marquee_rect(start, { x: 70, y: 60 })).toEqual({ x: 70, y: 60, width: 30, height: 40 });
  });

  it('shift makes a square, alt grows from the center', () => {
    expect(marquee_rect(start, { x: 150, y: 130 }, { shift: true })).toEqual({ x: 100, y: 100, width: 50, height: 50 });
    expect(marquee_rect(start, { x: 120, y: 110 }, { alt: true })).toEqual({ x: 80, y: 90, width: 40, height: 20 });
  });

  it('fixed ratio keeps the ratio', () => {
    const r = marquee_rect(start, { x: 200, y: 110 }, { style: 'Fixed Ratio', fixed_width: 16, fixed_height: 9 });
    expect(r.width).toBe(100);
    expect(r.height).toBeCloseTo(56.25);
    const up = marquee_rect(start, { x: 90, y: 0 }, { style: 'Fixed Ratio', fixed_width: 1, fixed_height: 1 });
    expect(up).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('fixed size ignores the mouse', () => {
    expect(marquee_rect(start, { x: 500, y: 5 }, { style: 'Fixed Size', fixed_width: 64, fixed_height: 32 }))
      .toEqual({ x: 100, y: 100, width: 64, height: 32 });
    expect(marquee_rect(start, start, { style: 'Fixed Size', fixed_width: 64, fixed_height: 32, alt: true }))
      .toEqual({ x: 36, y: 68, width: 128, height: 64 });
  });
});

describe('fill_alpha', () => {
  it('defaults to fully filled and clamps', () => {
    expect(fill_alpha(null)).toBe(1);
    expect(fill_alpha({})).toBe(1);
    expect(fill_alpha({ fill_opacity: 40 })).toBe(0.4);
    expect(fill_alpha({ fill_opacity: 0 })).toBe(0);
    expect(fill_alpha({ fill_opacity: 400 })).toBe(1);
    expect(fill_alpha({ fill_opacity: 'x' as any })).toBe(1);
  });
});

import { push_color, parse_history, normalize_hex } from '../src/js/libs/color-history.js';

describe('color history', () => {
  it('normalizes and rejects colors', () => {
    expect(normalize_hex('#AABBCC')).toBe('#aabbcc');
    expect(normalize_hex('aabbcc')).toBe('#aabbcc');
    expect(normalize_hex('red')).toBeNull();
  });

  it('puts the newest first, moves repeats to the front and limits the size', () => {
    expect(push_color(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111']);
    expect(push_color(['#111111'], '#333333')).toEqual(['#333333', '#111111']);
    expect(push_color(['#111111', '#222222'], '#333333', 2)).toEqual(['#333333', '#111111']);
    expect(push_color(['#111111'], 'nope')).toEqual(['#111111']);
  });

  it('parses the cookie value and ignores garbage and duplicates', () => {
    expect(parse_history('#aaaaaa,xx,#AAAAAA,#bbbbbb')).toEqual(['#aaaaaa', '#bbbbbb']);
    expect(parse_history(undefined as any)).toEqual([]);
  });
});

import { is_pixel_grid_visible, pixel_grid_positions } from '../src/js/libs/pixel-grid.js';

describe('pixel grid', () => {
  it('shows only at high zoom', () => {
    expect(is_pixel_grid_visible(1)).toBe(false);
    expect(is_pixel_grid_visible(5.9)).toBe(false);
    expect(is_pixel_grid_visible(6)).toBe(true);
  });

  it('lists pixel borders only inside the visible part of the image', () => {
    expect(pixel_grid_positions(2.4, 5.1, 100)).toEqual([2, 3, 4, 5, 6]);
    expect(pixel_grid_positions(-10, 3, 100)).toEqual([1, 2, 3]);
    expect(pixel_grid_positions(97, 200, 100)).toEqual([97, 98, 99]);
    expect(pixel_grid_positions(5, 3, 100)).toEqual([]);
  });
});

import { normalize_stops, simple_stops, layer_stops, gradient_type, reverse_stops, reflect_stops, color_at, diamond_pixels, preset_stops, GRADIENT_PRESETS, stop_css } from '../src/js/libs/gradient.js';

describe('gradient stops', () => {
  it('normalizes broken input', () => {
    expect(normalize_stops(null as any)).toHaveLength(2);
    const list = normalize_stops([{ pos: 2, color: 'red; x', alpha: 999 }, { pos: -1, color: '#FFF', alpha: 'x' as any }]);
    expect(list.map((s) => s.pos)).toEqual([0, 1]);
    expect(list[0].color).toBe('#ffffff');
    expect(list[0].alpha).toBe(255);
    expect(list[1].color).toBe('#000000'); //not a color
    expect(list[1].alpha).toBe(255);
    expect(normalize_stops([{ pos: 0.5, color: '#112233', alpha: 10 }])).toHaveLength(2);
    expect(normalize_stops(new Array(40).fill({ pos: 0, color: '#000000', alpha: 1 }))).toHaveLength(16);
  });

  it('older layers use the two colors, newer ones the editor stops', () => {
    expect(layer_stops({ color_1: '#ff0000', color_2: '#0000ff', alpha: 0 })).toEqual([
      { pos: 0, color: '#ff0000', alpha: 255 }, { pos: 1, color: '#0000ff', alpha: 0 }]);
    const stops = [{ pos: 0, color: '#000000', alpha: 255 }, { pos: 0.5, color: '#ff0000', alpha: 255 }, { pos: 1, color: '#ffffff', alpha: 255 }];
    expect(layer_stops({ stops, color_1: '#00ff00' })).toEqual(stops);
  });

  it('knows the type, also of older layers', () => {
    expect(gradient_type({ radial: true })).toBe('Radial');
    expect(gradient_type({ radial: false })).toBe('Linear');
    expect(gradient_type({ type: { value: 'Diamond' } })).toBe('Diamond');
    expect(gradient_type({ type: 'nonsense' })).toBe('Linear');
  });

  it('reverses and reflects', () => {
    const stops = simple_stops('#000000', '#ffffff', 255);
    expect(reverse_stops(stops).map((s) => s.color)).toEqual(['#ffffff', '#000000']);
    const reflected = reflect_stops(stops);
    expect(reflected.map((s) => s.pos)).toEqual([0, 0.5, 0.5, 1]);
    expect(reflected.map((s) => s.color)).toEqual(['#ffffff', '#000000', '#000000', '#ffffff']);
  });

  it('interpolates colors and alpha', () => {
    const stops = simple_stops('#000000', '#ff0000', 0);
    expect(color_at(stops, 0)).toEqual([0, 0, 0, 255]);
    expect(color_at(stops, 0.5)).toEqual([128, 0, 0, 128]);
    expect(color_at(stops, 2)).toEqual([255, 0, 0, 0]);
  });

  it('css color for canvas', () => {
    expect(stop_css({ pos: 0, color: '#ff8000', alpha: 255 })).toBe('rgba(255, 128, 0, 1)');
    expect(stop_css({ pos: 0, color: '#ff8000', alpha: 0 })).toBe('rgba(255, 128, 0, 0)');
  });

  it('diamond: first color in the middle, last color at the end of the drag', () => {
    const stops = simple_stops('#000000', '#ffffff', 255);
    const w = 21;
    const pixels = diamond_pixels(w, w, { x: 10.5, y: 10.5, rx: 10, ry: 0 }, stops);
    const at = (x: number, y: number) => pixels[(y * w + x) * 4];
    expect(at(10, 10)).toBeLessThan(15);
    expect(at(0, 10)).toBeGreaterThan(230);
    //all four directions are the same (a square set on its corner)
    expect(at(10, 0)).toBe(at(0, 10));
    expect(at(10, 20)).toBe(at(20, 10));
    expect(pixels[3]).toBe(255);
  });

  it('presets fill in the foreground and background', () => {
    const fg = GRADIENT_PRESETS.find((p) => p.name == 'Foreground to Transparent')!;
    const stops = preset_stops(fg, '#123456', '#abcdef');
    expect(stops[0].color).toBe('#123456');
    expect(stops[1].alpha).toBe(0);
    const both = preset_stops(GRADIENT_PRESETS[1], '#123456', '#abcdef');
    expect(both[1].color).toBe('#abcdef');
  });
});

describe('colorToAlpha', () => {
  it('makes the color transparent and keeps other colors', () => {
    const img = colorToAlpha(image(2, 1, [[255, 255, 255, 255], [255, 0, 0, 255]]), { color: '#ffffff' });
    const d = Array.from(img.data);
    expect(d[3]).toBe(0);
    expect(d.slice(4, 8)).toEqual([255, 0, 0, 255]);
  });

  it('a mix of the color and an object becomes the object color with partial alpha', () => {
    const img = colorToAlpha(image(1, 1, [[255, 128, 128, 255]]), { color: '#ffffff' });
    const d = Array.from(img.data);
    expect(d.slice(0, 3)).toEqual([255, 0, 0]);
    expect(d[3]).toBeGreaterThan(120);
    expect(d[3]).toBeLessThan(135);
  });

  it('works with black and respects the original alpha and the threshold', () => {
    const black = colorToAlpha(image(1, 1, [[0, 0, 0, 200]]), { color: '#000000' });
    expect(black.data[3]).toBe(0);
    const part = colorToAlpha(image(1, 1, [[10, 10, 10, 200]]), { color: '#000000', threshold: 10 });
    expect(part.data[3]).toBe(0);
    const kept = colorToAlpha(image(1, 1, [[255, 255, 255, 100]]), { color: '#000000' });
    expect(Array.from(kept.data)).toEqual([255, 255, 255, 100]);
  });
});

import { is_clipped, can_clip, clip_base } from '../src/js/libs/clipping.js';

describe('clipping mask', () => {
  const layers = [
    { id: 1, order: 1, composition: 'source-over' },
    { id: 2, order: 2, composition: 'source-atop' },
    { id: 3, order: 3, composition: 'source-atop' },
    { id: 4, order: 4, composition: 'source-over' },
  ];

  it('recognizes clipped layers', () => {
    expect(is_clipped(layers[1])).toBe(true);
    expect(is_clipped(layers[0])).toBe(false);
    expect(is_clipped(null)).toBe(false);
  });

  it('the bottom layer can not be clipped', () => {
    expect(can_clip(layers, 1)).toBe(false);
    expect(can_clip(layers, 4)).toBe(true);
    expect(can_clip(layers, 99)).toBe(false);
  });

  it('finds the base of a stack of clipped layers', () => {
    expect((clip_base(layers, 3) as any).id).toBe(1);
    expect((clip_base(layers, 2) as any).id).toBe(1);
    expect(clip_base(layers, 4)).toBeNull();
  });
});

import { describe_transform, apply_transform } from '../src/js/libs/transform-repeat.js';
import { stabilize } from '../src/js/libs/stabilizer.js';
import { arbitrary_canvas_size, rotate_point_arbitrary, straighten_angle } from '../src/js/libs/canvas-rotate.js';
import { safe_layer_name, layer_file_names } from '../src/js/libs/export-names.js';
import { smoothing_for_mode } from '../src/js/libs/resample.js';

describe('black & white and solarize', () => {
  it('black and white uses the slider of the color of the pixel', () => {
    const img = blackWhite(image(3, 1, [[255, 0, 0, 255], [255, 255, 0, 255], [90, 90, 90, 40]]), {});
    const d = Array.from(img.data);
    expect(d.slice(0, 4)).toEqual([102, 102, 102, 255]); //reds 40 %
    expect(d.slice(4, 8)).toEqual([153, 153, 153, 255]); //yellows 60 %
    expect(d.slice(8, 12)).toEqual([90, 90, 90, 40]); //gray stays, alpha too
    const bright = blackWhite(image(1, 1, [[255, 0, 0, 255]]), { reds: 100 });
    expect(bright.data[0]).toBe(255);
  });

  it('tint colors the gray picture', () => {
    const img = blackWhite(image(1, 1, [[200, 200, 200, 255]]), { tint: true, tint_color: '#ff8000' });
    expect(img.data[0]).toBeGreaterThan(img.data[2]);
  });

  it('solarize inverts only the bright channels', () => {
    const img = solarize(image(1, 1, [[200, 100, 128, 255]]), 128);
    expect(Array.from(img.data)).toEqual([55, 100, 127, 255]);
  });
});

describe('transform again', () => {
  const before = { x: 10, y: 10, width: 100, height: 50, rotate: 0 };

  it('describes and repeats a scale around the center and a rotation', () => {
    const after = { x: -15, y: -2.5, width: 150, height: 75, rotate: 15 };
    const change = describe_transform(before, after)!;
    expect(change.scale_x).toBe(1.5);
    expect(change.dx).toBe(0);
    expect(change.rotate).toBe(15);
    const again = apply_transform({ x: 0, y: 0, width: 40, height: 40, rotate: 350 }, change);
    expect(again).toEqual({ x: -10, y: -10, width: 60, height: 60, rotate: 5 });
  });

  it('repeats a move and ignores no change', () => {
    const change = describe_transform(before, { ...before, x: 30, y: 5 })!;
    expect(apply_transform({ x: 0, y: 0, width: 10, height: 10, rotate: 0 }, change)).toEqual({ x: 20, y: -5, width: 10, height: 10, rotate: 0 });
    expect(describe_transform(before, { ...before })).toBeNull();
  });
});

describe('stabilizer', () => {
  it('lags behind the mouse and does nothing at zero', () => {
    expect(stabilize({ x: 0, y: 0 }, { x: 100, y: 50 }, 0)).toEqual({ x: 100, y: 50 });
    expect(stabilize({ x: 0, y: 0 }, { x: 100, y: 50 }, 50)).toEqual({ x: 50, y: 25 });
    expect(stabilize(null as any, { x: 5, y: 5 }, 90)).toEqual({ x: 5, y: 5 });
    const strong = stabilize({ x: 0, y: 0 }, { x: 100, y: 0 }, 1000);
    expect(strong.x).toBeCloseTo(5);
  });
});

describe('arbitrary rotation geometry', () => {
  it('canvas grows to hold the turned picture', () => {
    expect(arbitrary_canvas_size(200, 100, 0)).toEqual({ width: 200, height: 100 });
    expect(arbitrary_canvas_size(200, 100, 90)).toEqual({ width: 100, height: 200 });
    const s = arbitrary_canvas_size(100, 100, 45);
    expect(s.width).toBe(142);
    expect(s.height).toBe(142);
  });

  it('the center stays in the center and a corner goes around it', () => {
    const old_size = { width: 200, height: 100 };
    const new_size = arbitrary_canvas_size(200, 100, 90);
    const center = rotate_point_arbitrary({ x: 100, y: 50 }, old_size, new_size, 90);
    expect(center.x).toBeCloseTo(50);
    expect(center.y).toBeCloseTo(100);
    //the top left corner of a picture turned clockwise by 90 degrees is the top right one
    const corner = rotate_point_arbitrary({ x: 0, y: 0 }, old_size, new_size, 90);
    expect(corner.x).toBeCloseTo(100);
    expect(corner.y).toBeCloseTo(0);
  });

  it('straighten finds the smallest turn that makes the line horizontal', () => {
    expect(straighten_angle({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0);
    expect(straighten_angle({ x: 0, y: 0 }, { x: 100, y: 10 })).toBeCloseTo(-5.71, 1);
    expect(straighten_angle({ x: 100, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(-5.71, 1); //the other direction
    expect(straighten_angle({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(-90);
    expect(straighten_angle({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
  });
});

describe('export layers names and resampling', () => {
  it('cleans layer names', () => {
    expect(safe_layer_name('My photo.JPG')).toBe('My-photo');
    expect(safe_layer_name('../../etc/passwd')).toBe('etcpasswd');
    expect(safe_layer_name('   ')).toBe('layer');
    expect(safe_layer_name(null as any)).toBe('layer');
    expect(safe_layer_name('Žlutý kůň')).toBe('Žlutý-kůň');
  });

  it('numbers the files so equal names do not collide', () => {
    expect(layer_file_names([{ name: 'a' }, { name: 'a' }])).toEqual(['01-a.png', '02-a.png']);
    expect(layer_file_names(new Array(100).fill({ name: 'x' }))[99]).toBe('100-x.png');
  });

  it('nearest neighbor turns smoothing off', () => {
    expect(smoothing_for_mode('Nearest Neighbor').enabled).toBe(false);
    expect(smoothing_for_mode('Bicubic')).toEqual({ enabled: true, quality: 'high' });
    expect(smoothing_for_mode('Bilinear').quality).toBe('low');
    expect(smoothing_for_mode('Basic').enabled).toBe(true);
  });
});

import { spherize, ripple, kaleidoscope, radialBlur, crystallize } from '../src/js/libs/distort.js';
import { surfaceBlur } from '../src/js/libs/filters.js';
import { rounded_rect_mask } from '../src/js/libs/selection-mask.js';
import { link_changes, toggle_link_changes, unlink_changes, linked_with, next_link_id, follow_transform } from '../src/js/libs/layer-link.js';
import { symmetry_transforms, symmetric_points } from '../src/js/libs/symmetry.js';
import { fit_tip_size, tip_mask, tip_has_paint, stamps_along, clean_stored_tip, load_stored_tip, save_stored_tip } from '../src/js/libs/brush-tip.js';
import { dynamics_settings, has_dynamics, noise, apply_dynamics } from '../src/js/libs/brush-dynamics.js';
import { transform_mask } from '../src/js/libs/selection-mask.js';
import { warp_settings, warp_text } from '../src/js/libs/text-warp.js';
import { normalize_range, is_default as blend_default, range_table, apply_blend_if, range_from_settings, settings_from_range } from '../src/js/libs/blend-if.js';
import { ADJUSTMENTS, is_adjustment, default_settings, clean_settings, adjust_image, mix_adjusted } from '../src/js/libs/adjustment-layers.js';
import { quad_for, quad_bounds, is_valid_quad, solve_homography, warp_to_quad, handles_for, handle_position, find_handle, drag_handle } from '../src/js/libs/perspective.js';
import { identity_mesh, is_identity_mesh, displacement_at, warp_mesh } from '../src/js/libs/mesh-warp.js';
import { box_blur, point_in_polygon, patch_region, picture_to_layer, vector_to_layer } from '../src/js/libs/patch.js';
import * as Actions from '../src/js/libs/actions.js';
import { normalize_view, is_transformed, css_transform, screen_to_picture, screen_delta_to_picture } from '../src/js/libs/view-transform.js';
import { heal_from, heal_spot } from '../src/js/libs/retouch.js';
import { frame_of, to_local, from_local, handle_points, hit_test, drag_transform, IDENTITY as ID_T } from '../src/js/libs/selection-transform.js';
import { reverse_steps, apply_steps } from '../src/js/libs/layer-order.js';

describe('reverse layer order', () => {
  it('the steps turn the stack upside down', () => {
    for (const ids of [[1, 2], [1, 2, 3], [5, 6, 7, 8, 9], [1]]) {
      expect(apply_steps(ids, reverse_steps(ids))).toEqual(ids.concat().reverse());
    }
    expect(reverse_steps([1, 2, 3, 4, 5, 6])).toHaveLength(15);
  });
});

function gradient_image(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = Math.round(x / (w - 1) * 255);
    data[i + 1] = Math.round(y / (h - 1) * 255);
    data[i + 2] = 100;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('distort and blur filters', () => {
  it('spherize with zero amount changes nothing, bulge pulls the center outward and keeps the edge', () => {
    const base = gradient_image(41, 41);
    const same = spherize(gradient_image(41, 41), { amount: 0 });
    expect(Array.from(same.data)).toEqual(Array.from(base.data));
    const bulge = spherize(gradient_image(41, 41), { amount: 80 });
    //a point halfway to the edge shows what was closer to the center
    const i = (20 * 41 + 30) * 4;
    expect(bulge.data[i]).toBeLessThan(base.data[i]);
    //the corner is outside the circle
    expect(bulge.data[0]).toBe(base.data[0]);
  });

  it('ripple, kaleidoscope and radial blur keep the size and alpha', () => {
    for (const run of [
      (img: any) => ripple(img, { amplitude: 3, wavelength: 20 }),
      (img: any) => kaleidoscope(img, { segments: 6, angle: 10 }),
      (img: any) => radialBlur(img, { mode: 'spin', amount: 50 }),
      (img: any) => radialBlur(img, { mode: 'zoom', amount: 50 }),
    ]) {
      const out = run(gradient_image(30, 20));
      expect(out.data).toHaveLength(30 * 20 * 4);
      expect(out.data[3]).toBe(255);
      expect(out.data[(10 * 30 + 15) * 4 + 3]).toBe(255);
    }
  });

  it('kaleidoscope is mirrored around the center line of the wedge', () => {
    const out = kaleidoscope(gradient_image(41, 41), { segments: 4, angle: 0 });
    //with 4 segments the picture is symmetric when mirrored along the diagonal (x and y swap)
    const at = (x: number, y: number) => out.data[(y * 41 + x) * 4 + 2];
    expect(at(30, 25)).toBe(at(25, 30));
  });

  it('radial blur with zero amount does nothing and blur averages along the spin', () => {
    const base = gradient_image(21, 21);
    expect(Array.from(radialBlur(gradient_image(21, 21), { amount: 0 }).data)).toEqual(Array.from(base.data));
    const blurred = radialBlur(gradient_image(21, 21), { mode: 'zoom', amount: 100, center_x: 50, center_y: 50 });
    const middle = (10 * 21 + 10) * 4;
    expect(blurred.data[middle]).toBe(base.data[middle]); //the center does not move
  });

  it('crystallize makes cells of one color', () => {
    const out = crystallize(gradient_image(60, 60), { size: 20, seed: 1 });
    const colors = new Set<string>();
    for (let i = 0; i < out.data.length; i += 4) colors.add(out.data[i] + ',' + out.data[i + 1] + ',' + out.data[i + 2]);
    expect(colors.size).toBeLessThanOrEqual(40);
    expect(colors.size).toBeGreaterThan(2);
    expect(out.data[3]).toBe(255);
    //the same seed gives the same picture
    expect(Array.from(crystallize(gradient_image(60, 60), { size: 20, seed: 1 }).data)).toEqual(Array.from(out.data));
  });

  it('surface blur keeps a hard edge and smooths noise', () => {
    const w = 12;
    const data = new Uint8ClampedArray(w * 4 * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const base = x < 6 ? 20 : 220;
      const noise = (x + y) % 2 ? 6 : -6;
      data[i] = data[i + 1] = data[i + 2] = base + noise;
      data[i + 3] = 255;
    }
    const out = surfaceBlur({ width: w, height: 4, data }, { radius: 3, threshold: 30 });
    const at = (x: number, y: number) => out.data[(y * w + x) * 4];
    expect(Math.abs(at(2, 1) - at(2, 2))).toBeLessThan(6); //noise smoothed
    expect(at(5, 1)).toBeLessThan(40); //the dark side did not take the bright color
    expect(at(6, 1)).toBeGreaterThan(200);
  });
});

describe('rounded_rect_mask', () => {
  it('rounds the corners and keeps the middle and the straight edges', () => {
    const mask = rounded_rect_mask({ x: 10, y: 10, width: 40, height: 30 }, 10, 60, 50);
    const at = (x: number, y: number) => mask.data[y * 60 + x];
    expect(at(10, 10)).toBe(0); //corner pixel
    expect(at(30, 25)).toBe(255);
    expect(at(30, 10)).toBe(255); //straight top edge
    expect(at(10, 25)).toBe(255);
    expect(at(5, 25)).toBe(0); //outside
    expect(at(49, 39)).toBe(0);
  });

  it('zero radius is the plain rectangle and a huge radius is limited', () => {
    const plain = rounded_rect_mask({ x: 2, y: 2, width: 6, height: 6 }, 0, 10, 10);
    expect(plain.data[2 * 10 + 2]).toBe(255);
    expect(plain.data[1 * 10 + 1]).toBe(0);
    const limited = rounded_rect_mask({ x: 0, y: 0, width: 20, height: 10 }, 999, 20, 10);
    expect(limited.data[5 * 20 + 10]).toBe(255);
    expect(limited.data[0]).toBe(0);
  });
});

describe('layer links', () => {
  const layers = () => [{ id: 1, link_id: null }, { id: 2, link_id: null }, { id: 3, link_id: null }, { id: 4, link_id: 7 }, { id: 5, link_id: 7 }];

  it('links the active layer with the chosen ones under a new id', () => {
    const changes = link_changes(layers(), { id: 1, link_id: null }, [2, 3]);
    expect(changes).toEqual([{ id: 1, link_id: 8 }, { id: 2, link_id: 8 }, { id: 3, link_id: 8 }]);
    expect(next_link_id(layers())).toBe(8);
  });

  it('uses the group of the active layer and removes the layers that are not chosen', () => {
    const changes = link_changes(layers(), { id: 4, link_id: 7 }, [1]);
    expect(changes).toEqual([{ id: 1, link_id: 7 }, { id: 5, link_id: null }]);
  });

  it('a group of one layer is no group', () => {
    //removing the only partner of layer 4 clears layer 4 as well
    const changes = unlink_changes(layers(), layers()[4]);
    expect(changes).toEqual([{ id: 4, link_id: null }, { id: 5, link_id: null }]);
    expect(link_changes(layers(), { id: 1, link_id: null }, [])).toEqual([]);
  });

  it('shift+click toggles a layer in the group of the active layer', () => {
    const added = toggle_link_changes(layers(), { id: 4, link_id: 7 }, 2);
    expect(added).toEqual([{ id: 2, link_id: 7 }]);
    const removed = toggle_link_changes(layers(), { id: 4, link_id: 7 }, 5);
    expect(removed).toEqual([{ id: 4, link_id: null }, { id: 5, link_id: null }]);
    expect(toggle_link_changes(layers(), { id: 4, link_id: 7 }, 4)).toEqual([]);
    expect(toggle_link_changes(layers(), { id: 4, link_id: 7 }, 99)).toEqual([]);
  });

  it('finds the layers linked with a layer', () => {
    expect(linked_with(layers(), layers()[3]).map((l) => l.id)).toEqual([5]);
    expect(linked_with(layers(), layers()[0])).toEqual([]);
  });
});

describe('symmetry painting', () => {
  it('has the stroke itself first and the right number of copies', () => {
    expect(symmetry_transforms('Off')).toHaveLength(1);
    expect(symmetry_transforms('Horizontal')).toHaveLength(2);
    expect(symmetry_transforms('Both')).toHaveLength(4);
    expect(symmetry_transforms('Radial 6')).toHaveLength(6);
    expect(symmetry_transforms({ value: 'Radial 3' } as any)).toHaveLength(3);
    expect(symmetry_transforms('nonsense')).toHaveLength(1);
    expect(symmetry_transforms(undefined as any)).toHaveLength(1);
  });

  it('mirrors and turns points around the center', () => {
    const center = { x: 100, y: 50 };
    const mirrored = symmetric_points({ x: 80, y: 20 }, center, 'Horizontal');
    expect(mirrored[0]).toEqual({ x: 80, y: 20 });
    expect(mirrored[1]).toEqual({ x: 120, y: 20 });
    const both = symmetric_points({ x: 80, y: 20 }, center, 'Both');
    expect(both.map((p) => [p.x, p.y])).toEqual([[80, 20], [120, 20], [80, 80], [120, 80]]);
    const radial = symmetric_points({ x: 110, y: 50 }, center, 'Radial 4');
    expect(radial[1].x).toBeCloseTo(100);
    expect(radial[1].y).toBeCloseTo(60);
    expect(radial[2].x).toBeCloseTo(90);
  });
});

describe('custom brush tip', () => {
  it('scales big pictures down and keeps small ones', () => {
    expect(fit_tip_size(1000, 500)).toEqual({ width: 128, height: 64 });
    expect(fit_tip_size(20, 10)).toEqual({ width: 20, height: 10 });
    expect(fit_tip_size(1, 5000)).toEqual({ width: 1, height: 128 });
  });

  it('dark pixels paint, white and transparent ones do not', () => {
    const mask = tip_mask(image(3, 1, [[0, 0, 0, 255], [255, 255, 255, 255], [0, 0, 0, 0]]));
    expect(Array.from(mask.data)).toEqual([255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 0]);
    const gray = tip_mask(image(1, 1, [[128, 128, 128, 255]]));
    expect(gray.data[3]).toBeGreaterThan(120);
    expect(gray.data[3]).toBeLessThan(135);
    expect(tip_has_paint(mask)).toBe(true);
    expect(tip_has_paint(tip_mask(image(1, 1, [[255, 255, 255, 255]])))).toBe(false);
  });

  it('places stamps at an even distance along the stroke', () => {
    const stamps = stamps_along([[0, 0, 10], [10, 0, 10]], 2);
    expect(stamps.map((s) => s.x)).toEqual([0, 2, 4, 6, 8, 10]);
    //the distance continues over the corner of the line and the size is interpolated
    const bent = stamps_along([[0, 0, 4], [3, 0, 4], [3, 3, 8]], 2);
    expect(bent.map((s) => [Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10])).toEqual([[0, 0], [2, 0], [3, 1], [3, 3]]);
    expect(bent[bent.length - 1].size).toBe(8);
  });

  it('a break starts a new line and a single point is one stamp', () => {
    const stamps = stamps_along([[0, 0, 5], null, [100, 0, 5]], 10);
    expect(stamps).toHaveLength(2);
    expect(stamps_along([[5, 5, 9]], 3)).toEqual([{ x: 5, y: 5, size: 9 }]);
    expect(stamps_along([], 3)).toEqual([]);
  });
});

describe('brush dynamics', () => {
  const stamps = [0, 1, 2, 3, 4].map((i) => ({ x: i * 10, y: 0, size: 20 }));

  it('knows when nothing is on', () => {
    expect(has_dynamics({})).toBe(false);
    expect(has_dynamics({ scatter: 0, size_jitter: { value: 0 }, follow_direction: false })).toBe(false);
    expect(has_dynamics({ scatter: 10 })).toBe(true);
    expect(has_dynamics({ follow_direction: { value: true } })).toBe(true);
    expect(dynamics_settings({ scatter: 9999, size_jitter: -5, angle_jitter: 'x' })).toMatchObject({ scatter: 300, size_jitter: 0, angle_jitter: 0 });
  });

  it('noise is stable, in range and different for different inputs', () => {
    expect(noise(3, 7, 1)).toBe(noise(3, 7, 1));
    const values = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const n = noise(1, i, 2);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      values.add(n);
    }
    expect(values.size).toBeGreaterThan(190);
    expect(noise(1, 2, 3)).not.toBe(noise(1, 2, 4));
  });

  it('does nothing to the stamps with all settings at zero', () => {
    const out = apply_dynamics(stamps, {}, 0);
    expect(out.map((s) => [s.x, s.y, s.size, s.angle, s.alpha])).toEqual(stamps.map((s) => [s.x, s.y, 20, 0, 1]));
  });

  it('is the same every time and keeps the changes inside the limits', () => {
    const params = { scatter: 50, size_jitter: 50, angle_jitter: 100, opacity_jitter: 80 };
    const a = apply_dynamics(stamps, params, 4);
    const b = apply_dynamics(stamps, params, 4);
    expect(a).toEqual(b);
    expect(apply_dynamics(stamps, params, 5)).not.toEqual(a);
    a.forEach((s, i) => {
      expect(Math.abs(s.x - stamps[i].x)).toBeLessThanOrEqual(10.0001);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(10.0001);
      expect(s.size).toBeGreaterThanOrEqual(10);
      expect(s.size).toBeLessThanOrEqual(20);
      expect(Math.abs(s.angle)).toBeLessThanOrEqual(Math.PI);
      expect(s.alpha).toBeGreaterThanOrEqual(0.2);
      expect(s.alpha).toBeLessThanOrEqual(1);
    });
  });

  it('follows the direction of the stroke', () => {
    const right = apply_dynamics(stamps, { follow_direction: true }, 0);
    right.forEach((s) => expect(s.angle).toBeCloseTo(0));
    const down = apply_dynamics(stamps.map((s) => ({ x: 0, y: s.x, size: 20 })), { follow_direction: true }, 0);
    down.forEach((s) => expect(s.angle).toBeCloseTo(Math.PI / 2));
    expect(apply_dynamics([{ x: 1, y: 1, size: 5 }], { follow_direction: true }, 0)[0].angle).toBe(0);
  });
});

describe('transform_mask', () => {
  function square(w: number, h: number, x: number, y: number, size_x: number, size_y: number) {
    const data = new Uint8ClampedArray(w * h);
    for (let yy = y; yy < y + size_y; yy++) for (let xx = x; xx < x + size_x; xx++) data[yy * w + xx] = 255;
    return { width: w, height: h, data };
  }
  const count = (m: { data: Uint8ClampedArray }) => Array.from(m.data).filter((v) => v > 127).length;
  const bounds = (m: { width: number; height: number; data: Uint8ClampedArray }) => {
    let l = 1e9, t = 1e9, r = -1, b = -1;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.data[y * m.width + x] > 127) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
    return { l, t, r, b };
  };

  it('no change keeps the selection', () => {
    const mask = square(40, 40, 10, 10, 20, 10);
    expect(Array.from(transform_mask(mask, {}).data)).toEqual(Array.from(mask.data));
  });

  it('scales around the center of the selection', () => {
    const out = transform_mask(square(60, 60, 25, 25, 10, 10), { scale_x: 200, scale_y: 200 });
    expect(bounds(out)).toEqual({ l: 20, t: 20, r: 39, b: 39 });
  });

  it('turns by 90 degrees: a wide selection becomes tall', () => {
    const out = transform_mask(square(60, 60, 20, 25, 20, 10), { rotate: 90 });
    const b = bounds(out);
    expect(b.r - b.l + 1).toBe(10);
    expect(b.b - b.t + 1).toBe(20);
    expect(count(out)).toBe(200);
  });

  it('moves and clips at the edge, an empty selection stays empty', () => {
    const moved = transform_mask(square(40, 40, 10, 10, 10, 10), { dx: 5, dy: -5 });
    expect(bounds(moved)).toEqual({ l: 15, t: 5, r: 24, b: 14 });
    const clipped = transform_mask(square(40, 40, 10, 10, 10, 10), { dx: 100 });
    expect(count(clipped)).toBe(0);
    expect(count(transform_mask({ width: 5, height: 5, data: new Uint8ClampedArray(25) }, { scale_x: 300 }))).toBe(0);
  });
});

describe('warp text', () => {
  const W = 120;
  const H = 80;
  //a horizontal black bar in the middle of a transparent picture; the text box is the bar
  function bar() {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 35; y < 45; y++) for (let x = 30; x < 90; x++) {
      const i = (y * W + x) * 4;
      data[i + 3] = 255;
    }
    return { width: W, height: H, data };
  }
  const box = { x: 30, y: 35, width: 60, height: 10 };
  //the top row of the bar (first row with something) in a column
  const top = (img: { data: Uint8ClampedArray }, x: number) => {
    for (let y = 0; y < H; y++) if (img.data[(y * W + x) * 4 + 3] > 127) return y;
    return -1;
  };
  const rows = (img: { data: Uint8ClampedArray }, x: number) => {
    let n = 0;
    for (let y = 0; y < H; y++) if (img.data[(y * W + x) * 4 + 3] > 127) n++;
    return n;
  };

  it('reads the settings and ignores nonsense', () => {
    expect(warp_settings({})).toEqual({ style: 'None', bend: 0 });
    expect(warp_settings({ warp_style: 'Arc', warp_bend: 50 })).toEqual({ style: 'Arc', bend: 50 });
    expect(warp_settings({ warp_style: { value: 'Flag' }, warp_bend: 999 })).toEqual({ style: 'Flag', bend: 100 });
    expect(warp_settings({ warp_style: 'Hack', warp_bend: 50 }).style).toBe('None');
    expect(warp_settings({ warp_style: 'Arc', warp_bend: 0 }).style).toBe('None');
  });

  it('no warp changes nothing', () => {
    const img = warp_text(bar(), { style: 'None', bend: 0 }, box);
    expect(Array.from(img.data)).toEqual(Array.from(bar().data));
  });

  it('arc lifts the middle above the ends, a negative bend does the opposite', () => {
    const up = warp_text(bar(), { style: 'Arc', bend: 60 }, box);
    expect(top(up, 60)).toBeLessThan(top(up, 36));
    const down = warp_text(bar(), { style: 'Arc', bend: -60 }, box);
    expect(top(down, 60)).toBeGreaterThan(top(down, 36));
  });

  it('bulge makes the middle taller than the ends', () => {
    const img = warp_text(bar(), { style: 'Bulge', bend: 80 }, box);
    expect(rows(img, 60)).toBeGreaterThan(rows(img, 33));
  });

  it('flag moves the text up and down along its length', () => {
    const img = warp_text(bar(), { style: 'Flag', bend: 70 }, box);
    const tops = [32, 45, 60, 75, 88].map((x) => top(img, x));
    expect(new Set(tops).size).toBeGreaterThan(2);
  });

  it('rise makes one end taller than the other and squeeze narrows the middle rows', () => {
    const rise = warp_text(bar(), { style: 'Rise', bend: 80 }, box);
    expect(rows(rise, 88)).toBeGreaterThan(rows(rise, 32));
    for (const style of ['Wave', 'Squeeze'] as const) {
      const out = warp_text(bar(), { style, bend: 50 }, box);
      expect(out.data).toHaveLength(W * H * 4);
    }
  });
});

describe('blend if', () => {
  it('normalizes the ranges', () => {
    expect(normalize_range(null as any)).toEqual([0, 0, 255, 255]);
    expect(normalize_range([50, 10, 300, -5])).toEqual([50, 50, 255, 255]);
    expect(blend_default(null)).toBe(true);
    expect(blend_default({ this: [0, 0, 255, 255], below: [0, 0, 255, 255] })).toBe(true);
    expect(blend_default({ this: [10, 10, 255, 255], below: [0, 0, 255, 255] })).toBe(false);
  });

  it('the table is 0 outside, 1 inside and a ramp in the soft part', () => {
    const t = range_table([50, 100, 200, 250]);
    expect(t[10]).toBe(0);
    expect(t[50]).toBe(0);
    expect(t[75]).toBeCloseTo(0.5);
    expect(t[100]).toBe(1);
    expect(t[150]).toBe(1);
    expect(t[225]).toBeCloseTo(0.5);
    expect(t[251]).toBe(0);
    const all = range_table([0, 0, 255, 255]);
    expect(all[0]).toBe(1);
    expect(all[255]).toBe(1);
  });

  it('hides the layer where it is dark and keeps the color of what is left', () => {
    const layer = { width: 3, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]) };
    const backdrop = { width: 3, height: 1, data: new Uint8ClampedArray([200, 200, 200, 255, 200, 200, 200, 255, 200, 200, 200, 255]) };
    apply_blend_if(layer, backdrop, { this: [100, 100, 255, 255], below: [0, 0, 255, 255] });
    expect(Array.from(layer.data)).toEqual([0, 0, 0, 0, 128, 128, 128, 255, 255, 255, 255, 255]);
  });

  it('can look at what is below the layer', () => {
    const layer = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 100]) };
    const backdrop = { width: 2, height: 1, data: new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]) };
    //the layer shows only over bright places
    apply_blend_if(layer, backdrop, { this: [0, 0, 255, 255], below: [200, 200, 255, 255] });
    expect(layer.data[3]).toBe(0);
    expect(layer.data[7]).toBe(100);
  });

  it('converts between the dialog settings and the stored range', () => {
    expect(range_from_settings(40, 20, 220, 30)).toEqual([40, 60, 190, 220]);
    expect(settings_from_range([40, 60, 190, 220])).toEqual({ dark: 40, dark_soft: 20, light: 220, light_soft: 30 });
    expect(range_from_settings(0, 0, 255, 0)).toEqual([0, 0, 255, 255]);
    expect(range_from_settings(250, 100, 255, 0)).toEqual([250, 255, 255, 255]);
  });
});

describe('adjustment layers', () => {
  it('has a title and a working default for every adjustment', () => {
    for (const key of Object.keys(ADJUSTMENTS)) {
      expect(ADJUSTMENTS[key].title).toBeTruthy();
      const out = adjust_image(image(2, 1, [[10, 120, 240, 255], [200, 30, 90, 128]]), key, default_settings(key));
      expect(out.data).toHaveLength(8);
      expect(out.data[3]).toBe(255);
      expect(out.data[7]).toBe(128); //alpha is never touched
    }
  });

  it('the starting values change nothing (except the ones that are an effect by themselves)', () => {
    const same = ['brightness_contrast', 'levels', 'curves', 'hue_saturation', 'vibrance', 'exposure', 'temperature_tint', 'selective_color'];
    for (const key of same) {
      const out = adjust_image(image(1, 1, [[10, 120, 240, 255]]), key, default_settings(key));
      expect(Array.from(out.data).slice(0, 3)).toEqual([10, 120, 240]);
    }
  });

  it('keeps the curves of a curves adjustment and cleans them', () => {
    expect(default_settings('curves').curves.rgb).toEqual([[0, 0], [255, 255]]);
    const lift = { rgb: [[0, 0], [128, 200], [255, 255]], red: [[0, 0], [255, 255]], green: [[0, 0], [255, 255]], blue: [[0, 0], [255, 255]] };
    const out = adjust_image(image(1, 1, [[128, 128, 128, 255]]), 'curves', { curves: lift });
    expect(out.data[0]).toBe(200);
    expect(out.data[1]).toBe(200);
    //garbage from a project file becomes valid points, unknown names are dropped
    const cleaned = clean_settings('curves', { curves: { rgb: 'x', red: [[300, -5], ['a', 1], [10, 20]], evil: 1 }, evil: 1 });
    expect(cleaned.curves.rgb).toEqual([[0, 0], [255, 255]]);
    expect(cleaned.curves.red.every((p: number[]) => p[0] >= 0 && p[0] <= 255 && p[1] >= 0 && p[1] <= 255)).toBe(true);
    expect(Object.keys(cleaned.curves).sort()).toEqual(['blue', 'green', 'red', 'rgb']);
    expect(cleaned.evil).toBeUndefined();
  });

  it('knows its keys and cleans the stored settings', () => {
    expect(is_adjustment('levels')).toBe(true);
    expect(is_adjustment('constructor')).toBe(false);
    expect(is_adjustment('toString')).toBe(false);
    expect(default_settings('nope')).toEqual({});
    expect(clean_settings('brightness_contrast', { brightness: 20, evil: 'x' })).toEqual({ brightness: 20, contrast: 0 });
    expect(clean_settings('hue_saturation', { colorize: 'yes' }).colorize).toBe(false);
    expect(clean_settings('invert', null)).toEqual({});
  });

  it('does not change the original picture', () => {
    const original = image(1, 1, [[10, 20, 30, 255]]);
    const out = adjust_image(original, 'invert', {});
    expect(Array.from(original.data)).toEqual([10, 20, 30, 255]);
    expect(Array.from(out.data)).toEqual([245, 235, 225, 255]);
  });

  it('opacity and the mask decide how much of the change is taken', () => {
    const original = image(3, 1, [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]]);
    const full = adjust_image(original, 'invert', {});
    const half = mix_adjusted(original, adjust_image(original, 'invert', {}), 0.5, null);
    expect(half.data[0]).toBe(128);
    const masked = mix_adjusted(original, full, 1, new Uint8ClampedArray([255, 0, 128]));
    expect([masked.data[0], masked.data[4], masked.data[8]]).toEqual([255, 0, 128]);
    expect(masked.data[3]).toBe(255);
  });
});

describe('skew, perspective and distort', () => {
  //a 4x2 picture, every pixel has its own red value
  const pic = () => ({ width: 4, height: 2, data: new Uint8ClampedArray(Array.from({ length: 8 }, (_, i) => [i * 30, 100, 50, 255]).flat()) });

  it('solves the transformation of four points', () => {
    const from = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const to = [[2, 1], [14, 3], [12, 12], [0, 9]];
    const H = solve_homography(from, to)!;
    from.forEach((p, i) => {
      const d = H[6] * p[0] + H[7] * p[1] + 1;
      expect((H[0] * p[0] + H[1] * p[1] + H[2]) / d).toBeCloseTo(to[i][0], 6);
      expect((H[3] * p[0] + H[4] * p[1] + H[5]) / d).toBeCloseTo(to[i][1], 6);
    });
    expect(solve_homography([[0, 0], [1, 1], [2, 2], [3, 3]], to)).toBeNull();
  });

  it('the starting values change nothing and the picture comes back the same', () => {
    for (const mode of ['skew', 'perspective', 'distort'] as const) {
      expect(quad_for(mode, {}, 4, 2)).toEqual([[0, 0], [4, 0], [4, 2], [0, 2]]);
    }
    const out = warp_to_quad(pic(), quad_for('skew', {}, 4, 2))!;
    expect(out.x).toBe(0);
    expect(out.image.width).toBe(4);
    expect(Array.from(out.image.data)).toEqual(Array.from(pic().data));
  });

  it('skew leans the picture and makes it wider', () => {
    const quad = quad_for('skew', { horizontal: 45 }, 100, 50);
    //45 degrees: the top goes left and the bottom right by half of the height
    expect(quad[0][0]).toBeCloseTo(-25);
    expect(quad[3][0]).toBeCloseTo(25);
    expect(quad_bounds(quad)).toEqual({ x: -25, y: 0, width: 150, height: 50 });
    const vertical = quad_for('skew', { vertical: -45 }, 100, 50);
    expect(vertical[0][1]).toBeCloseTo(50); //the left side goes down
    expect(vertical[1][1]).toBeCloseTo(-50); //the right side goes up
    expect(is_valid_quad(vertical)).toBe(true);
  });

  it('perspective makes one edge shorter', () => {
    const right = quad_for('perspective', { horizontal: 100 }, 100, 80);
    expect(right[1][1]).toBe(20);
    expect(right[2][1]).toBe(60);
    expect(right[0]).toEqual([0, 0]);
    const left = quad_for('perspective', { horizontal: -100 }, 100, 80);
    expect(left[0][1]).toBe(20);
    expect(left[3][1]).toBe(60);
    const bottom = quad_for('perspective', { vertical: 100 }, 100, 80);
    expect(bottom[3][0]).toBe(25);
    expect(bottom[2][0]).toBe(75);
    const top = quad_for('perspective', { vertical: -100 }, 100, 80);
    expect(top[0][0]).toBe(25);
    expect(top[1][0]).toBe(75);
  });

  it('distort moves every corner by its own numbers', () => {
    const quad = quad_for('distort', { tr_x: -10, br_y: 5, bl_x: 3, bl_y: -2 }, 100, 50);
    expect(quad).toEqual([[0, 0], [90, 0], [100, 55], [3, 48]]);
  });

  it('refuses shapes that fold or have no area', () => {
    expect(is_valid_quad([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(is_valid_quad([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(false); //a bow tie
    expect(is_valid_quad([[0, 0], [10, 0], [20, 0], [0, 0]])).toBe(false);
    expect(warp_to_quad(pic(), [[0, 0], [10, 10], [10, 0], [0, 10]])).toBeNull();
  });

  it('a perspective keeps the picture inside the shape and the outside empty', () => {
    const image = { width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4).fill(255) };
    const quad = quad_for('perspective', { horizontal: 100 }, 20, 20);
    const out = warp_to_quad(image, quad)!;
    const alpha = (x: number, y: number) => out.image.data[(y * out.image.width + x) * 4 + 3];
    expect(out.image.width).toBe(20);
    expect(alpha(2, 10)).toBe(255); //inside, on the tall left side
    expect(alpha(17, 1)).toBe(0); //above the short right edge
    expect(alpha(17, 10)).toBe(255);
    //the left edge is the full height, the right edge a half of it
    let left = 0, right = 0;
    for (let y = 0; y < 20; y++) { if (alpha(1, y) > 127) left++; if (alpha(18, y) > 127) right++; }
    expect(left).toBeGreaterThan(right + 5);
  });
});

describe('mesh warp', () => {
  function ramp(w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round(x / (w - 1) * 255);
      data[i + 1] = Math.round(y / (h - 1) * 255);
      data[i + 2] = 80;
      data[i + 3] = 255;
    }
    return { width: w, height: h, data };
  }

  it('makes a mesh within the limits and knows an untouched one', () => {
    const m = identity_mesh(4, 4);
    expect(m.dx).toHaveLength(16);
    expect(is_identity_mesh(m)).toBe(true);
    m.dx[5] = 0.1;
    expect(is_identity_mesh(m)).toBe(false);
    expect(identity_mesh(1, 99)).toMatchObject({ cols: 2, rows: 12 });
  });

  it('the displacement passes through the points and is smooth between them', () => {
    const m = identity_mesh(4, 4);
    m.dx[1 * 4 + 1] = 0.2;
    expect(displacement_at(m, 1 / 3, 1 / 3)[0]).toBeCloseTo(0.2, 6);
    expect(displacement_at(m, 2 / 3, 2 / 3)[0]).toBeCloseTo(0, 6);
    const between = displacement_at(m, 0.5 / 3 + 1 / 3, 1 / 3)[0];
    expect(between).toBeGreaterThan(0);
    expect(between).toBeLessThan(0.2);
    expect(displacement_at(m, -5, 9)).toHaveLength(2);
  });

  it('an untouched mesh gives the same picture', () => {
    const img = ramp(20, 10);
    const out = warp_mesh(img, identity_mesh(4, 4));
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
  });

  it('moving the middle drags the picture with it', () => {
    const img = ramp(40, 40);
    const m = identity_mesh(3, 3);
    m.dx[4] = 0.2; //the middle point goes right by 8 pixels
    const out = warp_mesh(img, m);
    const red = (x: number, y: number) => out.data[(y * 40 + x) * 4];
    //at the middle the picture shows what was 8 pixels to the left
    expect(red(20, 20)).toBeLessThan(img.data[(20 * 40 + 20) * 4] - 20);
    //the corners did not move
    expect(red(0, 0)).toBe(img.data[0]);
  });

  it('shifting everything leaves a transparent gap and keeps alpha elsewhere', () => {
    const img = ramp(20, 10);
    const m = identity_mesh(2, 2);
    m.dx.fill(0.5);
    const out = warp_mesh(img, m);
    expect(out.data[3]).toBe(0); //the left side shows nothing now
    expect(out.data[(5 * 20 + 19) * 4 + 3]).toBe(255);
    expect(out.data[(5 * 20 + 19) * 4]).toBe(img.data[(5 * 20 + 9) * 4]);
  });
});

describe('warp with big moves', () => {
  it('every source point lands where the mesh moves it', () => {
    const w = 80;
    const h = 80;
    const img = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        img.data[p] = x * 3; //the red channel says where the pixel came from
        img.data[p + 1] = y * 3;
        img.data[p + 3] = 255;
      }
    }
    const m = identity_mesh(4, 4);
    m.dx[5] = 0.18; //a point moves by 14 pixels, more than one step of the old sampling can follow
    m.dy[5] = 0.06;
    const out = warp_mesh(img, m);
    let checked = 0;
    for (const [qx, qy] of [[27, 27], [30, 22], [20, 30], [35, 35]]) {
      const d = displacement_at(m, (qx + 0.5) / w, (qy + 0.5) / h);
      const px = Math.round(qx + d[0] * w);
      const py = Math.round(qy + d[1] * h);
      const p = (py * w + px) * 4;
      expect(Math.abs(out.data[p] - qx * 3)).toBeLessThanOrEqual(12);
      expect(Math.abs(out.data[p + 1] - qy * 3)).toBeLessThanOrEqual(12);
      checked++;
    }
    expect(checked).toBe(4);
  });
});

describe('patch tool', () => {
  const W = 60;
  const H = 40;
  //gray picture with a bright defect at 10..15 and a clean but brighter place at 40..45
  function scene(clean_value: number) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 100;
      data[i * 4 + 3] = 255;
    }
    const paint = (x0: number, y0: number, size: number, value: number) => {
      for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) {
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = value;
      }
    };
    paint(10, 15, 6, 255); //the defect
    //the right half is the clean place (brighter than the left side when the value is higher)
    for (let y = 0; y < H; y++) for (let x = 30; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = clean_value;
    }
    return { width: W, height: H, data };
  }
  function square_mask(x0: number, y0: number, size: number) {
    const data = new Uint8ClampedArray(W * H);
    for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) data[y * W + x] = 255;
    return { width: W, height: H, data };
  }
  const red = (img: { data: Uint8ClampedArray }, x: number, y: number) => img.data[(y * W + x) * 4];

  it('box blur averages and keeps a flat picture flat', () => {
    const flat = box_blur(new Float32Array(25).fill(7), 5, 5, 2);
    expect(Array.from(flat).every((v) => Math.abs(v - 7) < 1e-4)).toBe(true);
    const spike = new Float32Array(9);
    spike[4] = 9;
    const out = box_blur(spike, 3, 3, 1);
    expect(out[4]).toBeCloseTo(1);
    expect(box_blur(spike, 3, 3, 0)[4]).toBe(9);
  });

  it('finds out if a point is inside of a polygon', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(point_in_polygon(5, 5, square)).toBe(true);
    expect(point_in_polygon(15, 5, square)).toBe(false);
    expect(point_in_polygon(5, -1, square)).toBe(false);
  });

  it('covers the defect with the clean place and leaves everything else alone', () => {
    const img = scene(100);
    const before = new Uint8ClampedArray(img.data);
    patch_region(img, square_mask(9, 14, 8), 30, 0, {});
    expect(red(img, 12, 17)).toBe(100); //the defect is gone
    expect(red(img, 2, 2)).toBe(100);
    expect(red(img, 45, 20)).toBe(before[(20 * W + 45) * 4]); //the clean place stays as it was
    expect(red(img, 30, 20)).toBe(before[(20 * W + 30) * 4]);
    expect(img.data[(17 * W + 12) * 4 + 3]).toBe(255);
  });

  it('the colors follow the surroundings of the defect, unless the adaptation is off', () => {
    const adapted = scene(130);
    patch_region(adapted, square_mask(9, 14, 8), 30, 0, { adapt: 100 });
    expect(Math.abs(red(adapted, 12, 17) - 100)).toBeLessThan(6);
    const plain = scene(130);
    patch_region(plain, square_mask(9, 14, 8), 30, 0, { adapt: 0 });
    expect(red(plain, 12, 17)).toBe(130);
  });

  it('does nothing without a mask or without a move, and skips places outside of the picture', () => {
    const img = scene(100);
    const same = new Uint8ClampedArray(img.data);
    patch_region(img, square_mask(9, 14, 8), 0, 0, {});
    patch_region(img, { width: W, height: H, data: new Uint8ClampedArray(W * H) }, 5, 5, {});
    expect(Array.from(img.data)).toEqual(Array.from(same));
    patch_region(img, square_mask(9, 14, 8), -500, 0, {});
    expect(red(img, 12, 17)).toBe(255); //nothing to take from there
  });

  it('a soft edge: the pixels at the border of the mask are only partly replaced', () => {
    const img = scene(100);
    const mask = square_mask(10, 15, 6);
    patch_region(img, mask, 30, 0, { adapt: 0 });
    //just outside of the mask the defect did not reach, so the picture is gray anyway
    expect(red(img, 8, 17)).toBe(100);
    expect(red(img, 12, 17)).toBe(100);
  });
});

describe('actions', () => {
  const menu = [{ name: 'Image', children: [{ name: 'Invert', target: 'image/adjustments.invert' }, { name: 'Flip', target: 'image/flip.vertical', parameter: 'x' }] },
    { name: 'File', children: [{ name: 'Open', target: 'file/open.open_file' }] }];
  const allowed = Actions.collect_targets(menu, [{ target: 'edit/fill.fill' }]);

  function memory() {
    const data: Record<string, string> = {};
    return { getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
  }

  it('collects the targets of a menu', () => {
    expect(Array.from(allowed).sort()).toEqual(['edit/fill.fill', 'file/open.open_file', 'image/adjustments.invert', 'image/flip.vertical']);
  });

  it('records only known commands that are not files, history or the like', () => {
    expect(Actions.can_record('image/adjustments.invert', allowed)).toBe(true);
    expect(Actions.can_record('image/adjustments.invert', null)).toBe(true);
    expect(Actions.can_record('file/open.open_file', allowed)).toBe(false);
    expect(Actions.can_record('edit/undo.undo', null)).toBe(false);
    expect(Actions.can_record('image/unknown.thing', allowed)).toBe(false);
    expect(Actions.can_record('edit/transform.skew', null)).toBe(false); //done with the mouse
    expect(Actions.can_record('edit/warp.warp', null)).toBe(false);
    expect(Actions.can_record('constructor', null)).toBe(false);
    expect(Actions.can_record('../../x.y', null)).toBe(false);
    expect(Actions.can_record(42 as any, null)).toBe(false);
  });

  it('checks an action from outside and cuts it to size', () => {
    const evil = {
      name: '<b>Look</b>', id: 'a b c!',
      steps: [
        { target: 'image/adjustments.invert', parameter: { x: 1 }, dialogs: [{ a: 1, b: { deep: 1 }, c: 'x'.repeat(1000), 'bad key!': 2 }] },
        { target: 'file/open.open_file' },
        { target: 'nope' },
        null,
      ],
    };
    const action = Actions.sanitize_action(evil, allowed)!;
    expect(action.name).toBe('bLook/b');
    expect(action.id).not.toBe('a b c!');
    expect(action.steps).toHaveLength(1);
    expect(action.steps[0].parameter).toBeNull();
    expect(Object.keys(action.steps[0].dialogs[0])).toEqual(['a', 'c']);
    expect((action.steps[0].dialogs[0] as any).c).toHaveLength(500);
    expect(Actions.sanitize_action({ steps: [] }, allowed)).toBeNull();
    expect(Actions.sanitize_action('x', allowed)).toBeNull();
    expect(Actions.sanitize_action({ steps: new Array(500).fill({ target: 'image/flip.vertical' }) }, allowed)!.steps).toHaveLength(Actions.MAX_STEPS);
  });

  it('saves and loads, and survives broken storage', () => {
    const storage = memory();
    expect(Actions.load_actions(storage, allowed)).toEqual([]);
    const action = Actions.sanitize_action({ name: 'Mine', steps: [{ target: 'image/flip.vertical', parameter: 'x', dialogs: [] }] }, allowed)!;
    expect(Actions.save_actions(storage, [action])).toBe(true);
    expect(Actions.load_actions(storage, allowed)).toEqual([action]);
    storage.setItem(Actions.STORAGE_KEY, '{not json');
    expect(Actions.load_actions(storage, allowed)).toEqual([]);
    storage.setItem(Actions.STORAGE_KEY, JSON.stringify([{ steps: [{ target: 'file/open.open_file' }] }, 7]));
    expect(Actions.load_actions(storage, allowed)).toEqual([]);
    expect(Actions.save_actions({ getItem: () => null, setItem: () => { throw new Error('full'); } }, [action])).toBe(false);
    expect(Actions.load_actions(null as any, allowed)).toEqual([]);
  });

  it('exports and imports a file', () => {
    const action = Actions.sanitize_action({ name: 'Look', steps: [{ target: 'image/adjustments.invert', dialogs: [{ amount: 5 }] }] }, allowed)!;
    const text = Actions.export_action(action);
    expect(text).not.toContain(action.id);
    const back = Actions.import_action(text, allowed)!;
    expect(back.name).toBe('Look');
    expect(back.steps).toEqual(action.steps);
    expect(back.id).not.toBe(action.id);
    expect(Actions.import_action('{"format":"other"}', allowed)).toBeNull();
    expect(Actions.import_action('garbage', allowed)).toBeNull();
  });

  it('records commands with the settings of their dialogs', () => {
    Actions.set_allowed_targets(allowed);
    const changes: any[] = [];
    Actions.on_recording_change((r: any) => changes.push(r && r.steps.length));
    Actions.start_recording('Test');
    expect(Actions.is_recording()).toBe(true);
    Actions.note_target('image/adjustments.invert', null);
    Actions.note_target('file/open.open_file', null); //not recorded
    Actions.note_target('image/flip.vertical', 'x');
    Actions.note_dialog_done({ amount: 7, nope: () => 1 });
    Actions.note_target('edit/fill.fill', null);
    Actions.note_dialog_cancelled(); //the dialog of the last command was cancelled: it did nothing
    const action = Actions.stop_recording()!;
    expect(Actions.is_recording()).toBe(false);
    expect(action.steps.map((s) => s.target)).toEqual(['image/adjustments.invert', 'image/flip.vertical']);
    expect(action.steps[1].dialogs).toEqual([{ amount: 7 }]);
    expect(changes[0]).toBe(0);
    expect(changes[changes.length - 1]).toBeNull();
    //nothing recorded -> no action
    Actions.start_recording('Empty');
    expect(Actions.stop_recording()).toBeNull();
  });

  it('plays the recorded settings on top of the starting values of a dialog', () => {
    Actions.begin_replay({ target: 'image/flip.vertical', parameter: null, dialogs: [{ amount: 9 }, { mode: 'b' }] });
    expect(Actions.is_replaying()).toBe(true);
    const definition = [{ name: 'amount', value: 1 }, { name: 'mode', values: ['a', 'b'] }, { heading: 'x' }];
    expect(Actions.next_replay_params(definition)).toEqual({ amount: 9, mode: 'a' });
    expect(Actions.next_replay_params(definition)).toEqual({ amount: 1, mode: 'b' });
    expect(Actions.next_replay_params(definition)).toEqual({ amount: 1, mode: 'a' }); //nothing left: the starting values
    Actions.end_replay();
    expect(Actions.is_replaying()).toBe(false);
    expect(Actions.describe_step({ target: 'image/flip.vertical', parameter: 'x', dialogs: [] })).toBe('Vertical (x)');
  });
});

describe('view transform', () => {
  const size = { width: 200, height: 100 };
  const center = { x: 500, y: 300 };

  it('normalizes the angle', () => {
    expect(normalize_view(null)).toEqual({ rotate: 0, flip: false });
    expect(normalize_view({ rotate: 270 })).toEqual({ rotate: -90, flip: false });
    expect(normalize_view({ rotate: -190, flip: 1 as any })).toEqual({ rotate: 170, flip: true });
    expect(normalize_view({ rotate: 'x' as any })).toEqual({ rotate: 0, flip: false });
    expect(normalize_view({ rotate: 360 }).rotate).toBe(0);
  });

  it('says when something is changed and makes the css', () => {
    expect(is_transformed({ rotate: 0, flip: false })).toBe(false);
    expect(is_transformed({ rotate: 0.5, flip: false })).toBe(true);
    expect(css_transform({ rotate: 0, flip: false })).toBe('');
    expect(css_transform({ rotate: 30, flip: false })).toBe('rotate(30deg)');
    expect(css_transform({ rotate: 90, flip: true })).toBe('rotate(90deg) scaleX(-1)');
  });

  it('an unchanged view maps the middle of the screen to the middle of the picture', () => {
    const p = screen_to_picture(center, center, size, { rotate: 0, flip: false });
    expect(p).toEqual({ x: 100, y: 50 });
    expect(screen_to_picture({ x: 560, y: 320 }, center, size, { rotate: 0, flip: false })).toEqual({ x: 160, y: 70 });
  });

  it('a view turned by 90 degrees clockwise: the top of the picture is on the right', () => {
    const view = { rotate: 90, flip: false };
    //the top left corner of the picture (0,0) is at the top right of the turned picture:
    //screen offset from the center is (+50, -100)
    const p = screen_to_picture({ x: center.x + 50, y: center.y - 100 }, center, size, view);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    //the bottom left corner (0,100) is at the top left: (-50, -100)
    const q = screen_to_picture({ x: center.x - 50, y: center.y - 100 }, center, size, view);
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(100);
  });

  it('a mirrored view swaps left and right', () => {
    const view = { rotate: 0, flip: true };
    const p = screen_to_picture({ x: center.x + 100, y: center.y - 50 }, center, size, view);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('moving the mouse the way the picture is shown moves it on the picture the right way', () => {
    expect(screen_delta_to_picture(10, 0, { rotate: 0, flip: false })).toEqual({ x: 10, y: 0 });
    const turned = screen_delta_to_picture(10, 0, { rotate: 90, flip: false });
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(-10);
    const mirrored = screen_delta_to_picture(10, 4, { rotate: 0, flip: true });
    expect(mirrored).toEqual({ x: -10, y: 4 });
  });
});

describe('healing brush with a source', () => {
  const W = 80;
  const H = 40;
  //a gray picture with a dark spot at (20,20) and a clean but slightly brighter place at (60,20)
  function scene(clean: number) {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 100;
      data[i * 4 + 3] = 255;
    }
    for (let y = 0; y < H; y++) for (let x = 45; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = clean;
    }
    for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) {
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 20;
    }
    return { width: W, height: H, data };
  }
  const red = (img: { data: Uint8ClampedArray }, x: number, y: number) => img.data[(y * W + x) * 4];

  it('covers the spot with the chosen place, in the colors of the surroundings', () => {
    const img = scene(130);
    expect(heal_from(img, 20, 20, 6, 60, 20, true)).toBe(true);
    expect(Math.abs(red(img, 20, 20) - 100)).toBeLessThan(12); //the colors follow the surroundings of the spot
    const plain = scene(130);
    heal_from(plain, 20, 20, 6, 60, 20, false);
    expect(red(plain, 20, 20)).toBe(130); //texture only
    expect(red(plain, 5, 5)).toBe(100); //far from the spot nothing changes
  });

  it('skips the places that would be copied from outside of the picture', () => {
    const img = scene(100);
    const before = red(img, 20, 20);
    heal_from(img, 20, 20, 6, -200, 20, true);
    expect(red(img, 20, 20)).toBe(before);
  });

  it('the automatic spot healing still works', () => {
    const img = scene(100);
    heal_spot(img, 20, 20, 6, true);
    expect(red(img, 20, 20)).toBeGreaterThan(80);
  });
});

describe('dragging the corners of a shape', () => {
  const rect = [[0, 0], [100, 0], [100, 60], [0, 60]];

  it('shows the corners for Distort and Perspective and the edges for Skew', () => {
    expect(handles_for('distort')).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(handles_for('perspective')).toEqual(['tl', 'tr', 'br', 'bl']);
    expect(handles_for('skew')).toEqual(['top', 'right', 'bottom', 'left']);
  });

  it('knows where the handles are', () => {
    expect(handle_position(rect, 'br')).toEqual({ x: 100, y: 60 });
    expect(handle_position(rect, 'top')).toEqual({ x: 50, y: 0 });
    expect(handle_position(rect, 'right')).toEqual({ x: 100, y: 30 });
    expect(handle_position(rect, 'bottom')).toEqual({ x: 50, y: 60 });
    expect(handle_position(rect, 'left')).toEqual({ x: 0, y: 30 });
  });

  it('finds the handle that is near a point and only those of the mode', () => {
    expect(find_handle(rect, 'distort', { x: 97, y: 4 }, 10)).toBe('tr');
    expect(find_handle(rect, 'distort', { x: 50, y: 30 }, 10)).toBeNull();
    expect(find_handle(rect, 'distort', { x: 50, y: 1 }, 10)).toBeNull(); //the edges are for Skew
    expect(find_handle(rect, 'skew', { x: 50, y: 1 }, 10)).toBe('top');
    expect(find_handle(rect, 'skew', { x: 98, y: 2 }, 3)).toBeNull();
  });

  it('distort moves only the dragged corner, the original shape stays as it was', () => {
    const quad = drag_handle(rect, 'distort', 'tr', -20, 15);
    expect(quad).toEqual([[0, 0], [80, 15], [100, 60], [0, 60]]);
    expect(rect[1]).toEqual([100, 0]);
  });

  it('perspective moves the neighbors the opposite way', () => {
    //the top left corner dragged right and down: the top right one goes left, the bottom left one goes up
    const quad = drag_handle(rect, 'perspective', 'tl', 10, 6);
    expect(quad).toEqual([[10, 6], [90, 0], [100, 60], [0, 54]]);
    const bottom = drag_handle(rect, 'perspective', 'br', -10, -6);
    expect(bottom).toEqual([[0, 0], [100, 6], [90, 54], [10, 60]]);
    expect(is_valid_quad(quad)).toBe(true);
  });

  it('skew slides an edge along itself', () => {
    const top = drag_handle(rect, 'skew', 'top', 25, 99);
    expect(top).toEqual([[25, 0], [125, 0], [100, 60], [0, 60]]);
    const right = drag_handle(rect, 'skew', 'right', 99, -10);
    expect(right).toEqual([[0, 0], [100, -10], [100, 50], [0, 60]]);
    const left = drag_handle(rect, 'skew', 'left', 5, 8);
    expect(left).toEqual([[0, 8], [100, 0], [100, 60], [0, 68]]);
    //a corner does nothing in Skew
    expect(drag_handle(rect, 'skew', 'tl', 10, 10)).toEqual(rect);
  });
});

describe('transform selection with the mouse', () => {
  const bounds = { x: 100, y: 50, width: 80, height: 40 }; //center (140, 70)
  const near = (a: { x: number; y: number }, x: number, y: number) => {
    expect(a.x).toBeCloseTo(x, 4);
    expect(a.y).toBeCloseTo(y, 4);
  };

  it('the frame of an untouched selection is its rectangle', () => {
    const f = frame_of(bounds, ID_T);
    expect([f.cx, f.cy, f.hw, f.hh, f.angle]).toEqual([140, 70, 40, 20, 0]);
    const p = handle_points(bounds, ID_T, 20);
    near(p.tl, 100, 50);
    near(p.br, 180, 90);
    near(p.right, 180, 70);
    near(p.top, 140, 50);
    near(p.rotate, 140, 30);
  });

  it('local and picture coordinates go both ways, also when turned', () => {
    const f = frame_of(bounds, { scale_x: 200, scale_y: 100, rotate: 90, dx: 10, dy: -5 });
    const local = { x: 12, y: -7 };
    const back = to_local(from_local(local, f), f);
    near(back, 12, -7);
    //turned by 90 degrees the local x axis points down
    near(from_local({ x: 10, y: 0 }, f), 150, 75);
  });

  it('knows what is under the mouse', () => {
    expect(hit_test(bounds, ID_T, { x: 180, y: 90 }, 8, 20)).toBe('br');
    expect(hit_test(bounds, ID_T, { x: 140, y: 52 }, 8, 20)).toBe('top');
    expect(hit_test(bounds, ID_T, { x: 140, y: 30 }, 8, 20)).toBe('rotate');
    expect(hit_test(bounds, ID_T, { x: 120, y: 70 }, 8, 20)).toBe('move');
    expect(hit_test(bounds, ID_T, { x: 200, y: 100 }, 8, 20)).toBe('rotate'); //a little outside
    expect(hit_test(bounds, ID_T, { x: 400, y: 400 }, 8, 20)).toBeNull();
  });

  it('move adds the distance', () => {
    const t = drag_transform(bounds, ID_T, 'move', { x: 120, y: 70 }, { x: 150, y: 60 });
    expect([t.dx, t.dy, t.scale_x, t.rotate]).toEqual([30, -10, 100, 0]);
  });

  it('a corner scales and the opposite corner stays where it is', () => {
    const t = drag_transform(bounds, ID_T, 'br', { x: 180, y: 90 }, { x: 260, y: 130 });
    expect(t.scale_x).toBeCloseTo(200);
    expect(t.scale_y).toBeCloseTo(200);
    const p = handle_points(bounds, t, 0);
    near(p.tl, 100, 50);
    near(p.br, 260, 130);
  });

  it('an edge scales only in its direction', () => {
    const t = drag_transform(bounds, ID_T, 'right', { x: 180, y: 70 }, { x: 140, y: 999 });
    expect(t.scale_x).toBeCloseTo(50);
    expect(t.scale_y).toBe(100);
    near(handle_points(bounds, t, 0).left, 100, 70);
  });

  it('shift keeps the proportions, alt scales around the center', () => {
    const shift = drag_transform(bounds, ID_T, 'br', { x: 180, y: 90 }, { x: 260, y: 100 }, { shift: true });
    expect(shift.scale_x).toBeCloseTo(shift.scale_y);
    expect(shift.scale_x).toBeCloseTo(200);
    const alt = drag_transform(bounds, ID_T, 'right', { x: 180, y: 70 }, { x: 220, y: 70 }, { alt: true });
    expect(alt.scale_x).toBeCloseTo(200); //the edge is now 80 pixels from the center (a half of 160)
    expect([alt.dx, alt.dy]).toEqual([0, 0]);
  });

  it('can not be made smaller than a few pixels or bigger than 1000 %', () => {
    const tiny = drag_transform(bounds, ID_T, 'right', { x: 180, y: 70 }, { x: 0, y: 70 });
    expect(tiny.scale_x).toBeGreaterThan(0);
    near(handle_points(bounds, tiny, 0).left, 100, 70);
    const huge = drag_transform(bounds, ID_T, 'right', { x: 180, y: 70 }, { x: 99999, y: 70 });
    expect(huge.scale_x).toBe(1000);
    near(handle_points(bounds, huge, 0).left, 100, 70);
  });

  it('turning follows the mouse around the center and shift snaps to 15 degrees', () => {
    const t = drag_transform(bounds, ID_T, 'rotate', { x: 140, y: 30 }, { x: 180, y: 70 });
    expect(t.rotate).toBeCloseTo(90);
    const snapped = drag_transform(bounds, ID_T, 'rotate', { x: 140, y: 30 }, { x: 175, y: 36 }, { shift: true });
    expect(snapped.rotate % 15).toBe(0);
    expect(drag_transform(bounds, { ...ID_T, rotate: 170 }, 'rotate', { x: 140, y: 30 }, { x: 100, y: 70 }).rotate).toBeLessThanOrEqual(180);
  });

  it('scaling a turned frame keeps its opposite corner', () => {
    const start = { scale_x: 100, scale_y: 100, rotate: 90, dx: 0, dy: 0 };
    const before = handle_points(bounds, start, 0);
    //the right edge of the turned frame is at the bottom; drag it further down
    const grab = before.right;
    const t = drag_transform(bounds, start, 'right', grab, { x: grab.x, y: grab.y + 40 });
    expect(t.scale_x).toBeCloseTo(150);
    near(handle_points(bounds, t, 0).left, before.left.x, before.left.y);
  });
});

describe('brush tip kept between sessions', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const memory = () => {
    const items: Record<string, string> = {};
    return { getItem: (k: string) => (k in items ? items[k] : null), setItem: (k: string, v: string) => { items[k] = v; } };
  };

  it('accepts only a small png data url with a plain id', () => {
    expect(clean_stored_tip({ id: '1-2', data: png })).toEqual({ id: '1-2', data: png });
    expect(clean_stored_tip({ id: '1-2', data: 'data:text/html;base64,AAAA' })).toBeNull();
    expect(clean_stored_tip({ id: '<x>', data: png })).toBeNull();
    expect(clean_stored_tip({ id: '1', data: 'data:image/png;base64,' + 'A'.repeat(300000) })).toBeNull();
    expect(clean_stored_tip(null)).toBeNull();
    expect(clean_stored_tip('x')).toBeNull();
  });

  it('saves a tip and reads it back, bad storage gives nothing', () => {
    const store = memory();
    expect(load_stored_tip(store)).toBeNull();
    expect(save_stored_tip({ id: 'a', data: png }, store)).toBe(true);
    expect(load_stored_tip(store)).toEqual({ id: 'a', data: png });
    expect(save_stored_tip({ id: 'a', data: 'nope' }, store)).toBe(false);
    store.setItem('webphos_brush_tip', '{not json');
    expect(load_stored_tip(store)).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(load_stored_tip(broken)).toBeNull();
    expect(save_stored_tip({ id: 'a', data: png }, broken)).toBe(false);
  });
});

describe('linked layers follow a resize and a turn', () => {
  const active = { x: 100, y: 100, width: 100, height: 50, rotate: 0 };

  it('nothing changes when the active layer does not change', () => {
    const follower = { x: 300, y: 40, width: 20, height: 10, rotate: 0 };
    expect(follow_transform(active, active, follower)).toEqual({ ...follower, rotate: 0 });
  });

  it('scales the distance and the size with the active layer', () => {
    //twice as wide, same height, left edge stays
    const to = { x: 100, y: 100, width: 200, height: 50, rotate: 0 };
    const out = follow_transform(active, to, { x: 250, y: 100, width: 20, height: 10, rotate: 0 });
    //center was 110 right of the center of the active layer, now 220 right of its new center (200)
    expect(out.x + out.width / 2).toBe(420);
    expect(out.width).toBe(40);
    expect(out.height).toBe(10);
    expect(out.y).toBe(100);
  });

  it('turns around the center of the active layer', () => {
    const to = { ...active, rotate: 90 };
    //a layer right of the center goes below it
    const out = follow_transform(active, to, { x: 250, y: 115, width: 20, height: 20, rotate: 0 });
    expect(out.x + out.width / 2).toBeCloseTo(150, 0);
    expect(out.y + out.height / 2).toBeCloseTo(125 + 110, 0);
    expect(out.rotate).toBe(90);
  });

  it('a layer turned a quarter turn away swaps its scales, others scale evenly', () => {
    const to = { x: 100, y: 100, width: 200, height: 50, rotate: 0 };
    const quarter = follow_transform(active, to, { x: 150, y: 100, width: 20, height: 10, rotate: 90 });
    //its width lies along the height of the active layer (scale 1), its height along the width (scale 2)
    expect(quarter.width).toBe(20);
    expect(quarter.height).toBe(20);
    const skew = follow_transform(active, to, { x: 150, y: 100, width: 20, height: 10, rotate: 45 });
    expect(skew.width).toBe(Math.round(20 * Math.sqrt(2)));
    expect(skew.rotate).toBe(45);
  });

  it('never gets smaller than one pixel and survives a flat layer', () => {
    const tiny = follow_transform(active, { ...active, width: 1, height: 1 }, { x: 0, y: 0, width: 2, height: 2, rotate: 0 });
    expect(tiny.width).toBeGreaterThanOrEqual(1);
    const flat = follow_transform({ ...active, width: 0 }, active, { x: 0, y: 0, width: 5, height: 5, rotate: 0 });
    expect(Number.isFinite(flat.x)).toBe(true);
  });
});

describe('fill opacity keeps shadow and glow', () => {
  it('separates the shadows and glows from the other filters', () => {
    const filters = [{ name: 'shadow', id: 1 }, { name: 'stroke', id: 2 }, { name: 'glow', id: 3 }, { name: 'drop-shadow', id: 4 }, { name: 'blur', id: 5 }];
    const { halo, rest } = split_halo_filters(filters);
    expect(halo.map((f) => f.id)).toEqual([1, 3, 4]);
    expect(rest.map((f) => f.id)).toEqual([2, 5]);
  });

  it('survives missing or odd filter lists', () => {
    expect(split_halo_filters(undefined)).toEqual({ halo: [], rest: [] });
    expect(split_halo_filters(null)).toEqual({ halo: [], rest: [] });
    expect(split_halo_filters([null as any])).toEqual({ halo: [], rest: [null] });
  });
});

describe('patch tool on a turned or stretched layer', () => {
  const plain = { x: 10, y: 20, width: 100, height: 50, width_original: 100, height_original: 50, rotate: 0 };

  it('an untouched layer only moves the origin', () => {
    expect(picture_to_layer(plain, 10, 20)).toEqual({ x: 0, y: 0 });
    expect(picture_to_layer(plain, 60, 45)).toEqual({ x: 50, y: 25 });
    expect(vector_to_layer(plain, 7, -3)).toEqual({ x: 7, y: -3 });
  });

  it('a stretched layer scales the points and the moves', () => {
    const wide = { ...plain, width: 200, height: 100 };
    expect(picture_to_layer(wide, 10 + 100, 20 + 50)).toEqual({ x: 50, y: 25 });
    expect(vector_to_layer(wide, 20, 10)).toEqual({ x: 10, y: 5 });
  });

  it('a layer turned a quarter turn swaps the directions', () => {
    const turned = { ...plain, width: 100, height: 50, rotate: 90 };
    //the center of the layer is the center of the picture rectangle (60, 45); a point right of it is "up" in the layer
    const p = picture_to_layer(turned, 60 + 10, 45);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(25 - 10, 5);
    const v = vector_to_layer(turned, 0, 10);
    expect(v.x).toBeCloseTo(10, 5);
    expect(v.y).toBeCloseTo(0, 5);
  });
});

import { group_props_of, is_isolated, effective_alpha, plan_groups, panel_rows, group_ancestors, in_group, clean_group_name, with_group_props } from '../src/js/libs/layer-groups.js';

describe('nested layer groups', () => {
  const props = (opacity: number, composition = 'source-over', mask: object | null = null) => ({ opacity, composition, mask });

  it('knows the groups around a layer and what is inside a group', () => {
    expect(group_ancestors('A/B/C')).toEqual(['A', 'A/B', 'A/B/C']);
    expect(group_ancestors(null)).toEqual([]);
    expect(in_group({ group: 'A/B' }, 'A')).toBe(true);
    expect(in_group({ group: 'AB' }, 'A')).toBe(false);
    expect(in_group({ group: null }, 'A')).toBe(false);
  });

  it('cleans a typed name into a path', () => {
    expect(clean_group_name('  Faces / Eyes ')).toBe('Faces/Eyes');
    expect(clean_group_name('//')).toBe('');
    expect(clean_group_name('a/b/c/d/e/f/g')).toBe('a/b/c/d/e');
    expect(clean_group_name(5 as any)).toBe('');
  });

  it('reads the properties of a group, also from older layers and broken data', () => {
    expect(group_props_of({ group: 'A', group_props: { A: props(40, 'multiply') } }, 'A')).toEqual(props(40, 'multiply'));
    expect(group_props_of({ group: 'A', group_opacity: 30 }, 'A')).toEqual(props(30));
    expect(group_props_of({ group: 'A/B', group_opacity: 30 }, 'A')).toEqual(props(100));
    expect(group_props_of({ group: 'A', group_props: { A: { opacity: 'x', composition: '<script>' } as any } }, 'A')).toEqual(props(100));
    expect(group_props_of({ group: 'A', group_props: 'junk' as any }, 'A')).toEqual(props(100));
    expect(group_props_of({ group: 'A', group_props: { A: props(900) } }, 'A').opacity).toBe(100);
  });

  it('a group mask is kept, checked and makes the group drawn on its own', () => {
    const mask = { width: 2, height: 2, values: [255], counts: [4] };
    expect(group_props_of({ group: 'A', group_props: { A: { opacity: 100, composition: 'source-over', mask } } }, 'A').mask).toBe(mask);
    expect(group_props_of({ group: 'A', group_props: { A: { opacity: 100, composition: 'source-over', mask: { width: 2 } as any } } }, 'A').mask).toBeNull();
    expect(is_isolated(props(100, 'source-over', mask))).toBe(true);
    const map = with_group_props({ group_props: { B: props(50) } }, 'A', props(100, 'source-over', mask));
    expect(Object.keys(map!).sort()).toEqual(['A', 'B']);
    expect(map!.A.mask).toBe(mask);
    expect(map!.B.opacity).toBe(50);
    //back to the defaults: the entry goes away
    expect(with_group_props({ group_props: { A: props(100, 'source-over', mask) } }, 'A', props(100))).toBeNull();
  });

  it('only a group with other properties than the default is drawn on its own', () => {
    expect(is_isolated(props(100))).toBe(false);
    expect(is_isolated(props(99))).toBe(true);
    expect(is_isolated(props(100, 'screen'))).toBe(true);
    expect(effective_alpha({ opacity: 80 })).toBeCloseTo(0.8);
    expect(effective_alpha({})).toBe(1);
  });

  it('plans the drawing: an isolated group is one entry with its layers inside', () => {
    const faded = { A: props(50) };
    const layers = [
      { id: 1, group: null },
      { id: 2, group: 'A', group_props: faded },
      { id: 3, group: null },
      { id: 4, group: 'A/B', group_props: { ...faded, 'A/B': props(100, 'multiply') } },
      { id: 5, group: 'A', group_props: faded },
    ];
    const plan: any[] = plan_groups(layers);
    expect(plan.map((e) => (e.kind == 'group' ? 'G' + e.name : e.id))).toEqual([1, 'GA', 3]);
    const inner: any[] = plan[1].entries;
    //inside A the layer of A/B is drawn on its own, A itself is already taken care of
    expect(inner.map((e) => (e.kind == 'group' ? 'G' + e.name : e.id))).toEqual([2, 'GA/B', 5]);
    expect(inner[1].entries.map((e: any) => e.id)).toEqual([4]);
    expect(plan[1].props.opacity).toBe(50);
  });

  it('groups with the default properties leave the order alone', () => {
    const layers = [{ id: 1, group: 'A' }, { id: 2, group: null }, { id: 3, group: 'A' }];
    expect(plan_groups(layers)).toEqual(layers);
    expect(plan_groups([])).toEqual([]);
  });

  it('a header comes before the first layer of a group, nested groups are indented, folded ones are left out', () => {
    const layers = [{ id: 1, group: 'A/B' }, { id: 2 }, { id: 3, group: 'A' }, { id: 4, group: 'B' }];
    const label = (r: any) => (r.kind == 'header' ? 'H:' + r.label + '@' + r.depth + (r.collapsed ? '-' : '') : r.layer.id + '@' + r.depth);
    expect(panel_rows(layers, []).map(label)).toEqual(['H:A@0', 'H:B@1', '1@2', '3@1', '2@0', 'H:B@0', '4@1']);
    expect(panel_rows(layers, ['A']).map(label)).toEqual(['H:A@0-', '2@0', 'H:B@0', '4@1']);
    expect(panel_rows(layers, ['A/B']).map(label)).toEqual(['H:A@0', 'H:B@1-', '3@1', '2@0', 'H:B@0', '4@1']);
    const first: any = panel_rows(layers, [])[0];
    expect(first.members.map((l: any) => l.id)).toEqual([1, 3]);
  });
});

import { clean_anchors, drag_smooth, flatten_path, bounds_of, hit_path, move_part, path_mask } from '../src/js/libs/pen-path.js';

describe('pen paths', () => {
  const corner = (x: number, y: number) => ({ x, y, in: null, out: null });

  it('keeps only valid anchors from a saved project', () => {
    expect(clean_anchors('x')).toEqual([]);
    const out = clean_anchors([{ x: 1, y: 2, in: { x: 0, y: 0 }, out: 5 }, { x: 'a', y: 1 }, null, { x: 3, y: 4 }]);
    expect(out).toEqual([{ x: 1, y: 2, in: { x: 0, y: 0 }, out: null }, { x: 3, y: 4, in: null, out: null }]);
    expect(clean_anchors(new Array(5000).fill({ x: 1, y: 1 }))).toHaveLength(2000);
  });

  it('a path of corners is a polygon, curves are cut into pieces', () => {
    expect(flatten_path([corner(0, 0), corner(10, 0), corner(10, 10)], false)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(flatten_path([corner(0, 0), corner(10, 0), corner(10, 10)], true)).toHaveLength(3);
    expect(flatten_path([], true)).toEqual([]);
    const a = { x: 0, y: 0, in: null, out: { x: 0, y: 10 } };
    const b = { x: 10, y: 0, in: { x: 10, y: 10 }, out: null };
    const curve = flatten_path([a, b], false, 8);
    expect(curve).toHaveLength(9);
    expect(curve[8]).toEqual({ x: 10, y: 0 });
    //the middle of the arch is above both ends (a positive y goes down)
    expect(curve[4].y).toBeCloseTo(7.5, 5);
  });

  it('a dragged new anchor gets mirrored handles', () => {
    const anchor = corner(10, 10);
    drag_smooth(anchor, { x: 15, y: 10 });
    expect(anchor.out).toEqual({ x: 15, y: 10 });
    expect(anchor.in).toEqual({ x: 5, y: 10 });
  });

  it('finds handles before anchors and moves them together', () => {
    const anchors = [{ x: 10, y: 10, in: { x: 5, y: 10 }, out: { x: 15, y: 10 } }];
    expect(hit_path(anchors, { x: 15, y: 11 }, 4)).toEqual({ index: 0, part: 'out' });
    expect(hit_path(anchors, { x: 10, y: 10 }, 4)).toEqual({ index: 0, part: 'anchor' });
    expect(hit_path(anchors, { x: 50, y: 50 }, 4)).toBeNull();
    move_part(anchors[0], 'out', { x: 10, y: 20 });
    expect(anchors[0].in!.x).toBeCloseTo(10, 5);
    //the other handle keeps its length (5) and points the opposite way
    expect(anchors[0].in!.y).toBeCloseTo(5, 5);
    move_part(anchors[0], 'out', { x: 20, y: 10 }, true);
    expect(anchors[0].in!.y).toBeCloseTo(5, 5);
    move_part(anchors[0], 'anchor', { x: 11, y: 12 });
    expect(anchors[0].out).toEqual({ x: 21, y: 12 });
  });

  it('bounds and the selection of the inside of a path', () => {
    expect(bounds_of([])).toBeNull();
    expect(bounds_of([{ x: 2, y: 3 }, { x: 8, y: 9 }])).toEqual({ x: 2, y: 3, width: 6, height: 6 });
    const mask = path_mask([corner(2, 2), corner(8, 2), corner(8, 8), corner(2, 8)], 10, 10);
    expect(mask.data[5 * 10 + 5]).toBe(255);
    expect(mask.data[0]).toBe(0);
  });
});

import { parse_psd, unpack_bits, blend_mode } from '../src/js/libs/psd.js';

describe('Photoshop files', () => {
  const be = (value: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (value >> (8 * (bytes - 1 - i))) & 255);
  const text = (t: string) => Array.from(t).map((c) => c.charCodeAt(0));

  //a 2x2 RGB file with one layer (2x1 at 0,0): red channel packed with RLE, the others raw
  function psd(options: { red_rle?: boolean } = {}) {
    const raw = (a: number, b: number) => [...be(0, 2), a, b];
    const red = options.red_rle ? [...be(1, 2), ...be(3, 2), 1, 10, 20] : raw(10, 20);
    const channels = [red, raw(30, 40), raw(50, 60), raw(255, 128)];
    const ids = [0, 1, 2, -1];
    const record = [
      ...be(0, 4), ...be(0, 4), ...be(1, 4), ...be(2, 4), ...be(4, 2),
      ...ids.flatMap((id, i) => [...be(id & 0xffff, 2), ...be(channels[i].length, 4)]),
      ...text('8BIM'), ...text('mul '), 128, 0, 2, 0,
      ...be(12, 4), ...be(0, 4), ...be(0, 4), 3, ...text('Foo'),
    ];
    const info = [...be(1, 2), ...record, ...channels.flat()];
    if (info.length % 2) {
      info.push(0);
    }
    const layer_section = [...be(info.length, 4), ...info, ...be(0, 4)];
    const composite = [...be(0, 2), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const bytes = [
      ...text('8BPS'), ...be(1, 2), 0, 0, 0, 0, 0, 0, ...be(3, 2), ...be(2, 4), ...be(2, 4), ...be(8, 2), ...be(3, 2),
      ...be(0, 4), ...be(0, 4), ...be(layer_section.length, 4), ...layer_section, ...composite,
    ];
    return new Uint8Array(bytes).buffer;
  }

  it('reads the size, the layer and its properties', () => {
    const file = parse_psd(psd());
    expect(file.width).toBe(2);
    expect(file.height).toBe(2);
    expect(file.layers).toHaveLength(1);
    const layer = file.layers[0];
    expect(layer.name).toBe('Foo');
    expect(layer.composition).toBe('multiply');
    expect(layer.opacity).toBe(50);
    expect(layer.visible).toBe(false);
    expect([layer.x, layer.y, layer.width, layer.height]).toEqual([0, 0, 2, 1]);
    expect(Array.from(layer.data)).toEqual([10, 30, 50, 255, 20, 40, 60, 128]);
  });

  it('reads RLE channels and the flattened picture', () => {
    const file = parse_psd(psd({ red_rle: true }));
    expect(Array.from(file.layers[0].data).slice(0, 8)).toEqual([10, 30, 50, 255, 20, 40, 60, 128]);
    expect(file.composite).not.toBeNull();
    //planar: red 1 2 3 4, green 5 6 7 8, blue 9 10 11 12
    expect(Array.from(file.composite!.slice(0, 4))).toEqual([1, 5, 9, 255]);
  });

  it('refuses files that are not Photoshop files or are cut off', () => {
    expect(() => parse_psd(new Uint8Array(text('GIF89a....')).buffer)).toThrow();
    const good = new Uint8Array(psd());
    expect(() => parse_psd(good.slice(0, 40).buffer)).toThrow();
    expect(() => parse_psd(good.slice(0, 120).buffer)).toThrow();
    const huge = new Uint8Array(good);
    huge[14] = 0x7f; //height
    expect(() => parse_psd(huge.buffer)).toThrow();
  });

  it('unpacks PackBits rows', () => {
    const out = new Uint8Array(6);
    //copy 2 bytes, repeat 7 four times
    unpack_bits(new Uint8Array([1, 9, 8, 253, 7]), 0, 5, out, 0, 6);
    expect(Array.from(out)).toEqual([9, 8, 7, 7, 7, 7]);
    //a packed row that is too short leaves the rest empty and never reads outside
    const short = new Uint8Array(4);
    unpack_bits(new Uint8Array([3, 1]), 0, 2, short, 0, 4);
    expect(short[0]).toBe(1);
  });

  it('maps the blend modes and ignores unknown ones', () => {
    expect(blend_mode('norm')).toBe('source-over');
    expect(blend_mode('scrn')).toBe('screen');
    expect(blend_mode('xxxx')).toBe('source-over');
    expect(blend_mode('constructor')).toBe('source-over');
  });
});

import { mask_outline, simplify_polygon, polygon_area } from '../src/js/libs/mask-contour.js';

describe('outline of a selection mask', () => {
  function mask(w: number, h: number, fn: (x: number, y: number) => boolean) {
    const data = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fn(x, y) ? 255 : 0;
    return { width: w, height: h, data };
  }

  it('a rectangle gives its four corners', () => {
    const outline = mask_outline(mask(20, 20, (x, y) => x >= 4 && x < 14 && y >= 5 && y < 11));
    expect(outline).toHaveLength(4);
    expect(polygon_area(outline)).toBe(60);
    const xs = outline.map((p) => p.x).sort((a, b) => a - b);
    expect([xs[0], xs[3]]).toEqual([4, 14]);
  });

  it('keeps the biggest area and skips the small one', () => {
    const outline = mask_outline(mask(40, 20, (x, y) => (x >= 2 && x < 20 && y >= 2 && y < 18) || (x >= 30 && x < 33 && y >= 5 && y < 8)));
    expect(polygon_area(outline)).toBe(16 * 18);
  });

  it('a circle becomes a smooth polygon with far fewer points than pixel edges', () => {
    const outline = mask_outline(mask(60, 60, (x, y) => Math.hypot(x - 30, y - 30) < 20));
    expect(outline.length).toBeGreaterThan(8);
    expect(outline.length).toBeLessThan(80);
    expect(polygon_area(outline)).toBeGreaterThan(Math.PI * 400 * 0.93);
    expect(polygon_area(outline)).toBeLessThan(Math.PI * 400 * 1.07);
  });

  it('nothing selected gives nothing', () => {
    expect(mask_outline(mask(5, 5, () => false))).toEqual([]);
  });

  it('simplifying keeps a polygon within the tolerance and survives short input', () => {
    expect(simplify_polygon([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1)).toHaveLength(2);
    const square = [{ x: 0, y: 0 }, { x: 5, y: 0.2 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(simplify_polygon(square, 1)).toHaveLength(4);
  });
});

import { nest_layers } from '../src/js/libs/layer-groups.js';
import { build_psd, blend_key, content_bounds } from '../src/js/libs/psd-write.js';

describe('writing Photoshop files', () => {
  const layer = (name: string, x: number, y: number, w: number, h: number, extra: object = {}) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = i * 3 + 1;
      data[i * 4 + 1] = 100 + i;
      data[i * 4 + 2] = 200 - i;
      data[i * 4 + 3] = i % 2 ? 128 : 255;
    }
    return { name, x, y, width: w, height: h, opacity: 70, visible: true, composition: 'multiply', data, ...extra };
  };

  it('what is written can be read back', () => {
    const a = layer('Background', 0, 0, 4, 3, { composition: 'source-over', opacity: 100 });
    const b = layer('Šedá vrstva', 1, 1, 2, 2, { visible: false });
    const composite = new Uint8ClampedArray(4 * 3 * 4).fill(200);
    for (let i = 0; i < 12; i++) composite[i * 4 + 3] = 255;
    const file = build_psd(4, 3, [a, b], composite);
    const read = parse_psd(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    expect([read.width, read.height]).toEqual([4, 3]);
    expect(read.layers).toHaveLength(2);
    expect(read.layers[0].composition).toBe('source-over');
    expect(read.layers[0].opacity).toBe(100);
    expect(Array.from(read.layers[0].data)).toEqual(Array.from(a.data));
    expect(read.layers[1].composition).toBe('multiply');
    expect(read.layers[1].opacity).toBe(70);
    expect(read.layers[1].visible).toBe(false);
    expect([read.layers[1].x, read.layers[1].y, read.layers[1].width, read.layers[1].height]).toEqual([1, 1, 2, 2]);
    expect(Array.from(read.layers[1].data)).toEqual(Array.from(b.data));
    expect(read.composite).not.toBeNull();
    expect(read.composite![0]).toBe(200);
  });

  it('groups, also inside groups, are written and read back with their settings', () => {
    const picture = (name: string) => layer(name, 0, 0, 2, 2, { composition: 'source-over', opacity: 100 });
    const entries: any[] = [
      picture('Below'),
      { section: 'end' },
      picture('Eye'),
      { section: 'end' },
      picture('Pupil'),
      { section: 'start', name: 'Eyes', opacity: 60, visible: true, composition: 'multiply', pass: false },
      picture('Mouth'),
      { section: 'start', name: 'Faces', opacity: 100, visible: true, composition: 'source-over', pass: true },
      picture('Above'),
    ];
    const file = build_psd(2, 2, entries, new Uint8ClampedArray(16));
    const read = parse_psd(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    expect(read.layers.map((l) => l.name + ':' + (l.group || '-'))).toEqual(['Below:-', 'Eye:Faces', 'Pupil:Faces/Eyes', 'Mouth:Faces', 'Above:-']);
    expect(read.groups['Faces/Eyes']).toEqual({ opacity: 60, composition: 'multiply' });
    expect(read.groups['Faces']).toEqual({ opacity: 100, composition: 'source-over' });
    expect(Object.keys(read.groups).sort()).toEqual(['Faces', 'Faces/Eyes']);
  });

  it('a hidden group hides its layers and a broken group structure does not break reading', () => {
    const picture = (name: string) => layer(name, 0, 0, 1, 1, { composition: 'source-over', opacity: 100 });
    const hidden: any[] = [{ section: 'end' }, picture('In'), { section: 'start', name: 'Gone', opacity: 100, visible: false, composition: 'source-over', pass: true }];
    const read = parse_psd(build_psd(1, 1, hidden, new Uint8ClampedArray(4)).buffer as ArrayBuffer);
    expect(read.layers[0].visible).toBe(false);
    //a header without a divider and a divider without a header
    const broken: any[] = [{ section: 'start', name: 'X', opacity: 100, visible: true, composition: 'source-over' }, picture('A'), { section: 'end' }, picture('B')];
    const again = parse_psd(build_psd(1, 1, broken, new Uint8ClampedArray(4)).buffer as ArrayBuffer);
    expect(again.layers.map((l) => l.name)).toEqual(['A', 'B']);
  });

  it('the group names with a slash are turned into dashes so they stay one level', () => {
    const entries: any[] = [{ section: 'end' }, layer('P', 0, 0, 1, 1), { section: 'start', name: 'a/b', opacity: 100, visible: true, composition: 'source-over' }];
    const read = parse_psd(build_psd(1, 1, entries, new Uint8ClampedArray(4)).buffer as ArrayBuffer);
    expect(read.layers[0].group).toBe('a-b');
    expect(read.groups['__proto__']).toBeUndefined();
  });

  it('nests layers by group, members together at the place of the first one', () => {
    const layers = [{ id: 1, group: 'A/B' }, { id: 2 }, { id: 3, group: 'A' }, { id: 4, group: 'C' }];
    const show = (items: any[]): any[] => items.map((i) => (i.kind == 'layer' ? i.layer.id : { [i.name]: show(i.items) }));
    expect(show(nest_layers(layers))).toEqual([{ A: [{ 'A/B': [1] }, 3] }, 2, { C: [4] }]);
  });

  it('a name with accents does not break the file', () => {
    const file = build_psd(2, 2, [layer('Příliš žluťoučký kůň', 0, 0, 2, 2)], new Uint8ClampedArray(16));
    const read = parse_psd(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    expect(read.layers).toHaveLength(1);
    expect(read.layers[0].name).toBe('Příliš žluťoučký kůň');
  });

  it('knows the blend keys', () => {
    expect(blend_key('screen')).toBe('scrn');
    expect(blend_key('source-over')).toBe('norm');
    expect(blend_key('whatever')).toBe('norm');
    expect(blend_key('constructor')).toBe('norm');
  });

  it('finds the part of a picture that is not transparent', () => {
    const data = new Uint8ClampedArray(5 * 4 * 4);
    data[(2 * 5 + 3) * 4 + 3] = 255;
    data[(1 * 5 + 1) * 4 + 3] = 9;
    expect(content_bounds(data, 5, 4)).toEqual({ x: 1, y: 1, width: 3, height: 2 });
    expect(content_bounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

import { make_identity, layer_signature, stack_signature, split_for_cache, preview_scale, is_pixel_exact } from '../src/js/libs/layer-signature.js';

describe('cache of the layers below the active one', () => {
  const base = () => ({ id: 1, x: 0, y: 0, width: 10, height: 10, opacity: 100, composition: 'source-over', visible: true, filters: [], params: { a: 1 } });

  it('the signature changes with what shows in the picture and only then', () => {
    const identity = make_identity();
    const layer: any = base();
    const first = layer_signature(layer, identity);
    expect(layer_signature({ ...layer }, identity)).toBe(first);
    for (const change of [{ x: 1 }, { opacity: 50 }, { visible: false }, { composition: 'multiply' }, { filters: [{ id: 1, name: 'shadow' }] }, { params: { a: 2 } }, { group_props: { A: { opacity: 50 } } }]) {
      expect(layer_signature({ ...layer, ...change }, identity)).not.toBe(first);
    }
    //private helpers do not count
    expect(layer_signature({ ...layer, _exif: { big: 'x'.repeat(1000) } }, identity)).toBe(first);
  });

  it('a replaced picture, mask or list of points gives another signature, an unchanged one does not', () => {
    const identity = make_identity();
    const picture = {};
    const mask = { width: 1 };
    const points = [1, 2, 3];
    const a = layer_signature({ ...base(), link: picture, mask, data: points }, identity);
    expect(layer_signature({ ...base(), link: picture, mask, data: points }, identity)).toBe(a);
    expect(layer_signature({ ...base(), link: {}, mask, data: points }, identity)).not.toBe(a);
    expect(layer_signature({ ...base(), link: picture, mask: { width: 1 }, data: points }, identity)).not.toBe(a);
    expect(layer_signature({ ...base(), link: picture, mask, data: [1, 2, 3] }, identity)).not.toBe(a);
    //one point more in the same list
    points.push(4);
    expect(layer_signature({ ...base(), link: picture, mask, data: points }, identity)).not.toBe(a);
    //a picture that is still loading differs from the loaded one
    const loading: any = { complete: false };
    const loaded: any = loading;
    const b = layer_signature({ ...base(), link: loaded }, identity);
    loaded.complete = true;
    expect(layer_signature({ ...base(), link: loaded }, identity)).not.toBe(b);
  });

  it('the long lists of a group mask are told by identity and length', () => {
    const identity = make_identity();
    const values = new Array(5000).fill(255);
    const layer = { group_props: { A: { opacity: 100, composition: 'source-over', mask: { width: 2, height: 2, values, counts: [4] } } } };
    const a = layer_signature(layer, identity);
    expect(a.length).toBeLessThan(400);
    expect(layer_signature(layer, identity)).toBe(a);
    expect(layer_signature({ group_props: { A: { ...layer.group_props.A, mask: { width: 2, height: 2, values: [...values], counts: [4] } } } }, identity)).not.toBe(a);
  });

  it('a long data url is told by its length and ends', () => {
    const identity = make_identity();
    const url = 'data:image/png;base64,' + 'A'.repeat(5000);
    expect(layer_signature({ data: url }, identity)).toBe(layer_signature({ data: url }, identity));
    expect(layer_signature({ data: url }, identity)).not.toBe(layer_signature({ data: url + 'B' }, identity));
    expect(layer_signature({ data: url }, identity).length).toBeLessThan(200);
  });

  it('the signature of a stack includes what is outside of the layers', () => {
    const identity = make_identity();
    expect(stack_signature([base()], identity, '10x10')).not.toBe(stack_signature([base()], identity, '20x10'));
  });

  it('knows what looks the same drawn once and magnified', () => {
    const picture = { type: 'image', x: 3, y: 4, width: 5, height: 5, width_original: 5, height_original: 5, rotate: 0, filters: [] };
    expect(is_pixel_exact(picture)).toBe(true);
    expect(is_pixel_exact({ type: 'adjustment' })).toBe(true);
    expect(is_pixel_exact({ ...picture, x: 3.5 })).toBe(false);
    expect(is_pixel_exact({ ...picture, width: 6 })).toBe(false);
    expect(is_pixel_exact({ ...picture, rotate: 5 })).toBe(false);
    expect(is_pixel_exact({ ...picture, filters: [{ name: 'blur' }] })).toBe(false);
    expect(is_pixel_exact({ ...picture, type: 'text' })).toBe(false);
  });

  it('a big document is drawn smaller while it is dragged, a small one is not', () => {
    expect(preview_scale(1920, 1080)).toBe(1);
    expect(preview_scale(2400, 1200)).toBe(1);
    expect(preview_scale(4000, 3000)).toBeCloseTo(Math.sqrt(2e6 / 12e6), 5);
    expect(preview_scale(20000, 20000)).toBe(0.2);
    expect(preview_scale(0, 0)).toBe(1);
    expect(preview_scale(4000, 3000, 6e6)).toBeCloseTo(Math.sqrt(0.5), 5);
  });

  it('decides when the layers below the active one can be reused', () => {
    const layers = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const split = split_for_cache(layers, 2, 1)!;
    expect(split.upper.map((l: any) => l.id)).toEqual([1, 2]);
    expect(split.lower.map((l: any) => l.id)).toEqual([3, 4]);
    //zoomed in: only when nothing below looks different drawn once
    expect(split_for_cache(layers, 2, 2)).toBeNull();
    const pictures = [1, 2, 3, 4].map((id) => ({ id, type: 'image', x: 0, y: 0, width: 5, height: 5, width_original: 5, height_original: 5 }));
    expect(split_for_cache(pictures, 2, 2)).not.toBeNull();
    expect(split_for_cache([pictures[0], pictures[1], pictures[2], { ...pictures[3], rotate: 10 }], 2, 2)).toBeNull();
    expect(split_for_cache(layers, 3, 1)).toBeNull(); //only one layer below
    expect(split_for_cache(layers, 99, 1)).toBeNull(); //no active layer in the list
    expect(split_for_cache([{ id: 1 }, { id: 2 }, { id: 3, composition: 'source-atop' }, { id: 4 }], 1, 1)).toBeNull();
    //a group that has layers on both sides of the border
    expect(split_for_cache([{ id: 1, group: 'A' }, { id: 2 }, { id: 3, group: 'A/B' }, { id: 4 }], 1, 1)).toBeNull();
    expect(split_for_cache([{ id: 1 }, { id: 2 }, { id: 3, group: 'A' }, { id: 4, group: 'A' }], 1, 1)).not.toBeNull();
  });
});

import { long_press_allowed, moved_too_far, attach_long_press, LONG_PRESS_DELAY } from '../src/js/libs/long-press.js';

describe('long press for the context menu', () => {
  it('only the tools that do not paint on a touch allow it', () => {
    expect(long_press_allowed('select')).toBe(true);
    expect(long_press_allowed('selection')).toBe(true);
    expect(long_press_allowed('brush')).toBe(false);
    expect(long_press_allowed('pencil')).toBe(false);
    expect(long_press_allowed(null)).toBe(false);
    expect(long_press_allowed(undefined)).toBe(false);
  });

  it('a finger that moves more than the tolerance is not holding', () => {
    expect(moved_too_far({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
    expect(moved_too_far({ x: 0, y: 0 }, { x: 8, y: 8 })).toBe(true);
    expect(moved_too_far({ x: 0, y: 0 }, { x: 30, y: 0 }, 50)).toBe(false);
  });

  describe('on an element', () => {
    const touch = (type: string, x: number, y: number, count = 1) => {
      const event: any = new Event(type, { bubbles: true, cancelable: true });
      event.touches = type == 'touchend' ? [] : Array.from({ length: count }, () => ({ clientX: x, clientY: y }));
      return event;
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('fires after the delay and cancels the touch end', () => {
      const element = document.createElement('div');
      const pressed: any[] = [];
      attach_long_press(element, (p) => pressed.push([p.clientX, p.clientY]));
      element.dispatchEvent(touch('touchstart', 40, 50));
      jest.advanceTimersByTime(LONG_PRESS_DELAY - 1);
      expect(pressed).toHaveLength(0);
      jest.advanceTimersByTime(2);
      expect(pressed).toEqual([[40, 50]]);
      const end = touch('touchend', 0, 0);
      element.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);
    });

    it('a short touch, a moving finger and two fingers do not fire', () => {
      const element = document.createElement('div');
      const pressed: any[] = [];
      attach_long_press(element, () => pressed.push(1));
      element.dispatchEvent(touch('touchstart', 10, 10));
      jest.advanceTimersByTime(200);
      const end = touch('touchend', 0, 0);
      element.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(false);
      element.dispatchEvent(touch('touchstart', 10, 10));
      element.dispatchEvent(touch('touchmove', 40, 10));
      jest.advanceTimersByTime(LONG_PRESS_DELAY + 10);
      element.dispatchEvent(touch('touchend', 0, 0));
      element.dispatchEvent(touch('touchstart', 10, 10, 2));
      jest.advanceTimersByTime(LONG_PRESS_DELAY + 10);
      expect(pressed).toHaveLength(0);
    });

    it('respects the check of the caller', () => {
      const element = document.createElement('div');
      let allowed = false;
      const pressed: any[] = [];
      attach_long_press(element, () => pressed.push(1), { allowed: () => allowed });
      element.dispatchEvent(touch('touchstart', 1, 1));
      jest.advanceTimersByTime(LONG_PRESS_DELAY + 10);
      expect(pressed).toHaveLength(0);
      allowed = true;
      element.dispatchEvent(touch('touchstart', 1, 1));
      jest.advanceTimersByTime(LONG_PRESS_DELAY + 10);
      expect(pressed).toHaveLength(1);
    });
  });
});

import {
  parse_spec, normalize_spec, parse_menu_shortcut, menu_text, event_key, matches, event_spec, effective_specs, clean_overrides,
  overrides_from, find_conflict, find_entry, command_id, build_registry, has_modifier_or_function_key, export_shortcuts, import_shortcuts, is_browser_reserved,
} from '../src/js/libs/shortcut-registry.js';
import menuDefinition from '../src/js/config-menu.js';
import shortcutsDefinition, { REPLACED_MENU_SHORTCUTS, EXTRA_SHORTCUTS, FIXED_COMMANDS } from '../src/js/config-shortcuts.js';

describe('keyboard shortcut registry', () => {
  it('reads and writes specs in one canonical form', () => {
    expect(normalize_spec('shift+ctrl+d')).toBe('Mod+Shift+D');
    expect(normalize_spec('Mod+Alt+Shift+k')).toBe('Mod+Alt+Shift+K');
    expect(normalize_spec('Cmd+Option+i')).toBe('Mod+Alt+I');
    expect(normalize_spec('Mod++')).toBe('Mod+=');
    expect(normalize_spec('Mod+Plus')).toBe('Mod+=');
    expect(normalize_spec('f5')).toBe('F5');
    expect(normalize_spec('Del')).toBe('DELETE');
    expect(normalize_spec('')).toBe('');
    expect(normalize_spec('Mod+Banana')).toBe('');
    expect(normalize_spec('Hyper+A')).toBe('');
    expect(normalize_spec('F13')).toBe('');
    expect(parse_spec(5 as any)).toBeNull();
  });

  it('understands the shortcuts as the menus wrote them', () => {
    expect(parse_menu_shortcut('Shift+Ctrl+D')).toBe('Mod+Shift+D');
    expect(parse_menu_shortcut('Shift + S')).toBe('Shift+S');
    expect(parse_menu_shortcut('Ctrl++')).toBe('Mod+=');
    expect(parse_menu_shortcut('Ctrl+-')).toBe('Mod+-');
    expect(parse_menu_shortcut('Alt+Shift+Ctrl+W')).toBe('Mod+Alt+Shift+W');
    expect(parse_menu_shortcut('Ctrl+\\')).toBe('Mod+\\');
    expect(parse_menu_shortcut('Del')).toBe('DELETE');
    expect(parse_menu_shortcut('F9')).toBe('F9');
  });

  it('writes the text of a menu in the order of Photoshop', () => {
    expect(menu_text('Mod+Alt+Shift+W')).toBe('Alt+Shift+Ctrl+W');
    expect(menu_text('Mod+=')).toBe('Ctrl++');
    expect(menu_text('DELETE')).toBe('Del');
    expect(menu_text('')).toBe('');
    expect(menu_text('V')).toBe('V');
  });

  it('finds the key of an event also on other keyboard layouts', () => {
    expect(event_key({ key: 'z', code: 'KeyY' })).toBe('Z'); //QWERTZ: the key labelled Z
    expect(event_key({ key: 'Z', code: 'KeyZ' })).toBe('Z');
    expect(event_key({ key: 'ě', code: 'Digit2' })).toBe('2'); //Czech number row
    expect(event_key({ key: 'å', code: 'KeyA' })).toBe('A'); //Option+A on a Mac
    expect(event_key({ key: '!', code: 'Digit1' })).toBe('1');
    expect(event_key({ key: '+', code: 'Equal' })).toBe('=');
    expect(event_key({ key: '=', code: 'NumpadAdd' })).toBe('=');
    expect(event_key({ key: '_', code: 'Minus' })).toBe('-');
    expect(event_key({ key: '[', code: 'BracketLeft' })).toBe('[');
    expect(event_key({ key: ':' })).toBe(';');
    expect(event_key({ key: 'Backspace' })).toBe('BACKSPACE');
    expect(event_key({ key: 'F9' })).toBe('F9');
    expect(event_key({ key: ' ', code: 'Space' })).toBe('SPACE');
    expect(event_key({ key: 'ArrowLeft' })).toBe('ARROWLEFT');
  });

  it('matches an event with its modifiers, Cmd counts as Ctrl and Shift is ignored for plus and minus', () => {
    const combo = parse_spec('Mod+Shift+D');
    expect(matches({ key: 'D', code: 'KeyD', ctrlKey: true, shiftKey: true }, combo)).toBe(true);
    expect(matches({ key: 'D', code: 'KeyD', metaKey: true, shiftKey: true }, combo)).toBe(true);
    expect(matches({ key: 'd', code: 'KeyD', ctrlKey: true }, combo)).toBe(false);
    expect(matches({ key: 'D', code: 'KeyD', ctrlKey: true, shiftKey: true, altKey: true }, combo)).toBe(false);
    expect(matches({ key: 'd', code: 'KeyD' }, parse_spec('D'))).toBe(true);
    expect(matches({ key: 'd', code: 'KeyD', ctrlKey: true }, parse_spec('D'))).toBe(false);
    const zoom = parse_spec('Mod+=');
    expect(matches({ key: '=', code: 'Equal', ctrlKey: true }, zoom)).toBe(true);
    expect(matches({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true }, zoom)).toBe(true);
    expect(matches({ key: '-', code: 'Minus', ctrlKey: true }, zoom)).toBe(false);
    expect(matches({ key: 'a' }, null)).toBe(false);
  });

  it('records the keys that were pressed', () => {
    expect(event_spec({ key: 'D', code: 'KeyD', ctrlKey: true, shiftKey: true })).toBe('Mod+Shift+D');
    expect(event_spec({ key: 'Shift', code: 'ShiftLeft', shiftKey: true })).toBe('');
    expect(event_spec({ key: 'F6', code: 'F6' })).toBe('F6');
    expect(event_spec({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true })).toBe('Mod+=');
    expect(has_modifier_or_function_key('B')).toBe(false);
    expect(has_modifier_or_function_key('Mod+B')).toBe(true);
    expect(has_modifier_or_function_key('F6')).toBe(true);
  });

  describe('with a few commands', () => {
    const registry: any[] = [
      { id: 'a', group: 'X', name: 'A', spec: 'Mod+A' },
      { id: 'b', group: 'X', name: 'B', spec: 'B' },
      { id: 'c', group: 'X', name: 'C', spec: 'Mod+=' },
      { id: 'f', group: 'X', name: 'F', spec: 'Mod+X', fixed: true },
    ];

    it('starts with the defaults and changes only what was changed', () => {
      expect(effective_specs(registry, {})).toEqual({ a: 'Mod+A', b: 'B', c: 'Mod+=', f: 'Mod+X' });
      expect(effective_specs(registry, { a: '' }).a).toBe('');
      const specs = effective_specs(registry, {});
      specs.b = 'Mod+B';
      specs.a = 'Mod+A';
      expect(overrides_from(registry, specs)).toEqual({ b: 'Mod+B' });
    });

    it('cleans what was stored', () => {
      expect(clean_overrides({ a: 'ctrl+q', b: '', zzz: 'Mod+Z', c: 'Banana', f: 'Mod+F' }, registry)).toEqual({ a: 'Mod+Q', b: '' });
      expect(clean_overrides('x', registry)).toEqual({});
      expect(clean_overrides(null, registry)).toEqual({});
      expect(clean_overrides([1], registry)).toEqual({});
    });

    it('finds a shortcut that is used already, fixed ones included', () => {
      const specs = effective_specs(registry, {});
      expect(find_conflict(registry, specs, 'b', 'Mod+A')!.id).toBe('a');
      expect(find_conflict(registry, specs, 'a', 'Mod+A')).toBeNull();
      expect(find_conflict(registry, specs, 'b', 'Mod+X')!.id).toBe('f');
      expect(find_conflict(registry, specs, 'b', 'Mod+Shift+=')!.id).toBe('c'); //Shift does not count for the plus
      expect(find_conflict(registry, specs, 'a', 'Mod+Q')).toBeNull();
      expect(find_conflict(registry, specs, 'a', '')).toBeNull();
    });

    it('finds the command of an event and skips the fixed ones', () => {
      const specs = effective_specs(registry, {});
      expect(find_entry(registry, specs, { key: 'b', code: 'KeyB' })!.id).toBe('b');
      expect(find_entry(registry, specs, { key: 'x', code: 'KeyX', ctrlKey: true })).toBeNull();
      expect(find_entry(registry, { ...specs, b: '' }, { key: 'b', code: 'KeyB' })).toBeNull();
    });
  });

  it('knows the shortcuts that the browser takes, and the rulers do not use one', () => {
    expect(is_browser_reserved('Mod+R')).toBe(true);
    expect(is_browser_reserved('ctrl+t')).toBe(true);
    expect(is_browser_reserved('Mod+Alt+R')).toBe(false);
    expect(is_browser_reserved('R')).toBe(false);
    const registry = build_registry(menuDefinition as any[], shortcutsDefinition as any[], EXTRA_SHORTCUTS as any[], REPLACED_MENU_SHORTCUTS);
    expect(registry.find((entry) => entry.id === 'view/ruler.ruler')!.spec).toBe('Mod+Alt+R');
    //the reload shortcut would lose the picture
    expect(registry.filter((entry) => ['Mod+R', 'Mod+Shift+R'].indexOf(entry.spec) >= 0)).toEqual([]);
  });

  describe('export and import', () => {
    const registry: any[] = [
      { id: 'a', group: 'X', name: 'A', spec: 'Mod+A' },
      { id: 'b', group: 'X', name: 'B', spec: 'B' },
      { id: 'c', group: 'X', name: 'C', spec: 'Mod+C' },
      { id: 'f', group: 'X', name: 'F', spec: 'Mod+X', fixed: true },
    ];

    it('what is exported can be imported again', () => {
      const text = export_shortcuts({ a: 'Mod+Q', b: '' });
      const result: any = import_shortcuts(registry, text);
      expect(result.ok).toBe(true);
      expect(result.specs).toEqual({ a: 'Mod+Q', b: '', c: 'Mod+C', f: 'Mod+X' });
      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('takes only what is valid: unknown commands, fixed ones and broken specs are left out', () => {
      const text = JSON.stringify({ format: 'webphos-shortcuts', version: 1, shortcuts: { a: 'Mod+Q', zzz: 'Mod+Z', f: 'Mod+F', c: 'Banana' } });
      const result: any = import_shortcuts(registry, text);
      expect(result.ok).toBe(true);
      expect(result.specs.a).toBe('Mod+Q');
      expect(result.specs.f).toBe('Mod+X');
      expect(result.specs.c).toBe('Mod+C');
    });

    it('a shortcut that is wanted twice, or is used by a command that stays, goes to the first one only', () => {
      const text = JSON.stringify({ format: 'webphos-shortcuts', version: 1, shortcuts: { a: 'Mod+Q', b: 'Mod+Q', c: 'Mod+X' } });
      const result: any = import_shortcuts(registry, text);
      expect(result.ok).toBe(true);
      expect(result.specs.a).toBe('Mod+Q');
      expect(result.specs.b).toBe('B'); //the shortcut is a's already
      expect(result.specs.c).toBe('Mod+C'); //Mod+X belongs to the fixed command
      expect(result.applied).toBe(1);
      expect(result.skipped).toBe(2);
    });

    it('refuses anything that is not such a file or is too big', () => {
      for (const text of ['', 'not json', '[]', 'null', '{"format":"other","version":1,"shortcuts":{}}', '{"format":"webphos-shortcuts","version":2,"shortcuts":{}}', '{"format":"webphos-shortcuts","version":1,"shortcuts":[]}', '{"format":"webphos-shortcuts","version":1}']) {
        expect(import_shortcuts(registry, text).ok).toBe(false);
      }
      expect(import_shortcuts(registry, 'x'.repeat(300000)).ok).toBe(false);
      expect(import_shortcuts(registry, 5 as any).ok).toBe(false);
    });

    it('does not let a name like __proto__ in the file do anything', () => {
      const result: any = import_shortcuts(registry, '{"format":"webphos-shortcuts","version":1,"shortcuts":{"__proto__":"Mod+Q","a":"Mod+W"}}');
      expect(result.ok).toBe(true);
      expect(result.specs.a).toBe('Mod+W');
      expect(({} as any).Mod).toBeUndefined();
    });
  });

  describe('the real list of commands', () => {
    const registry = build_registry(menuDefinition as any[], shortcutsDefinition as any[], EXTRA_SHORTCUTS as any[], REPLACED_MENU_SHORTCUTS);
    registry.forEach((entry) => {
      if (FIXED_COMMANDS.indexOf(entry.id) >= 0) entry.fixed = true;
    });

    it('has no two commands on the same default shortcut', () => {
      const used: Record<string, string> = {};
      const clashes: string[] = [];
      registry.forEach((entry) => {
        const spec = normalize_spec(entry.spec);
        if (spec === '') return;
        if (used[spec]) clashes.push(spec + ': ' + used[spec] + ' / ' + entry.id);
        used[spec] = entry.id;
      });
      expect(clashes).toEqual([]);
    });

    it('has only valid default specs, and plain keys only for the tools and the colors', () => {
      registry.forEach((entry) => {
        if (entry.spec === '') return;
        expect(normalize_spec(entry.spec)).toBe(entry.spec);
        if (!has_modifier_or_function_key(entry.spec) && !entry.fixed) {
          expect(entry.group === 'Tools' || entry.id === 'edit/selection.quick_mask').toBe(true);
        }
      });
    });

    it('has a command for every tool that is shown in the toolbar, and only for real tools', () => {
      const tools = (jest.requireActual('../src/js/config.js').default as any).TOOLS.map((tool: any) => tool.name);
      const tool_entries = registry.filter((entry: any) => entry.tool);
      tool_entries.forEach((entry: any) => expect(tools).toContain(entry.tool));
      for (const name of ['select', 'selection', 'lasso', 'brush', 'pencil', 'erase', 'text', 'crop', 'hand', 'zoom', 'pen', 'gradient', 'fill']) {
        expect(tool_entries.map((entry: any) => entry.tool)).toContain(name);
      }
    });

    it('has the basics', () => {
      const spec = (target: string, parameter?: any) => (registry.find((entry) => entry.id === command_id(target, parameter)) || { spec: 'missing' }).spec;
      expect(spec('edit/undo.undo')).toBe('Mod+Z');
      expect(spec('edit/redo.redo')).toBe('Mod+Y');
      expect(registry.find((entry) => entry.id === 'edit/redo.redo|alternative')!.spec).toBe('Mod+Shift+Z');
      expect(spec('file/open.open_file')).toBe('Mod+O');
      expect(spec('file/save.export')).toBe('Mod+S');
      expect(spec('file/save.save')).toBe('Mod+Shift+S');
      expect(spec('edit/selection.select_all')).toBe('Mod+A');
      expect(spec('edit/selection.deselect')).toBe('Mod+D');
      expect(spec('edit/transform.free_transform')).toBe('Mod+T');
      expect(spec('view/zoom.in')).toBe('Mod+=');
      expect(spec('view/zoom.out')).toBe('Mod+-');
      expect(spec('image/resize.resize')).toBe('Mod+Alt+I');
      expect(spec('edit/copy.copy_to_clipboard')).toBe('Mod+C');
      expect(spec('edit/paste.paste')).toBe('Mod+V');
      expect(spec('tools/colors.swap')).toBe('X');
    });

    it('does not use a plain letter of the menu for anything else than a tool any more', () => {
      const plain = registry.filter((entry) => !entry.tool && entry.spec !== '' && !has_modifier_or_function_key(entry.spec) && !entry.fixed);
      expect(plain.map((entry) => entry.id).sort()).toEqual(['edit/selection.quick_mask', 'tools/brush_size.decrease', 'tools/brush_size.increase', 'tools/colors.reset', 'tools/colors.swap'].sort());
    });
  });
});

import { fit_zoom_percent } from '../src/js/libs/zoom-fit.js';

describe('Fit window zoom', () => {
  it('is never bigger than the free space, only smaller', () => {
    for (const [w, h, pw, ph] of [[1000, 700, 1920, 1080], [641, 479, 800, 600], [4000, 3000, 933, 701], [97, 53, 1280, 800], [3, 3, 1000, 1000]]) {
      const percent = fit_zoom_percent(pw, ph, w, h);
      expect(Math.ceil(w * percent / 100)).toBeLessThanOrEqual(pw);
      expect(Math.ceil(h * percent / 100)).toBeLessThanOrEqual(ph);
      //and not much smaller than possible
      expect(percent + 2).toBeGreaterThan(Math.min((pw - 2) / w, (ph - 2) / h) * 100 - 1);
    }
  });

  it('floors to a whole percent and keeps the border free', () => {
    expect(fit_zoom_percent(802, 602, 800, 600)).toBe(100);
    expect(fit_zoom_percent(801, 601, 800, 600)).toBe(99);
    expect(fit_zoom_percent(1000, 1000, 3000, 3000)).toBe(33);
  });

  it('survives zero sizes and a tiny space', () => {
    expect(fit_zoom_percent(1000, 800, 0, 0)).toBe(100);
    expect(fit_zoom_percent(0, 0, 100, 100)).toBe(1);
    expect(fit_zoom_percent(1, 1, 100, 100)).toBe(1);
  });
});

import { needs_raster_layer, is_tool_disabled, is_vector_layer } from '../src/js/libs/raster-tools.js';

describe('tools and the empty first layer', () => {
  it('a tool that needs pixels turns the empty layer into a picture, the others leave it', () => {
    const empty = { type: null, is_vector: false };
    for (const tool of ['erase', 'fill', 'blur', 'lasso', 'magic_wand', 'clone', 'heal']) {
      expect(needs_raster_layer(tool, empty)).toBe(true);
    }
    for (const tool of ['brush', 'pencil', 'text', 'select', 'hand', 'zoom', 'pen', 'gradient', 'selection']) {
      expect(needs_raster_layer(tool, empty)).toBe(false);
    }
    expect(needs_raster_layer('erase', { type: 'image', is_vector: false })).toBe(false);
    expect(needs_raster_layer('erase', { type: 'brush', is_vector: true })).toBe(false);
    expect(needs_raster_layer('erase', null)).toBe(false);
  });

  it('the vector layers still disable the tools', () => {
    expect(is_tool_disabled('erase', { type: 'brush', is_vector: true })).toBe(true);
    expect(is_tool_disabled('erase', { type: 'text', is_vector: true })).toBe(true);
    expect(is_tool_disabled('erase', { type: 'pen', is_vector: true })).toBe(true);
    expect(is_tool_disabled('brush', { type: 'brush', is_vector: true })).toBe(false);
    //the marquee only draws a rectangle, so it works on every layer
    expect(is_tool_disabled('selection', { type: 'brush', is_vector: true })).toBe(false);
    expect(is_tool_disabled('selection', { type: 'text', is_vector: true })).toBe(false);
    expect(is_vector_layer({ type: null, is_vector: false })).toBe(false);
  });
});

import { stroke_scale, is_stretched } from '../src/js/libs/stroke-scale.js';

describe('strokes of a resized brush layer', () => {
  it('are stretched by the ratio of the new size to the size they were drawn in', () => {
    expect(stroke_scale({ width: 200, height: 100, width_original: 100, height_original: 100 })).toEqual({ x: 2, y: 1 });
    expect(stroke_scale({ width: 50, height: 25, width_original: 100, height_original: 100 })).toEqual({ x: 0.5, y: 0.25 });
  });

  it('are not stretched when their size is not known or is zero', () => {
    expect(stroke_scale({ width: 640, height: 480 })).toEqual({ x: 1, y: 1 }); //a stroke that is being drawn
    expect(stroke_scale({ width: 640, height: 480, width_original: null, height_original: null })).toEqual({ x: 1, y: 1 });
    expect(stroke_scale({ width: 200, height: 10, width_original: 100, height_original: 0 })).toEqual({ x: 2, y: 1 }); //a straight line
    expect(stroke_scale({ width: 0, height: 0, width_original: 100, height_original: 100 })).toEqual({ x: 1, y: 1 });
  });

  it('keeps the stretch within sensible limits', () => {
    expect(stroke_scale({ width: 100000, height: 1, width_original: 1, height_original: 1000 })).toEqual({ x: 100, y: 0.01 });
  });

  it('knows a layer that is stretched', () => {
    expect(is_stretched({ width: 100, height: 100, width_original: 100, height_original: 100 })).toBe(false);
    expect(is_stretched({ width: 100.0001, height: 100, width_original: 100, height_original: 100 })).toBe(false);
    expect(is_stretched({ width: 120, height: 100, width_original: 100, height_original: 100 })).toBe(true);
    expect(is_stretched({ width: 120, height: 100 })).toBe(false);
  });
});

import { is_ratio_modifier, keeps_ratio, constrain_ratio } from '../src/js/libs/resize-ratio.js';

describe('proportions while a layer is resized', () => {
  it('Shift, Option and Ctrl / Cmd are the keys', () => {
    expect(is_ratio_modifier({ shiftKey: true })).toBe(true);
    expect(is_ratio_modifier({ altKey: true })).toBe(true);
    expect(is_ratio_modifier({ ctrlKey: true })).toBe(true);
    expect(is_ratio_modifier({ metaKey: true })).toBe(true);
    expect(is_ratio_modifier({})).toBe(false);
    expect(is_ratio_modifier(null as any)).toBe(false);
  });

  it('a picture keeps them unless a key is held, a vector layer only while a key is held', () => {
    expect(keeps_ratio(true, false)).toBe(true);
    expect(keeps_ratio(true, true)).toBe(false);
    expect(keeps_ratio(false, false)).toBe(false);
    expect(keeps_ratio(false, true)).toBe(true);
  });

  it('gives a size with the ratio of the layer, the bigger change decides', () => {
    expect(constrain_ratio(200, 100, 2)).toEqual({ width: 200, height: 100 });
    //wider: the height follows
    expect(constrain_ratio(300, 100, 2)).toEqual({ width: 300, height: 150 });
    //taller: the width follows
    expect(constrain_ratio(200, 300, 2)).toEqual({ width: 600, height: 300 });
    expect(constrain_ratio(160, 160, 1)).toEqual({ width: 160, height: 160 });
  });

  it('does not break on a flat layer or a ratio that is not a number', () => {
    expect(constrain_ratio(100, 50, 0)).toEqual({ width: 100, height: 50 });
    expect(constrain_ratio(100, 50, Infinity)).toEqual({ width: 100, height: 50 });
    expect(constrain_ratio(100, 50, NaN)).toEqual({ width: 100, height: 50 });
    expect(constrain_ratio(0, 0, 2)).toEqual({ width: 0, height: 0 });
  });
});

import { pick_layer, inside_frame } from '../src/js/libs/auto-select.js';

describe('auto-select of the Move tool', () => {
  const picture = { id: 1, x: 0, y: 0, width: 400, height: 300 };
  const stroke = { id: 2, x: 100, y: 100, width: 80, height: 60 };
  const layers = [stroke, picture]; //top first

  it('a press in the frame of the active stroke keeps it, also where the stroke itself is transparent', () => {
    const nothing = () => false;
    //the picture below has a pixel there, the stroke has none
    const hit = (layer: any) => layer.id === 1;
    expect(pick_layer(layers, 2, { x: 140, y: 130 }, hit)).toBe(2);
    expect(pick_layer(layers, 2, { x: 140, y: 130 }, nothing)).toBe(2);
  });

  it('outside of the frame of the active layer the layer under the pointer is picked', () => {
    const hit = (layer: any) => layer.id === 1;
    expect(pick_layer(layers, 2, { x: 300, y: 250 }, hit)).toBe(1);
    expect(pick_layer(layers, 2, { x: 300, y: 250 }, () => false)).toBeNull();
  });

  it('a layer above the active one that has a pixel there is picked, a stroke that is not active is picked by its pixels', () => {
    expect(pick_layer(layers, 1, { x: 140, y: 130 }, (layer: any) => layer.id === 2)).toBe(2);
    expect(pick_layer(layers, 1, { x: 140, y: 130 }, (layer: any) => layer.id === 1)).toBe(1);
  });

  it('knows the frame of a layer', () => {
    expect(inside_frame(stroke, { x: 101, y: 101 })).toBe(true);
    expect(inside_frame(stroke, { x: 100, y: 101 })).toBe(false);
    expect(inside_frame(stroke, { x: 181, y: 120 })).toBe(false);
  });
});

import { point_in_selection, moved_rect, fit_mask_to_rect, lift_pixels, put_shifted } from '../src/js/libs/selection-move.js';
import { rect_mask } from '../src/js/libs/selection-mask.js';

describe('moving a selection and its pixels', () => {
  const picture = (w: number, h: number, fn: (x: number, y: number) => number[]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
    return { data, width: w, height: h };
  };

  it('knows if a point is in a rectangular or an odd shaped selection', () => {
    const rect = { x: 10, y: 10, width: 20, height: 10 };
    const current: any = { kind: 'rect', rect, mask: rect_mask(rect, 100, 100) };
    expect(point_in_selection(current, { x: 15, y: 15 })).toBe(true);
    expect(point_in_selection(current, { x: 5, y: 15 })).toBe(false);
    expect(point_in_selection({ ...current, kind: 'custom' }, { x: 15.7, y: 15.2 })).toBe(true);
    expect(point_in_selection({ ...current, kind: 'custom' }, { x: 40, y: 15 })).toBe(false);
    expect(point_in_selection({ ...current, kind: 'custom' }, { x: -3, y: 15 })).toBe(false);
    expect(point_in_selection(null, { x: 1, y: 1 })).toBe(false);
  });

  it('keeps the part of a moved rectangle that is still in the picture', () => {
    expect(moved_rect({ x: 10, y: 10, width: 20, height: 10 }, 5, -3, 100, 100)).toEqual({ x: 15, y: 7, width: 20, height: 10 });
    expect(moved_rect({ x: 10, y: 10, width: 20, height: 10 }, -15, 0, 100, 100)).toEqual({ x: 0, y: 10, width: 15, height: 10 });
    expect(moved_rect({ x: 90, y: 90, width: 20, height: 20 }, 5, 5, 100, 100)).toEqual({ x: 95, y: 95, width: 5, height: 5 });
    expect(moved_rect({ x: 10, y: 10, width: 20, height: 10 }, 500, 0, 100, 100)).toBeNull();
  });

  it('stretches a mask to the new rectangle', () => {
    const mask = rect_mask({ x: 10, y: 10, width: 20, height: 10 }, 100, 100);
    const stretched = fit_mask_to_rect(mask, { x: 10, y: 10, width: 40, height: 20 });
    const at = (x: number, y: number) => stretched.data[y * 100 + x];
    expect(at(30, 20)).toBeGreaterThan(200); //where the rectangle grew
    expect(at(55, 20)).toBe(0);
    expect(at(5, 20)).toBe(0);
    //an empty mask or an empty rectangle changes nothing
    const empty = rect_mask({ x: 0, y: 0, width: 0, height: 0 }, 10, 10);
    expect(fit_mask_to_rect(empty, { x: 1, y: 1, width: 5, height: 5 })).toBe(empty);
    expect(fit_mask_to_rect(mask, { x: 1, y: 1, width: 0, height: 5 })).toBe(mask);
  });

  it('lifts the selected pixels and leaves a hole, the layer may lie somewhere else in the picture', () => {
    const image = picture(10, 10, (x, y) => [x * 20, y * 20, 7, 255]);
    //the layer is at 5, 5 in the picture; the selection covers picture pixels 7..9 x 7..9 = layer pixels 2..4
    const mask = rect_mask({ x: 7, y: 7, width: 3, height: 3 }, 20, 20);
    const { selected, hole } = lift_pixels(image, mask, { x: 5, y: 5, width: 10, height: 10 });
    const alpha = (img: any, x: number, y: number) => img.data[(y * 10 + x) * 4 + 3];
    expect(alpha(selected, 3, 3)).toBe(255);
    expect(alpha(selected, 1, 1)).toBe(0);
    expect(alpha(hole, 3, 3)).toBe(0);
    expect(alpha(hole, 1, 1)).toBe(255);
    //the original image is not touched
    expect(alpha(image, 3, 3)).toBe(255);
  });

  it('puts the lifted pixels back shifted, over what is there', () => {
    const image = picture(10, 10, (x, y) => [x * 20, y * 20, 7, 255]);
    const mask = rect_mask({ x: 2, y: 2, width: 2, height: 2 }, 10, 10);
    const { selected, hole } = lift_pixels(image, mask, { x: 0, y: 0, width: 10, height: 10 });
    const moved = put_shifted(hole, selected, 5, 3);
    const px = (x: number, y: number) => Array.from(moved.data.slice((y * 10 + x) * 4, (y * 10 + x) * 4 + 4));
    expect(px(7, 5)).toEqual([40, 40, 7, 255]); //pixel (2,2) went to (7,5)
    expect(px(8, 6)).toEqual([60, 60, 7, 255]);
    expect(px(2, 2)[3]).toBe(0); //the hole
    expect(px(0, 0)).toEqual([0, 0, 7, 255]);
    //a copy keeps the original
    const copy = put_shifted(picture(10, 10, (x, y) => [x * 20, y * 20, 7, 255]), selected, 5, 3);
    expect(Array.from(copy.data.slice((2 * 10 + 2) * 4, (2 * 10 + 2) * 4 + 4))).toEqual([40, 40, 7, 255]);
  });

  it('loses what is pushed out of the layer and blends soft pixels', () => {
    const base = picture(4, 4, () => [0, 0, 255, 255]);
    const selected = picture(4, 4, (x, y) => (x == 3 && y == 0 ? [255, 0, 0, 255] : x == 0 && y == 0 ? [255, 0, 0, 128] : [0, 0, 0, 0]));
    put_shifted(base, selected, 1, 0);
    //(3,0) fell out of the layer, (0,0) with half alpha went to (1,0) over blue
    const px = (x: number, y: number) => Array.from(base.data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(px(3, 0)).toEqual([0, 0, 255, 255]);
    expect(px(1, 0)[0]).toBeGreaterThan(100);
    expect(px(1, 0)[2]).toBeGreaterThan(100);
    expect(px(1, 0)[3]).toBe(255);
  });
});
