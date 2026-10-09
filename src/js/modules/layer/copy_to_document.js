import app from './../../app.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Copy to Document - the active layer is copied to another open document
 */
class Layer_copy_to_document_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	copy_to_document() {
		const docs = app.GUI.GUI_documents;
		const targets = docs.documents.map((doc, index) => ({name: doc.name, index})).filter((item) => item.index != docs.active);
		if (targets.length == 0) {
			alertify.warning(t('Open another document first.'));
			return;
		}
		const names = targets.map((item) => item.name);
		this.POP.show({
			title: 'Copy to Document',
			params: [
				{name: "document", title: "Document:", type: 'select', values: names, value: names[0]},
			],
			on_finish: (params) => {
				const target = targets.find((item) => item.name == params.document);
				if (target && docs.copy_layer_to(target.index)) {
					alertify.success(`${t('Layer copied to')  } ${target.name}.`);
				}
				else {
					alertify.error(t('The layer could not be copied.'));
				}
			},
		});
	}
}

export default Layer_copy_to_document_class;
