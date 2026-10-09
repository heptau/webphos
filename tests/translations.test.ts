import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import menuDefinition from '../src/js/config-menu.js';

const root = join(__dirname, '../src/js');
const languages_dir = join(root, 'languages');
const cs: Record<string, string> = JSON.parse(readFileSync(join(languages_dir, 'cs.json'), 'utf8'));

type MenuItem = { name?: string; app_menu?: boolean; verbatim?: boolean; children?: MenuItem[] };

function menu_names(items: MenuItem[], result: string[] = []): string[] {
	for (const item of items) {
		if (item.name && !item.app_menu && !item.verbatim) {
			result.push(item.name);
		}
		if (item.children) {
			menu_names(item.children, result);
		}
	}
	return result;
}

function source_files(dir: string, result: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory() && entry.name != 'languages' && entry.name != 'libs') {
			source_files(path, result);
		}
		else if (entry.isFile() && entry.name.endsWith('.js')) {
			result.push(path);
		}
	}
	return result;
}

describe('translations', () => {
	it('every language file is valid JSON with string values', () => {
		for (const file of readdirSync(languages_dir).filter((name) => name.endsWith('.json'))) {
			const data = JSON.parse(readFileSync(join(languages_dir, file), 'utf8'));
			for (const key of Object.keys(data)) {
				expect(typeof data[key]).toBe('string');
			}
		}
	});

	it('language files contain only real translations (no empty or untranslated entries)', () => {
		for (const file of readdirSync(languages_dir).filter((name) => name.endsWith('.json') && name != 'empty.json')) {
			const data: Record<string, string> = JSON.parse(readFileSync(join(languages_dir, file), 'utf8'));
			//Czech is the reference dictionary, it may keep names that are the same in both languages
			const bad = Object.keys(data).filter((key) => data[key] === '' || (file != 'cs.json' && data[key] === key));
			expect({ file, bad }).toEqual({ file, bad: [] });
		}
	});

	it('Czech dictionary has all menu items', () => {
		const missing = menu_names(menuDefinition as MenuItem[]).filter((name) => !(name in cs) && !/^\d+$/.test(name));
		expect(missing).toEqual([]);
	});

	it('Czech dictionary has titles of dialogs and their fields', () => {
		const missing: string[] = [];
		const is_shortcut = (text: string) => /^(CTRL|Ctrl|Alt|Shift|F\d+|[A-Z]|.*⌘.*)( \+ .*)?$/.test(text);
		for (const file of source_files(root)) {
			const text = readFileSync(file, 'utf8');
			for (const match of text.matchAll(/\b(?:title|comment)\s*:\s*(['"])((?:(?!\1).)+)\1/g)) {
				const value = match[2];
				if (/^[A-Z][^<>{}$]*$/.test(value) && !is_shortcut(value) && !(value in cs)) {
					missing.push(value + '  (' + file.replace(root + '/', '') + ')');
				}
			}
		}
		expect(missing).toEqual([]);
	});

	it('empty.json (translator template) has every key of the Czech dictionary', () => {
		const empty = JSON.parse(readFileSync(join(languages_dir, 'empty.json'), 'utf8'));
		const missing = Object.keys(cs).filter((key) => !(key in empty));
		expect(missing).toEqual([]);
	});
});
