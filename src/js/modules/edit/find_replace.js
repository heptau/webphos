import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { replace_in_text_data } from './../../libs/text-replace.js';
import { t } from '../tools/translate.js';

/**
 * Edit > Find and Replace Text - changes a word in the text of all text layers (one undo step)
 */
class Edit_find_replace_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	find_replace() {
		const has_text = config.layers.some((layer) => layer.type == 'text');
		if (!has_text) {
			alertify.warning(t('There are no text layers.'));
			return;
		}
		this.POP.show({
			title: 'Find and Replace Text',
			params: [
				{name: "find", title: "Find:", value: ""},
				{name: "replace", title: "Replace with:", value: ""},
				{name: "case", title: "Match case:", value: false},
			],
			on_finish: (params) => {
				if (String(params.find) == '') {
					return;
				}
				const actions = [];
				let total = 0;
				config.layers.filter((layer) => layer.type == 'text' && Array.isArray(layer.data)).forEach((layer) => {
					const result = replace_in_text_data(layer.data, params.find, params.replace, params.case);
					if (result.count > 0) {
						total += result.count;
						actions.push(new app.Actions.Update_layer_action(layer.id, {data: result.data}));
					}
				});
				if (total == 0) {
					alertify.warning(t('Nothing was found.'));
					return;
				}
				app.State.do_action(new app.Actions.Bundle_action('find_replace', 'Find and Replace Text', actions));
				alertify.success(`${total  } ${  t('replacements')}`);
			},
		});
	}
}

export default Edit_find_replace_class;
