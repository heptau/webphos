import { rotate_box, rotated_canvas_size } from '../src/js/libs/canvas-rotate.js';

describe('Canvas rotate geometry', () => {
  it('swaps canvas size for 90 and 270 only', () => {
    expect(rotated_canvas_size(640, 480, 90)).toEqual({ width: 480, height: 640 });
    expect(rotated_canvas_size(640, 480, 270)).toEqual({ width: 480, height: 640 });
    expect(rotated_canvas_size(640, 480, 180)).toEqual({ width: 640, height: 480 });
  });

  it('moves a box in the top-left corner to the top-right after 90deg clockwise', () => {
    expect(rotate_box({ x: 0, y: 0, width: 100, height: 50 }, 640, 480, 90)).toEqual({ x: 430, y: 0, width: 50, height: 100 });
  });

  it('moves a box in the top-left corner to the bottom-left after 90deg counter clockwise', () => {
    expect(rotate_box({ x: 0, y: 0, width: 100, height: 50 }, 640, 480, 270)).toEqual({ x: 0, y: 540, width: 50, height: 100 });
  });

  it('moves a box to the opposite corner after 180deg', () => {
    expect(rotate_box({ x: 0, y: 0, width: 100, height: 50 }, 640, 480, 180)).toEqual({ x: 540, y: 430, width: 100, height: 50 });
  });

  it('rotating four times by 90 returns the original box', () => {
    let box = { x: 10, y: 20, width: 100, height: 50 };
    let w = 640, h = 480;
    for (let i = 0; i < 4; i++) {
      box = rotate_box(box, w, h, 90);
      [w, h] = [h, w];
    }
    expect(box).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('a full canvas box stays a full canvas box', () => {
    expect(rotate_box({ x: 0, y: 0, width: 640, height: 480 }, 640, 480, 90)).toEqual({ x: 0, y: 0, width: 480, height: 640 });
  });
});
