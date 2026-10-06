import app from './../../app.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Edit > Repeat Last Command - opens the last adjustment / effect again (with its dialog)
 */
class Edit_repeat_class {

	repeat_last() {
		var last = app.GUI.last_command;
		if (!last) {
			alertify.warning(t('There is nothing to repeat.'));
			return;
		}
		return app.GUI.run_target(last.target, last.parameter);
	}
}

export default Edit_repeat_class;
