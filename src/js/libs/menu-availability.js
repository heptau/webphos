/**
 * Menu items that work only with pixels of an image layer. On a text, shape, stroke or adjustment layer (and on the
 * empty first layer) they would only show "This layer must contain an image", so the menu disables them - the same
 * way the toolbar disables raster tools (see raster-tools.js). The keys are the `target` of the menu items.
 */

//whole modules: every method of them needs an image layer
const IMAGE_MODULES = [
	'image/adjustments', 'image/photo_effects', 'image/quick_edit', 'image/auto_adjust', 'image/color_corrections',
	'image/decrease_colors', 'image/palette', 'image/flip',
	'tools/color_zoom', 'tools/replace_color', 'tools/restore_alpha', 'tools/keypoints', 'tools/content_fill',
	'effects/browser',
];

//single methods
const IMAGE_TARGETS = [
	'image/trim.trim_to_content',
	'edit/warp.warp', 'edit/transform.skew', 'edit/transform.perspective', 'edit/transform.distort',
	'layer/mask.remove_background', 'layer/mask.apply',
	'edit/selection.color_range', 'edit/selection.select_subject', 'edit/selection.select_sky',
	'edit/selection.select_edges', 'edit/selection.luminosity', 'edit/selection.layer_transparency',
	'edit/selection.select_similar', 'edit/selection.grow_similar',
];

//these items of the modules above do not touch pixels (Fade works with the history, the LUT with the last adjustment)
const NOT_IMAGE_TARGETS = ['image/adjustments.fade', 'image/photo_effects.save_adjustment_lut'];

//the live filters that are drawn over any layer (CSS filter); the other effects change pixels
const ANY_LAYER_EFFECTS = [
	'effects/borders',
	'effects/common/blur', 'effects/common/brightness', 'effects/common/contrast', 'effects/common/grayscale',
	'effects/common/hue-rotate', 'effects/common/invert', 'effects/common/saturate', 'effects/common/sepia',
	'effects/common/shadow', 'effects/common/glow',
];

//fill works on an image and also on the empty first layer, which it turns into a picture
const IMAGE_OR_EMPTY_TARGETS = ['edit/fill.fill', 'edit/fill.fill_background', 'edit/fill.fill_pattern'];

/**
 * @param {string|undefined} target menu item target, "<folder>/<file>.<method>"
 * @param {{type: string|null}|null} layer active layer
 * @returns {boolean} the menu item can not be used on the layer
 */
export function is_menu_item_disabled(target, layer) {
	if (!target || !layer) {
		return false;
	}
	const module_name = target.split('.')[0];
	const is_image = layer.type == 'image';
	if (IMAGE_OR_EMPTY_TARGETS.includes(target)) {
		return !is_image && layer.type != null;
	}
	if (is_image || NOT_IMAGE_TARGETS.includes(target)) {
		return false;
	}
	if (IMAGE_MODULES.includes(module_name) || IMAGE_TARGETS.includes(target)) {
		return true;
	}
	if (module_name.startsWith('effects/') && ANY_LAYER_EFFECTS.includes(module_name) == false) {
		return true;
	}
	return false;
}
