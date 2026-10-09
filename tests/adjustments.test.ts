import { invert, desaturate, threshold, posterize, levels, brightnessContrast, hueSaturation, exposure, autoContrast, addNoise, parseHex, colorBalance, photoFilter, gradientMap, channelMixer, shadowsHighlights, equalize, autoColor, temperatureTint, sepia, swapChannels, extractChannel, dodgeBurn, smudgeBlend, selectiveColor, curveLookup, curves, normalizeCurvePoints, curvesFromPoints, histograms } from '../src/js/libs/adjustments.js';

function image(pixels: number[][]) {
	return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

describe('Image adjustments', () => {
	it('inverts colors and keeps alpha', () => {
		const img = invert(image([[0, 100, 255, 128]]));
		expect(Array.from(img.data)).toEqual([255, 155, 0, 128]);
	});

	it('desaturates using luminance', () => {
		const img = desaturate(image([[255, 0, 0, 255], [10, 10, 10, 50]]));
		expect(Array.from(img.data)).toEqual([76, 76, 76, 255, 10, 10, 10, 50]);
	});

	it('applies threshold', () => {
		const img = threshold(image([[200, 200, 200, 255], [20, 20, 20, 255]]), 128);
		expect(Array.from(img.data)).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
	});

	it('posterizes to given number of levels', () => {
		const img = posterize(image([[0, 100, 200, 255], [255, 127, 128, 255]]), 2);
		expect(Array.from(img.data)).toEqual([0, 0, 255, 255, 255, 0, 255, 255]);
	});

	it('keeps image unchanged with default levels', () => {
		const img = levels(image([[0, 64, 200, 255]]), {});
		expect(Array.from(img.data)).toEqual([0, 64, 200, 255]);
	});

	it('stretches input range with levels', () => {
		const img = levels(image([[50, 100, 150, 255]]), { in_black: 50, in_white: 150 });
		expect(Array.from(img.data)).toEqual([0, 128, 255, 255]);
	});

	it('limits output range with levels', () => {
		const img = levels(image([[0, 255, 0, 255]]), { out_black: 20, out_white: 200 });
		expect(Array.from(img.data)).toEqual([20, 200, 20, 255]);
	});
});

describe('Brightness/Contrast, Hue/Saturation, Exposure', () => {
	it('keeps image unchanged with zero brightness and contrast', () => {
		const img = brightnessContrast(image([[10, 128, 250, 99]]), 0, 0);
		expect(Array.from(img.data)).toEqual([10, 128, 250, 99]);
	});

	it('increases and decreases brightness, clamping values', () => {
		expect(Array.from(brightnessContrast(image([[100, 100, 250, 255]]), 50, 0).data)).toEqual([228, 228, 255, 255]);
		expect(Array.from(brightnessContrast(image([[100, 10, 250, 255]]), -50, 0).data)).toEqual([0, 0, 123, 255]);
	});

	it('lowers contrast towards gray', () => {
		const img = brightnessContrast(image([[0, 255, 128, 255]]), 0, -100);
		expect(Array.from(img.data)).toEqual([128, 128, 128, 255]);
	});

	it('rotates hue (red -> green at 120deg) and keeps alpha', () => {
		const img = hueSaturation(image([[255, 0, 0, 77]]), {hue: 120});
		expect(Array.from(img.data)).toEqual([0, 255, 0, 77]);
	});

	it('removes saturation and lightens/darkens', () => {
		expect(Array.from(hueSaturation(image([[255, 0, 0, 255]]), {saturation: -100}).data)).toEqual([128, 128, 128, 255]);
		expect(Array.from(hueSaturation(image([[100, 100, 100, 255]]), {lightness: 100}).data)).toEqual([255, 255, 255, 255]);
		expect(Array.from(hueSaturation(image([[100, 100, 100, 255]]), {lightness: -100}).data)).toEqual([0, 0, 0, 255]);
	});

	it('changes exposure by stops', () => {
		expect(Array.from(exposure(image([[64, 64, 64, 255]]), {exposure: 1}).data)).toEqual([128, 128, 128, 255]);
		expect(Array.from(exposure(image([[64, 64, 64, 255]]), {}).data)).toEqual([64, 64, 64, 255]);
	});
});

describe('Auto contrast and noise', () => {
	it('stretches a narrow tonal range to full range', () => {
		const img = autoContrast(image([[100, 100, 100, 255], [150, 150, 150, 255]]), 0);
		expect(Array.from(img.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
	});

	it('leaves flat or fully transparent images untouched', () => {
		expect(Array.from(autoContrast(image([[90, 90, 90, 255]]), 0).data)).toEqual([90, 90, 90, 255]);
		expect(Array.from(autoContrast(image([[10, 20, 30, 0]]), 0).data)).toEqual([10, 20, 30, 0]);
	});

	it('adds deterministic noise with injected random and keeps alpha', () => {
		const img = addNoise(image([[100, 100, 100, 200]]), {amount: 10}, () => 1);
		expect(Array.from(img.data)).toEqual([126, 126, 126, 200]);
	});

	it('adds the same value to all channels in monochrome mode', () => {
		let n = 0;
		const img = addNoise(image([[100, 100, 100, 255]]), {amount: 10, monochrome: true}, () => (n++ % 2 ? 1 : 0));
		expect(img.data[0]).toBe(img.data[1]);
		expect(img.data[1]).toBe(img.data[2]);
	});

	it('does nothing with zero amount', () => {
		const img = addNoise(image([[1, 2, 3, 4]]), {amount: 0});
		expect(Array.from(img.data)).toEqual([1, 2, 3, 4]);
	});
});

describe('Color balance', () => {
	it('parses hex colors', () => {
		expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
		expect(parseHex('#f00')).toEqual([255, 0, 0]);
		expect(parseHex('nonsense')).toEqual([0, 0, 0]);
	});

	it('does nothing with zero shifts', () => {
		const img = colorBalance(image([[100, 120, 140, 255]]), {});
		expect(Array.from(img.data)).toEqual([100, 120, 140, 255]);
	});

	it('adds red to midtones without luminosity preservation', () => {
		const img = colorBalance(image([[128, 128, 128, 255]]), {cyan_red: 100, preserve_luminosity: false});
		expect(img.data[0]).toBeGreaterThan(128);
		expect(img.data[1]).toBe(128);
	});

	it('does not touch pure black with highlights range', () => {
		const img = colorBalance(image([[0, 0, 0, 255]]), {range: 'highlights', cyan_red: 100, preserve_luminosity: false});
		expect(Array.from(img.data)).toEqual([0, 0, 0, 255]);
	});

	it('keeps luminosity when asked', () => {
		const before = 0.299 * 128 + 0.587 * 128 + 0.114 * 128;
		const img = colorBalance(image([[128, 128, 128, 255]]), {yellow_blue: 40});
		const after = 0.299 * img.data[0] + 0.587 * img.data[1] + 0.114 * img.data[2];
		expect(Math.abs(after - before)).toBeLessThan(2);
	});
});

describe('Photo filter and gradient map', () => {
	it('does not change image with zero density', () => {
		const img = photoFilter(image([[10, 100, 200, 255]]), {color: '#ff0000', density: 0});
		expect(Array.from(img.data)).toEqual([10, 100, 200, 255]);
	});

	it('tints towards the filter color', () => {
		const img = photoFilter(image([[200, 200, 200, 255]]), {color: '#ff0000', density: 100, preserve_luminosity: false});
		expect(Array.from(img.data)).toEqual([200, 0, 0, 255]);
	});

	it('preserves luminosity of photo filter', () => {
		const img = photoFilter(image([[200, 200, 200, 255]]), {color: '#ffcc66', density: 30});
		const lum = 0.299 * img.data[0] + 0.587 * img.data[1] + 0.114 * img.data[2];
		expect(Math.abs(lum - 200)).toBeLessThan(2);
	});

	it('maps black and white to gradient ends and keeps alpha', () => {
		const img = gradientMap(image([[0, 0, 0, 9], [255, 255, 255, 255]]), {shadows: '#ff0000', highlights: '#0000ff'});
		expect(Array.from(img.data)).toEqual([255, 0, 0, 9, 0, 0, 255, 255]);
	});

	it('supports midtones and reverse', () => {
		const mid = gradientMap(image([[128, 128, 128, 255]]), {shadows: '#000000', midtones: '#00ff00', highlights: '#ffffff'});
		expect(mid.data[1]).toBeGreaterThan(250);
		const rev = gradientMap(image([[0, 0, 0, 255]]), {shadows: '#000000', highlights: '#ffffff', reverse: true});
		expect(Array.from(rev.data)).toEqual([255, 255, 255, 255]);
	});
});

describe('Channel mixer and shadows/highlights', () => {
	it('is identity by default', () => {
		expect(Array.from(channelMixer(image([[10, 20, 30, 40]]), {}).data)).toEqual([10, 20, 30, 40]);
	});

	it('swaps red and blue channels', () => {
		const img = channelMixer(image([[10, 20, 30, 255]]), {r_r: 0, r_b: 100, b_b: 0, b_r: 100});
		expect(Array.from(img.data)).toEqual([30, 20, 10, 255]);
	});

	it('creates monochrome from the red row', () => {
		const img = channelMixer(image([[100, 50, 0, 255]]), {r_r: 50, r_g: 100, r_b: 0, monochrome: true});
		expect(Array.from(img.data)).toEqual([100, 100, 100, 255]);
	});

	it('lifts shadows without changing black and white', () => {
		const img = shadowsHighlights(image([[0, 0, 0, 255], [60, 60, 60, 255], [255, 255, 255, 255]]), {shadows: 100});
		expect(img.data[0]).toBe(0);
		expect(img.data[4]).toBeGreaterThan(60);
		expect(img.data[8]).toBe(255);
	});

	it('darkens highlights', () => {
		const img = shadowsHighlights(image([[230, 230, 230, 255]]), {shadows: 0, highlights: 100});
		expect(img.data[0]).toBeLessThan(230);
	});
});

describe('Equalize and auto color', () => {
	it('equalize spreads two tones to black and white', () => {
		const img = equalize(image([[100, 100, 100, 255], [150, 150, 150, 255]]));
		expect(Array.from(img.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
	});

	it('equalize ignores flat and transparent images', () => {
		expect(Array.from(equalize(image([[90, 90, 90, 255]])).data)).toEqual([90, 90, 90, 255]);
		expect(Array.from(equalize(image([[10, 20, 30, 0]])).data)).toEqual([10, 20, 30, 0]);
	});

	it('auto color stretches every channel independently', () => {
		const img = autoColor(image([[10, 100, 200, 255], [20, 150, 220, 255]]));
		expect(Array.from(img.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
	});

	it('auto color keeps flat channels', () => {
		const img = autoColor(image([[10, 50, 5, 255], [20, 50, 9, 255]]));
		expect(img.data[1]).toBe(50);
	});
});

describe('Temperature/Tint and sepia', () => {
	it('warms and cools the image', () => {
		const warm = temperatureTint(image([[100, 100, 100, 255]]), {temperature: 100});
		expect(warm.data[0]).toBeGreaterThan(100);
		expect(warm.data[2]).toBeLessThan(100);
		const cool = temperatureTint(image([[100, 100, 100, 255]]), {temperature: -100});
		expect(cool.data[0]).toBeLessThan(100);
		expect(cool.data[2]).toBeGreaterThan(100);
	});

	it('tint moves the green channel and is identity by default', () => {
		expect(temperatureTint(image([[100, 100, 100, 255]]), {tint: 100}).data[1]).toBeLessThan(100);
		expect(Array.from(temperatureTint(image([[1, 2, 3, 4]]), {}).data)).toEqual([1, 2, 3, 4]);
	});

	it('sepia with zero amount is identity, full amount is brownish', () => {
		expect(Array.from(sepia(image([[10, 20, 30, 255]]), 0).data)).toEqual([10, 20, 30, 255]);
		const img = sepia(image([[100, 100, 100, 255]]), 100);
		expect(img.data[0]).toBeGreaterThan(img.data[1]);
		expect(img.data[1]).toBeGreaterThan(img.data[2]);
	});
});

describe('Swap and extract channels', () => {
	it('swaps channels and keeps alpha', () => {
		expect(Array.from(swapChannels(image([[1, 2, 3, 9]]), 'bgr').data)).toEqual([3, 2, 1, 9]);
		expect(Array.from(swapChannels(image([[1, 2, 3, 9]]), 'gbr').data)).toEqual([2, 3, 1, 9]);
	});

	it('ignores invalid order', () => {
		expect(Array.from(swapChannels(image([[1, 2, 3, 9]]), 'xyz').data)).toEqual([1, 2, 3, 9]);
	});

	it('extracts a single channel as gray', () => {
		expect(Array.from(extractChannel(image([[10, 20, 30, 9]]), 'green').data)).toEqual([20, 20, 20, 9]);
		expect(Array.from(extractChannel(image([[10, 20, 30, 9]]), 'nope' as any).data)).toEqual([10, 20, 30, 9]);
	});
});

describe('Selective color and curves', () => {
	it('selective color is identity without adjustments or with unknown range', () => {
		expect(Array.from(selectiveColor(image([[200, 50, 50, 255]]), {range: 'reds'}).data)).toEqual([200, 50, 50, 255]);
		expect(Array.from(selectiveColor(image([[200, 50, 50, 255]]), {range: 'xx', cyan: 50}).data)).toEqual([200, 50, 50, 255]);
	});

	it('adds magenta only to reds', () => {
		const red = selectiveColor(image([[200, 50, 50, 255]]), {range: 'reds', magenta: 100});
		expect(red.data[1]).toBeLessThan(50);
		const green = selectiveColor(image([[50, 200, 50, 255]]), {range: 'reds', magenta: 100});
		expect(Array.from(green.data)).toEqual([50, 200, 50, 255]);
	});

	it('does not touch grays in hue ranges', () => {
		const gray = selectiveColor(image([[120, 120, 120, 255]]), {range: 'reds', black: 100});
		expect(Array.from(gray.data)).toEqual([120, 120, 120, 255]);
	});

	it('blacks range darkens dark pixels only', () => {
		const img = selectiveColor(image([[20, 20, 20, 255], [240, 240, 240, 255]]), {range: 'blacks', black: 100});
		expect(img.data[0]).toBeLessThan(20);
		expect(img.data[4]).toBe(240);
	});

	it('curve lookup is identity for linear points and passes through the points', () => {
		const lin = curveLookup([[0, 0], [64, 64], [128, 128], [192, 192], [255, 255]]);
		expect(lin[0]).toBe(0);
		expect(lin[100]).toBe(100);
		expect(lin[255]).toBe(255);
		const bent = curveLookup([[0, 0], [64, 100], [128, 128], [192, 192], [255, 255]]);
		expect(bent[64]).toBe(100);
	});

	it('curves lighten midtones, can invert and work per channel', () => {
		const light = curves(image([[64, 64, 64, 255]]), {p64: 120});
		expect(light.data[0]).toBe(120);
		const inverted = curves(image([[0, 128, 255, 255]]), {p0: 255, p64: 191, p128: 127, p192: 63, p255: 0});
		expect(inverted.data[0]).toBe(255);
		expect(inverted.data[2]).toBe(0);
		const red_only = curves(image([[64, 64, 64, 255]]), {channel: 'red', p64: 120});
		expect(Array.from(red_only.data)).toEqual([120, 64, 64, 255]);
	});

	it('curves keeps ordering monotone with a steep point', () => {
		const l = curveLookup([[0, 0], [64, 250], [128, 251], [192, 252], [255, 255]]);
		for (let i = 1; i < 256; i++) expect(l[i]).toBeGreaterThanOrEqual(l[i - 1]);
	});
});

describe('dodge and burn', () => {
	it('dodge lightens, burn darkens, alpha and flat white/black behave', () => {
		const dodge = dodgeBurn(image([[100, 100, 100, 77]]), { mode: 'dodge', exposure: 100 });
		expect(dodge.data[0]).toBeGreaterThan(100);
		expect(dodge.data[3]).toBe(77);
		const burn = dodgeBurn(image([[100, 100, 100, 255]]), { mode: 'burn', exposure: 100 });
		expect(burn.data[0]).toBeLessThan(100);
		expect(Array.from(dodgeBurn(image([[255, 255, 255, 255]]), { mode: 'dodge', exposure: 100 }).data)).toEqual([255, 255, 255, 255]);
		expect(Array.from(dodgeBurn(image([[0, 0, 0, 255]]), { mode: 'burn', exposure: 100 }).data)).toEqual([0, 0, 0, 255]);
	});

	it('exposure scales the effect and zero does nothing', () => {
		const small = dodgeBurn(image([[100, 100, 100, 255]]), { mode: 'dodge', exposure: 10 }).data[0];
		const large = dodgeBurn(image([[100, 100, 100, 255]]), { mode: 'dodge', exposure: 80 }).data[0];
		expect(large).toBeGreaterThan(small);
		expect(Array.from(dodgeBurn(image([[10, 20, 30, 255]]), { mode: 'dodge', exposure: 0 }).data)).toEqual([10, 20, 30, 255]);
	});

	it('range limits the effect to shadows, midtones or highlights', () => {
		const dark = () => image([[20, 20, 20, 255]]);
		const bright = () => image([[240, 240, 240, 255]]);
		expect(dodgeBurn(dark(), { mode: 'dodge', exposure: 100, range: 'shadows' }).data[0]).toBeGreaterThan(30);
		expect(dodgeBurn(bright(), { mode: 'dodge', exposure: 100, range: 'shadows' }).data[0]).toBeLessThanOrEqual(241);
		expect(dodgeBurn(bright(), { mode: 'burn', exposure: 100, range: 'highlights' }).data[0]).toBeLessThan(230);
		expect(dodgeBurn(dark(), { mode: 'burn', exposure: 100, range: 'highlights' }).data[0]).toBeGreaterThan(18);
		expect(dodgeBurn(dark(), { mode: 'dodge', exposure: 100, range: 'midtones' }).data[0]).toBeLessThan(dodgeBurn(image([[128, 128, 128, 255]]), { mode: 'dodge', exposure: 100, range: 'midtones' }).data[0] - 100);
	});
});

describe('smudge blend', () => {
	it('mixes the source into the target by strength and keeps the target for strength 0', () => {
		const target = image([[0, 0, 0, 255]]);
		const source = image([[200, 100, 50, 255]]);
		expect(Array.from(smudgeBlend(image([[0, 0, 0, 255]]), source, 0).data)).toEqual([0, 0, 0, 255]);
		expect(Array.from(smudgeBlend(image([[0, 0, 0, 255]]), source, 100).data)).toEqual([200, 100, 50, 255]);
		expect(Array.from(smudgeBlend(target, source, 50).data)).toEqual([100, 50, 25, 255]);
	});

	it('does not bleed color from transparent source pixels', () => {
		const result = smudgeBlend(image([[255, 0, 0, 255]]), image([[0, 255, 0, 0]]), 50);
		expect(result.data[0]).toBe(255);
		expect(result.data[1]).toBe(0);
		expect(result.data[3]).toBeGreaterThan(120);
		expect(result.data[3]).toBeLessThan(135);
	});

	it('fills transparent targets from the source and handles empty areas', () => {
		const result = smudgeBlend(image([[0, 0, 0, 0]]), image([[10, 20, 30, 255]]), 100);
		expect(Array.from(result.data)).toEqual([10, 20, 30, 255]);
		expect(Array.from(smudgeBlend(image([[5, 5, 5, 0]]), image([[9, 9, 9, 0]]), 80).data)).toEqual([0, 0, 0, 0]);
	});
});

describe('hue/saturation colorize', () => {
	it('turns every pixel into one hue and keeps the brightness order', () => {
		const img = hueSaturation(image([[10, 200, 30, 255], [250, 250, 250, 255], [0, 0, 0, 255]]), { colorize: true, hue: 0, saturation: 100 });
		// hue 0 = red, so green and blue channels follow the red one only for white
		expect(img.data[0]).toBeGreaterThan(img.data[1]);
		expect(img.data[0]).toBeGreaterThan(img.data[2]);
		expect(img.data[4]).toBe(255);
		expect(Array.from(img.data.slice(8, 12))).toEqual([0, 0, 0, 255]);
	});

	it('zero saturation gives gray, hue 120 gives green and alpha is kept', () => {
		const gray = hueSaturation(image([[200, 10, 10, 77]]), { colorize: true, hue: 0, saturation: 0 });
		expect(gray.data[0]).toBe(gray.data[1]);
		expect(gray.data[1]).toBe(gray.data[2]);
		expect(gray.data[3]).toBe(77);
		const green = hueSaturation(image([[128, 128, 128, 255]]), { colorize: true, hue: 120, saturation: 100 });
		expect(green.data[1]).toBeGreaterThan(green.data[0]);
		expect(green.data[1]).toBeGreaterThan(green.data[2]);
	});

	it('negative hue wraps around and lightness shifts the result', () => {
		const a = hueSaturation(image([[128, 128, 128, 255]]), { colorize: true, hue: -120, saturation: 100 });
		const b = hueSaturation(image([[128, 128, 128, 255]]), { colorize: true, hue: 240, saturation: 100 });
		expect(Array.from(a.data)).toEqual(Array.from(b.data));
		const lighter = hueSaturation(image([[128, 128, 128, 255]]), { colorize: true, hue: 0, saturation: 50, lightness: 50 });
		const base = hueSaturation(image([[128, 128, 128, 255]]), { colorize: true, hue: 0, saturation: 50 });
		expect(lighter.data[1]).toBeGreaterThan(base.data[1]);
	});
});

describe('levels per channel', () => {
	it('changes only the chosen channel', () => {
		const red = levels(image([[100, 100, 100, 255]]), { in_black: 50, in_white: 150, channel: 'red' });
		expect(Array.from(red.data)).toEqual([128, 100, 100, 255]);
		const blue = levels(image([[100, 100, 100, 255]]), { in_black: 50, in_white: 150, channel: 'blue' });
		expect(Array.from(blue.data)).toEqual([100, 100, 128, 255]);
		const all = levels(image([[100, 100, 100, 255]]), { in_black: 50, in_white: 150, channel: 'rgb' });
		expect(Array.from(all.data)).toEqual([128, 128, 128, 255]);
		expect(Array.from(levels(image([[100, 100, 100, 255]]), { in_black: 50, in_white: 150, channel: 'x' }).data)).toEqual([128, 128, 128, 255]);
	});
});

describe('curves with any number of points', () => {
	it('normalizes points: sorts, clamps, de-duplicates and adds the end points', () => {
		expect(normalizeCurvePoints([[200, 10], [50, 300], [50, 20]])).toEqual([[0, 20], [50, 20], [200, 10], [255, 10]]);
		expect(normalizeCurvePoints([[0, 0], [255, 255]])).toEqual([[0, 0], [255, 255]]);
		expect(normalizeCurvePoints([[-10, -10], [999, 999]])).toEqual([[0, 0], [255, 255]]);
	});

	it('gives the identity curve for missing or invalid input', () => {
		expect(normalizeCurvePoints(undefined as any)).toEqual([[0, 0], [255, 255]]);
		expect(normalizeCurvePoints([] as any)).toEqual([[0, 0], [255, 255]]);
		expect(normalizeCurvePoints([['a', 'b'], null, [NaN, 3]] as any)).toEqual([[0, 0], [255, 255]]);
	});

	it('does nothing without curves and keeps alpha', () => {
		const img = curvesFromPoints(image([[10, 100, 250, 77]]), {});
		expect(Array.from(img.data)).toEqual([10, 100, 250, 77]);
	});

	it('applies the master curve to all channels with a free number of points', () => {
		const img = curvesFromPoints(image([[64, 128, 192, 255]]), { rgb: [[0, 0], [64, 128], [128, 128], [255, 255]] });
		expect(img.data[0]).toBe(128);
		expect(img.data[1]).toBe(128);
		expect(img.data[2]).toBeGreaterThan(150);
		expect(img.data[2]).toBeLessThan(200);
		expect(img.data[3]).toBe(255);
	});

	it('channel curves change one channel and are applied after the master curve', () => {
		const only_red = curvesFromPoints(image([[100, 100, 100, 255]]), { red: [[0, 0], [100, 200], [255, 255]] });
		expect(Array.from(only_red.data)).toEqual([200, 100, 100, 255]);
		const both = curvesFromPoints(image([[100, 100, 100, 255]]), {
			rgb: [[0, 0], [100, 50], [255, 255]],
			blue: [[0, 0], [50, 150], [255, 255]],
		});
		expect(both.data[0]).toBe(50);
		expect(both.data[2]).toBe(150);
	});

	it('inverts with two points', () => {
		const img = curvesFromPoints(image([[0, 128, 255, 255]]), { rgb: [[0, 255], [255, 0]] });
		expect(img.data[0]).toBe(255);
		expect(img.data[2]).toBe(0);
	});
});

describe('histograms', () => {
	it('counts values per channel and luminance and skips transparent pixels', () => {
		const h = histograms(image([[255, 0, 0, 255], [255, 0, 0, 255], [0, 255, 0, 255], [9, 9, 9, 0]]));
		expect(h.red[255]).toBe(2);
		expect(h.red[0]).toBe(1);
		expect(h.green[255]).toBe(1);
		expect(h.blue[0]).toBe(3);
		expect(h.red[9]).toBe(0);
		expect(h.rgb[76]).toBe(2); // luminance of pure red
		expect(h.rgb.reduce((a, b) => a + b, 0)).toBe(3);
	});

	it('works for an empty image', () => {
		const h = histograms({ width: 0, height: 0, data: new Uint8ClampedArray(0) });
		expect(h.rgb.length).toBe(256);
		expect(h.rgb.every((v) => v === 0)).toBe(true);
	});
});
