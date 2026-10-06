import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Image_adjustments_class from './adjustments.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { parse_commands, apply_steps, RECIPES } from './../../libs/quick-commands.js';
import { t } from '../tools/translate.js';

/**
 * Image > Quick Edit - describe the change in words ("brighter, more contrast, warmer"),
 * Image > Recipes - ready-made combinations. Works on the active layer and the selection, one undo step.
 */
class Image_quick_edit_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Adjustments = new Image_adjustments_class();
	}

	quick_edit() {
		if (this.Adjustments.can_apply() == false) {
			return;
		}
		this.POP.show({
			title: 'Quick Edit',
			params: [
				{name: 'text', title: 'What should change?', type: 'textarea', value: '', placeholder: 'a bit brighter, more contrast, warmer'},
				{html: '<span class="field_comment">' + t('Words: brighter, darker, more / less contrast, more / less saturation, warmer, cooler, black and white, sepia, sharpen, invert, auto. Separate them with commas.').replace(/</g, '&lt;') + '</span>'},
			],
			on_finish: (params) => {
				this.run(params.text);
			},
		});
	}

	/**
	 * @param {string} text commands in words
	 */
	run(text) {
		var result = parse_commands(text);
		if (result.steps.length == 0) {
			alertify.warning(t('Nothing to do - try words like "brighter" or "black and white".'));
			return;
		}
		if (result.unknown.length > 0) {
			alertify.warning(t('Not understood: ') + result.unknown.join(', '));
		}
		return this.Adjustments.apply_direct((img) => apply_steps(img, result.steps));
	}

	/**
	 * @param {string} name key of RECIPES
	 */
	recipe(name) {
		if (RECIPES[name] == undefined || this.Adjustments.can_apply() == false) {
			return;
		}
		return this.run(RECIPES[name]);
	}
}

export default Image_quick_edit_class;
