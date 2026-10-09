import { is_menu_item_disabled } from '../src/js/libs/menu-availability.js';

const image = {type: 'image'};
const text = {type: 'text'};
const empty = {type: null};

describe('is_menu_item_disabled', () => {
	test('pixel commands need an image layer', () => {
		for (const target of ['image/adjustments.invert', 'image/photo_effects.vignette', 'effects/oil.oil',
			'effects/instagram/aden.aden', 'effects/common/stroke.stroke', 'edit/warp.warp', 'image/flip.horizontal']) {
			expect(is_menu_item_disabled(target, text)).toBe(true);
			expect(is_menu_item_disabled(target, empty)).toBe(true);
			expect(is_menu_item_disabled(target, image)).toBe(false);
		}
	});

	test('commands that do not touch pixels stay enabled', () => {
		for (const target of ['image/adjustments.fade', 'effects/common/shadow.shadow', 'effects/borders.borders',
			'layer/new.new', 'image/resize.resize', 'edit/selection.select_all', 'file/save.save']) {
			expect(is_menu_item_disabled(target, text)).toBe(false);
		}
	});

	test('fill works also on the empty layer', () => {
		expect(is_menu_item_disabled('edit/fill.fill', empty)).toBe(false);
		expect(is_menu_item_disabled('edit/fill.fill', text)).toBe(true);
	});

	test('no layer or no target means enabled', () => {
		expect(is_menu_item_disabled('image/adjustments.invert', null)).toBe(false);
		expect(is_menu_item_disabled(undefined, text)).toBe(false);
	});
});
