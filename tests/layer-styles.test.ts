import { safe_color, parse_color, outline_alpha, inner_outline_alpha, glow_filter, gradient_line, alpha_bounds, blend_operation, BLEND_MODES, parse_gradient_stops } from '../src/js/libs/layer-styles.js';

describe('outline_alpha', () => {
	const dot = (w: number, h: number, x: number, y: number) => {
		const alpha = new Uint8ClampedArray(w * h);
		alpha[y * w + x] = 255;
		return alpha;
	};
	const at = (a: Uint8ClampedArray, w: number, x: number, y: number) => a[y * w + x];

	it('covers a disc of the given radius around a pixel', () => {
		const out = outline_alpha(dot(41, 41, 20, 20), 41, 41, 8);
		expect(at(out, 41, 20, 20)).toBe(255);
		expect(at(out, 41, 28, 20)).toBe(255);
		expect(at(out, 41, 20, 12)).toBe(255);
		expect(at(out, 41, 31, 20)).toBe(0);
		expect(at(out, 41, 20, 9)).toBe(0);
		//diagonal: distance 8 / sqrt(2) = 5.66 per axis is inside, 8 per axis (11.3) is not
		expect(at(out, 41, 25, 25)).toBe(255);
		expect(at(out, 41, 28, 28)).toBe(0);
	});

	it('has a soft anti-aliased rim and grows with the size', () => {
		const w = 61;
		const count = (size: number) => Array.from(outline_alpha(dot(w, w, 30, 30), w, w, size)).filter((v) => v > 0).length;
		expect(count(5)).toBeLessThan(count(10));
		const out = outline_alpha(dot(w, w, 30, 30), w, w, 10);
		const partial = Array.from(out).filter((v) => v > 0 && v < 255).length;
		expect(partial).toBeGreaterThan(0);
	});

	it('wraps around a thin line without gaps', () => {
		const w = 60, h = 40;
		const alpha = new Uint8ClampedArray(w * h);
		for (let x = 10; x < 50; x++) alpha[20 * w + x] = 255;
		const out = outline_alpha(alpha, w, h, 6);
		for (let x = 10; x < 50; x++) {
			for (let dy = -6; dy <= 6; dy++) expect(out[(20 + dy) * w + x]).toBe(255);
		}
		expect(out[(20 + 8) * w + 30]).toBe(0);
	});

	it('works on empty images and clamps the size', () => {
		expect(Array.from(outline_alpha(new Uint8ClampedArray(25), 5, 5, 3)).every((v) => v === 0)).toBe(true);
		const a = outline_alpha(dot(30, 30, 15, 15), 30, 30, -4);
		const b = outline_alpha(dot(30, 30, 15, 15), 30, 30, 1);
		expect(Array.from(a)).toEqual(Array.from(b));
	});
});

describe('inner_outline_alpha', () => {
	const square = (w: number, h: number, x0: number, y0: number, x1: number, y1: number) => {
		const alpha = new Uint8ClampedArray(w * h);
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) alpha[y * w + x] = 255;
		return alpha;
	};

	it('covers a band along the inside of the edge only', () => {
		const w = 40, h = 40;
		const out = inner_outline_alpha(square(w, h, 10, 10, 30, 30), w, h, 4);
		const at = (x: number, y: number) => out[y * w + x];
		expect(at(10, 20)).toBe(255); // first pixel of the shape
		expect(at(13, 20)).toBe(255); // 4th pixel
		expect(at(14, 20)).toBeLessThan(255); // 5th pixel is fading out
		expect(at(18, 20)).toBe(0); // deep inside
		expect(at(5, 20)).toBe(0); // outside the shape
		expect(at(0, 0)).toBe(0);
	});

	it('is the mirror of the outside outline: both bands touch each other at the edge', () => {
		const w = 40, h = 40;
		const alpha = square(w, h, 10, 10, 30, 30);
		const inside = inner_outline_alpha(alpha, w, h, 3);
		const outside = outline_alpha(alpha, w, h, 3);
		expect(inside[20 * w + 10]).toBe(255);
		expect(outside[20 * w + 9]).toBe(255);
		expect(outside[20 * w + 10]).toBe(255); // the outline also covers the shape itself
	});

	it('treats the image edge as a border and handles empty images', () => {
		const w = 20, h = 20;
		const full = new Uint8ClampedArray(w * h).fill(255);
		const out = inner_outline_alpha(full, w, h, 2);
		// nothing transparent at all - no band without a border pixel
		expect(out.every((v) => v === 0)).toBe(true);
		expect(inner_outline_alpha(new Uint8ClampedArray(w * h), w, h, 3).every((v) => v === 0)).toBe(true);
	});

	it('wraps thin shapes completely and clamps the size', () => {
		const w = 30, h = 10;
		const line = new Uint8ClampedArray(w * h);
		for (let x = 5; x < 25; x++) line[5 * w + x] = 255;
		const out = inner_outline_alpha(line, w, h, 3);
		for (let x = 5; x < 25; x++) expect(out[5 * w + x]).toBe(255);
		expect(Array.from(inner_outline_alpha(line, w, h, -2))).toEqual(Array.from(inner_outline_alpha(line, w, h, 1)));
	});
});

describe('parse_color', () => {
	it('parses short, long and alpha hex colors and falls back to black', () => {
		expect(parse_color('#ff8000')).toEqual([255, 128, 0]);
		expect(parse_color('#f80')).toEqual([255, 136, 0]);
		expect(parse_color('#11223344')).toEqual([17, 34, 51]);
		expect(parse_color('nonsense')).toEqual([0, 0, 0]);
	});
});

