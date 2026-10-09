import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import Helper_class from './../../libs/helpers.js';
import { t } from '../tools/translate.js';
import { clear_session } from './../../libs/autosave.js';

const QUIT_URL = 'https://www.80.cz/projects/';

/**
 * Lumifex > Quit Lumifex - asks about unsaved work, forgets the stored session and shows the project page.
 * In a browser tab the tab itself goes to the project page, so the editor is gone. In an installed
 * application window the page opens in the browser and the application window is closed (when the
 * window can not be closed, the application starts again with an empty document).
 */
class Help_quit_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
	}

	has_unsaved_work() {
		if (app.State && app.State.action_history_index > 0) {
			return true;
		}
		const documents = app.GUI && app.GUI.GUI_documents ? app.GUI.GUI_documents.documents : [];
		if (documents.some((doc) => doc.dirty)) {
			return true;
		}
		return config.layers.length > 1 || this.Base_layers.is_layer_empty(config.layer.id) == false;
	}

	quit() {
		if (!this.has_unsaved_work()) {
			this.leave();
			return;
		}
		const message = this.Helper.escapeHtml(t('Do you want to save the changes before quitting?'));
		this.POP.show({
			title: 'Quit Lumifex',
			params: [
				{title: '', html: `<p>${message}</p>`},
			],
			on_finish: () => {
				//Save... (the save dialog opens; quit again afterwards)
				app.GUI.run_target('file/save.save', null);
			},
		});

		const ok = this.POP.el.querySelector('[data-id="popup_ok"]');
		ok.classList.remove('trn');
		ok.textContent = `${t('Save')  }…`;
		const dont_save = document.createElement('button');
		dont_save.type = 'button';
		dont_save.className = 'button';
		dont_save.textContent = t("Don't Save");
		dont_save.addEventListener('click', () => {
			this.POP.hide(false);
			this.leave();
		});
		ok.parentNode.insertBefore(dont_save, ok);
	}

	async leave() {
		const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
		//a new window can be opened only right after the click, so before anything is awaited
		if (standalone) {
			window.open(QUIT_URL, '_blank', 'noopener');
		}
		//do not show the browser's own "leave site" question, the user has just decided
		window.minipaint_quitting = true;
		//nothing may save the documents again or offer them after the restart
		const documents = app.GUI && app.GUI.GUI_documents;
		if (documents) {
			clearTimeout(documents.autosave_timer);
			documents.busy = true;
		}
		try {
			await clear_session();
		}
		catch {
			//the stored session is only a convenience
		}
		if (!standalone) {
			//the tab leaves the editor, nothing stays open
			window.location.href = QUIT_URL;
			return;
		}
		//installed application: the project page is already open in the browser, close this window
		window.close();
		setTimeout(() => window.location.reload(), 150);
	}

}

export default Help_quit_class;
