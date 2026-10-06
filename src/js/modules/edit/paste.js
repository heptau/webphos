import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Edit_paste_class {

	paste() {
		alertify.error(t('Use Ctrl+V keyboard shortcut to paste from Clipboard.'));
	}
}

export default Edit_paste_class;