describe('glow filter', () => {
	it('stacks glow by strength', () => {
		expect(glow_filter(8, 3, '#00ff00')).toBe(Array(3).fill('drop-shadow(0px 0px 8px #00ff00)').join(' '));
		expect(glow_filter(8, 99, '#00ff00').match(/drop-shadow/g)!.length).toBe(5);
		expect(glow_filter(0, 0, '#00ff00')).toBe('drop-shadow(0px 0px 1px #00ff00)');
	});

	it('never lets anything but a hex color into the filter string', () => {
		expect(safe_color('#abc')).toBe('#abc');
		expect(safe_color('#aabbcc')).toBe('#aabbcc');
		expect(safe_color('red); url(javascript:alert(1)')).toBe('#000000');
		expect(safe_color('#12')).toBe('#000000');
		expect(safe_color(undefined as any)).toBe('#000000');
		expect(glow_filter(2, 1, 'url(x)')).not.toContain('url');
	});
});

describe('gradient_line', () => {
	const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

	it('runs left to right at 0 degrees and top to bottom at 90', () => {
		const h = gradient_line(200, 100, 0);
		near(h.x0, 0); near(h.y0, 50); near(h.x1, 200); near(h.y1, 50);
		const v = gradient_line(200, 100, 90);
		near(v.x0, 100); near(v.y0, 0); near(v.x1, 100); near(v.y1, 100);
	});

	it('reverses with 180 degrees', () => {
		const r = gradient_line(200, 100, 180);
		near(r.x0, 200); near(r.x1, 0);
	});

	it('reaches the opposite corners at 45 degrees on a square', () => {
		const d = gradient_line(100, 100, 45);
		near(d.x0, 0); near(d.y0, 0); near(d.x1, 100); near(d.y1, 100);
	});

	it('is centered on the box and falls back to 0 for bad angles', () => {
		const g = gradient_line(80, 60, 33);
		near((g.x0 + g.x1) / 2, 40); near((g.y0 + g.y1) / 2, 30);
		expect(gradient_line(80, 60, 'abc' as any)).toEqual(gradient_line(80, 60, 0));
	});
});

describe('alpha_bounds', () => {
	const image = (w: number, h: number, opaque: [number, number][]) => {
		const data = new Uint8ClampedArray(w * h * 4);
		opaque.forEach(([x, y]) => (data[(y * w + x) * 4 + 3] = 40));
		return { width: w, height: h, data };
	};

	it('finds the box around non transparent pixels', () => {
		expect(alpha_bounds(image(10, 8, [[2, 3], [6, 5], [4, 4]]))).toEqual({ x: 2, y: 3, width: 5, height: 3 });
		expect(alpha_bounds(image(4, 4, [[0, 0]]))).toEqual({ x: 0, y: 0, width: 1, height: 1 });
		expect(alpha_bounds(image(4, 4, [[3, 3]]))).toEqual({ x: 3, y: 3, width: 1, height: 1 });
	});

	it('returns null for an empty image', () => {
		expect(alpha_bounds(image(5, 5, []))).toBeNull();
	});
});

describe('blend_operation', () => {
	it('maps known modes to canvas operations and keeps normal as null', () => {
		expect(blend_operation('multiply')).toBe('multiply');
		expect(blend_operation('soft-light')).toBe('soft-light');
		expect(blend_operation('normal')).toBeNull();
	});

	it('never lets unknown values through', () => {
		expect(blend_operation('destination-out')).toBeNull();
		expect(blend_operation('xor')).toBeNull();
		expect(blend_operation(undefined as any)).toBeNull();
		expect(blend_operation('multiply); evil')).toBeNull();
	});

	it('lists only valid canvas composite operations', () => {
		expect(BLEND_MODES[0]).toBe('normal');
		expect(new Set(BLEND_MODES).size).toBe(BLEND_MODES.length);
		BLEND_MODES.slice(1).forEach((mode) => expect(/^[a-z-]+$/.test(mode)).toBe(true));
	});
});

describe('parse_gradient_stops', () => {
	it('parses colors with positions and sorts them', () => {
		expect(parse_gradient_stops('#0000ff 100, #ff0000 0, #ffff00 40%')).toEqual([
			{ color: '#ff0000', position: 0 },
			{ color: '#ffff00', position: 0.4 },
			{ color: '#0000ff', position: 1 },
		]);
		expect(parse_gradient_stops('#f00 0,#00f 100')!.length).toBe(2);
	});

	it('skips invalid parts and needs at least two valid stops', () => {
		expect(parse_gradient_stops('#ff0000 0, nonsense, #00ff00 50')!.length).toBe(2);
		expect(parse_gradient_stops('#ff0000 0')).toBeNull();
		expect(parse_gradient_stops('red 0, blue 100')).toBeNull();
		expect(parse_gradient_stops('')).toBeNull();
		expect(parse_gradient_stops(undefined as any)).toBeNull();
	});

	it('clamps positions and does not let injected text through', () => {
		const stops = parse_gradient_stops('#ff0000 -5, #00ff00 150, #0000ff 50')!;
		expect(stops.map((s) => s.position)).toEqual([0.5, 1]);
		expect(parse_gradient_stops('#ff0000 0; evil(), #00ff00 100); alert(1) 5')).toBeNull();
		expect(stops.every((s) => /^#[0-9a-f]{3,6}$/i.test(s.color))).toBe(true);
	});

	it('limits the number of stops', () => {
		const many = Array.from({ length: 60 }, (_, i) => '#ff0000 ' + (i % 100)).join(', ');
		expect(parse_gradient_stops(many)!.length).toBe(20);
	});
});
