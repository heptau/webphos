import { blocks_update, LOCKED_PROPERTIES } from '../src/js/libs/layer-lock.js';

describe('layer lock', () => {
	it('an unlocked layer accepts everything', () => {
		expect(blocks_update({ locked: false }, { x: 5, width: 10 })).toBe(false);
		expect(blocks_update({}, { x: 5 })).toBe(false);
		expect(blocks_update(null as any, { x: 5 })).toBe(false);
	});

	it('a locked layer refuses changes of position, size, rotation and parameters', () => {
		for (const key of LOCKED_PROPERTIES) {
			expect(blocks_update({ locked: true }, { [key]: 1 })).toBe(true);
		}
		expect(blocks_update({ locked: true }, { name: 'x', x: 1 })).toBe(true);
	});

	it('a locked layer still allows visibility, opacity, name, mask, filters and the lock itself', () => {
		expect(blocks_update({ locked: true }, { locked: false })).toBe(false);
		expect(blocks_update({ locked: true }, { name: 'x', opacity: 50, visible: false, composition: 'multiply' })).toBe(false);
		expect(blocks_update({ locked: true }, { mask: null, mask_enabled: true })).toBe(false);
		expect(blocks_update({ locked: true }, {})).toBe(false);
		expect(blocks_update({ locked: true }, undefined as any)).toBe(false);
	});

	it('only a real true locks (strings and numbers do not)', () => {
		expect(blocks_update({ locked: 'true' }, { x: 1 })).toBe(false);
		expect(blocks_update({ locked: 1 }, { x: 1 })).toBe(false);
	});
});
