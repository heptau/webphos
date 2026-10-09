import { match_shortcut, has_modifier, find_shortcut, format_shortcut_mac } from '../src/js/libs/shortcuts.js';
import shortcutsDefinition from '../src/js/config-shortcuts.js';

type Shortcut = { target: string };

function key(k: string, extra: Record<string, unknown> = {}): KeyboardEvent {
	return { key: k, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra } as unknown as KeyboardEvent;
}

describe('Keyboard shortcuts', () => {
	it('matches Ctrl and Cmd as the same modifier', () => {
		expect(match_shortcut(key('d', { ctrlKey: true }), { key: 'd', ctrl: true })).toBe(true);
		expect(match_shortcut(key('d', { metaKey: true }), { key: 'd', ctrl: true })).toBe(true);
		expect(match_shortcut(key('d'), { key: 'd', ctrl: true })).toBe(false);
	});

	it('requires exact Shift and Alt state', () => {
		expect(match_shortcut(key('U', { ctrlKey: true, shiftKey: true }), { key: 'u', ctrl: true, shift: true })).toBe(true);
		expect(match_shortcut(key('u', { ctrlKey: true }), { key: 'u', ctrl: true, shift: true })).toBe(false);
		expect(match_shortcut(key('e', { ctrlKey: true, shiftKey: true }), { key: 'e', ctrl: true })).toBe(false);
		expect(match_shortcut(key('Backspace', { altKey: true }), { key: 'Backspace', alt: true })).toBe(true);
	});

	it('supports shift "any" and key lists', () => {
		const zoom = { key: ['=', '+'], ctrl: true, shift: 'any' };
		expect(match_shortcut(key('=', { ctrlKey: true }), zoom)).toBe(true);
		expect(match_shortcut(key('+', { ctrlKey: true, shiftKey: true }), zoom)).toBe(true);
	});

	it('falls back to physical key for non-latin characters', () => {
		//Czech keyboard: Ctrl + "é" key is Digit0
		expect(match_shortcut(key('é', { ctrlKey: true, code: 'Digit0' }), { key: '0', ctrl: true })).toBe(true);
		expect(match_shortcut(key('ú', { code: 'BracketLeft' }), { key: '[' })).toBe(true);
		//QWERTZ "z" key has code KeyY - must not be treated as "y"
		expect(match_shortcut(key('z', { ctrlKey: true, code: 'KeyY' }), { key: 'y', ctrl: true })).toBe(false);
	});

	it('detects modifiers', () => {
		expect(has_modifier(key('d'))).toBe(false);
		expect(has_modifier(key('d', { shiftKey: true }))).toBe(false);
		expect(has_modifier(key('d', { metaKey: true }))).toBe(true);
		expect(has_modifier(key('d', { altKey: true }))).toBe(true);
	});

	it('finds shortcut definitions without conflicts', () => {
		expect((find_shortcut(key('j', { ctrlKey: true }), shortcutsDefinition) as Shortcut | null)?.target).toBe('layer/duplicate.via_copy');
		expect((find_shortcut(key('E', { ctrlKey: true, shiftKey: true }), shortcutsDefinition) as Shortcut | null)?.target).toBe('layer/flatten.flatten');
		expect(find_shortcut(key('x'), shortcutsDefinition)).toBeNull();

		for (const definition of shortcutsDefinition) {
			expect(typeof definition.target).toBe('string');
			expect(definition.target).toMatch(/^[a-z_/]+\.[a-z_0-9]+$/);
		}
	});

	it('formats shortcuts in macOS notation', () => {
		expect(format_shortcut_mac('Ctrl+I')).toBe('⌘I');
		expect(format_shortcut_mac('Shift+Ctrl+D')).toBe('⇧⌘D');
		expect(format_shortcut_mac('Alt+Backspace')).toBe('⌥⌫');
		expect(format_shortcut_mac('Ctrl++')).toBe('⌘+');
		expect(format_shortcut_mac('Ctrl+-')).toBe('⌘-');
		expect(format_shortcut_mac('Shift + S')).toBe('⇧S');
		expect(format_shortcut_mac('F10')).toBe('F10');
		expect(format_shortcut_mac('Del')).toBe('⌦');
		expect(format_shortcut_mac('')).toBe('');
	});
});
