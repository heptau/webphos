import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { is_clipped, can_clip, CLIP_COMPOSITION } from './../../libs/clipping.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Create / Release Clipping Mask (Alt+Ctrl+G toggles). The active layer is shown only where the layer
 * below it has pixels. It is the "source-atop" blend of the layer, so the clipped layer has no other blend mode.
 */
class Layer_clipping_class {

	create() {
		var layer = config.layer;
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		if (is_clipped(layer)) {
			return;
		}
		if (can_clip(config.layers, layer.id) == false) {
			alertify.error(t('There is no layer below to clip to.'));
			return;
		}
		return this.set(layer, CLIP_COMPOSITION, 'Create Clipping Mask');
	}

	release() {
		var layer = config.layer;
		if (layer == null || is_clipped(layer) == false) {
			return;
		}
		return this.set(layer, 'source-over', 'Release Clipping Mask');
	}

	toggle() {
		return is_clipped(config.layer) ? this.release() : this.create();
	}

	set(layer, composition, name) {
		return app.State.do_action(
			new app.Actions.Bundle_action('layer_clipping', name, [
				new app.Actions.Update_layer_action(layer.id, {composition: composition}),
			])
		);
	}
}

export default Layer_clipping_class;
