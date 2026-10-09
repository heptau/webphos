import { group_names, layers_in_group, group_visibility_toggles, clean_group_name } from '../src/js/libs/layer-groups.js';

const layers: any[] = [
	{ id: 1, type: 'image', group: 'Sky', visible: true },
	{ id: 2, type: 'image', group: 'Hills', visible: true },
	{ id: 3, type: 'image', group: 'Sky', visible: false },
	{ id: 4, type: 'image', group: null, visible: true },
	{ id: 5, type: null, group: 'Sky', visible: true },
	{ id: 6, type: 'image', visible: true },
];

describe('layer groups', () => {
	it('lists group names once in order of appearance', () => {
		expect(group_names(layers)).toEqual(['Sky', 'Hills']);
		expect(group_names([])).toEqual([]);
		expect(group_names([{ group: '' }, { group: 5 as any }])).toEqual([]);
	});

	it('finds the real layers of a group only', () => {
		expect(layers_in_group(layers, 'Sky').map((l) => l.id)).toEqual([1, 3]);
		expect(layers_in_group(layers, 'Nothing')).toEqual([]);
	});

	it('hides a group when any layer is visible and shows it when all are hidden', () => {
		expect(group_visibility_toggles(layers, 'Sky')).toEqual({ ids: [1], visible: false });
		const hidden = layers.map((l) => ({ ...l, visible: false }));
		expect(group_visibility_toggles(hidden, 'Sky')).toEqual({ ids: [1, 3], visible: true });
		expect(group_visibility_toggles(layers, 'Hills')).toEqual({ ids: [2], visible: false });
		expect(group_visibility_toggles(layers, 'Empty')).toEqual({ ids: [], visible: true });
	});

	it('cleans names', () => {
		expect(clean_group_name('  My   group ')).toBe('My   group');
		expect(clean_group_name('a\nb\tc')).toBe('a b c');
		expect(clean_group_name('x'.repeat(100)).length).toBe(60);
		expect(clean_group_name(null)).toBe('');
		expect(clean_group_name(42 as any)).toBe('');
	});
});
