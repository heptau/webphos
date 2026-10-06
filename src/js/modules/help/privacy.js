import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { load_session, clear_session } from './../../libs/autosave.js';
import { list_recent, clear_recent } from './../../libs/recent-files.js';
import { load_all_selections, delete_selection } from './../../libs/selection-store.js';
import { t } from '../tools/translate.js';

/**
 * Help > Privacy - miniPaint works only in the browser. This shows what it keeps on this computer
 * and lets the user delete it.
 */
class Help_privacy_class {

	constructor() {
		this.POP = new Dialog_class();
	}

	async privacy() {
		var session = await load_session();
		var recent = await list_recent();
		var selections = await load_all_selections();

		this.POP.show({
			title: 'Privacy',
			params: [
				{html: '<div>' + t('Your images never leave this browser - nothing is uploaded and there is no account. Only the data below is kept on this computer.') + '</div>'},
				{heading: 'Delete stored data'},
				{name: 'autosave', title: t('Autosaved work:') + ' ' + (session ? session.documents.length : 0), value: false},
				{name: 'recent', title: t('Recent files:') + ' ' + recent.length, value: false},
				{name: 'selections', title: t('Saved selections:') + ' ' + selections.length, value: false},
			],
			on_finish: async (params) => {
				var deleted = false;
				if (params.autosave) {
					await clear_session();
					deleted = true;
				}
				if (params.recent) {
					await clear_recent();
					deleted = true;
				}
				if (params.selections) {
					for (var i = 0; i < selections.length; i++) {
						await delete_selection(selections[i].name);
					}
					deleted = true;
				}
				if (deleted) {
					alertify.success(t('Stored data deleted.'));
				}
			},
		});
	}
}

export default Help_privacy_class;
