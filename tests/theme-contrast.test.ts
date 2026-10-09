import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(__dirname, '../src/css/reset.css'), 'utf8');

function block(selector: string): Record<string, string> {
	const start = css.indexOf(selector + ' {') >= 0 ? css.indexOf(selector + ' {') : css.indexOf(selector + '{');
	const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
	const vars: Record<string, string> = {};
	for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
		vars[match[1]] = match[2].trim();
	}
	return vars;
}

const root = block(':root');
const themes: Record<string, Record<string, string>> = {
	dark: root,
	light: { ...root, ...block('body.theme-light') },
	green: { ...root, ...block('body.theme-green') },
	contrast: { ...root, ...block('body.theme-contrast') },
};

function rgb(color: string): [number, number, number] | null {
	const hex = color.match(/^#([0-9a-f]{6})$/i);
	if (hex) {
		const n = parseInt(hex[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	return null; //translucent colors are not checked
}

function luminance([r, g, b]: [number, number, number]): number {
	const channel = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

//[foreground token, background token, minimal WCAG contrast]
const PAIRS: [string, string, number][] = [
	['--text-color', '--section-background-color', 4.5],
	['--text-color', '--block-background-color', 4.5],
	['--text-color', '--header-background-color', 4.5],
	['--text-color-muted', '--section-background-color', 4.5],
	['--input-text-color', '--input-background-color', 4.5],
	['--text-color', '--button-background-color', 4.5],
	['--accent-text', '--accent', 3],
	['--link-color', '--block-background-color', 4.5],
	['--text-color', '--background', 4.5],
];

describe('theme contrast (WCAG)', () => {
	for (const name of Object.keys(themes)) {
		for (const [fg, bg, minimum] of PAIRS) {
			it(`${name}: ${fg} on ${bg} >= ${minimum}`, () => {
				const vars = themes[name];
				const foreground = rgb(vars[fg] || '');
				const background = rgb(vars[bg] || '');
				if (!foreground || !background) {
					return;
				}
				expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
			});
		}
	}
});
