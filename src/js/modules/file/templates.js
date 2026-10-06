import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import app from './../../app.js';
import { export_as_json } from './save-helpers.js';
import { save_template, list_templates, load_template, delete_template } from './../../libs/templates.js';
import { t } from '../tools/translate.js';

/**
 * File > Save as Template / New from Template - the project is kept in the browser and opens as a new document
 */
class File_templates_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	save_as_template() {
		this.POP.show({
			title: 'Save as Template',
			params: [
				{name: "name", title: "Name:", value: ""},
			],
			on_finish: async (params) => {
				if (await save_template(params.name, export_as_json())) {
					alertify.success(t('Template saved.'));
				}
				else {
					alertify.error(t('The template could not be saved.'));
				}
			},
		});
	}

	async new_from_template() {
		var templates = await list_templates();
		if (templates.length == 0) {
			alertify.warning(t('There are no templates yet. Use File > Save as Template.'));
			return;
		}
		var names = templates.map((item) => item.name);
		this.POP.show({
			title: 'New from Template',
			params: [
				{name: "name", title: "Template:", type: 'select', values: names, value: names[0]},
				{name: "remove", title: "Delete this template:", value: false},
			],
			on_finish: async (params) => {
				if (params.remove) {
					await delete_template(params.name);
					alertify.success(t('Template deleted.'));
					return;
				}
				var json = await load_template(params.name);
				if (!json) {
					alertify.error(t('The template could not be opened.'));
					return;
				}
				await app.GUI.GUI_documents.open_json_as_new(params.name, json);
			},
		});
	}
}

export default File_templates_class;
