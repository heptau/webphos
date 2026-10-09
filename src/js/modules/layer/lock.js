import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Lock / Unlock - a locked layer cannot be painted on, filtered, moved, resized or rotated
 * (see libs/layer-lock.js for what the lock protects)
 */
class Layer_lock_class {

	toggle() {
		const layer = config.layer;
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_lock', layer.locked === true ? 'Unlock Layer' : 'Lock Layer', [
				new app.Actions.Update_layer_action(layer.id, {locked: layer.locked !== true}),
			])
		);
	}

}

export default Layer_lock_class;
