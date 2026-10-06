import app from './../../app.js';
import Edit_history_class from './../edit/history.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * View > Compare with Original - jumps back to the first state of the document and the next call
 * returns to where you were (the steps stay available as redo, nothing is lost).
 */
class View_compare_class {

	constructor() {
		this.History = new Edit_history_class();
		this.saved_index = null;
	}

	async compare() {
		var state = app.State;
		if (this.saved_index === null) {
			if (state.action_history_index == 0) {
				alertify.warning(t('There are no changes to compare.'));
				return;
			}
			this.saved_index = state.action_history_index;
			await this.History.go_to(0);
			alertify.message(t('Showing the original. Choose Compare with Original again to return.'), 4);
		}
		else {
			var index = this.saved_index;
			this.saved_index = null;
			//only when nothing was done in the meantime (a new action would have removed the redo steps)
			if (index <= state.action_history.length) {
				await this.History.go_to(index);
			}
		}
	}
}

export default View_compare_class;
