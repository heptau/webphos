import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Layer Style > Copy / Paste Layer Style - the live effects of a layer (shadow, glow, stroke, overlays...)
 * go to another layer; the effects the other layer had are replaced.
 */
class Layer_style_class {

	constructor() {
		this.copied = null;
	}

	copy() {
		const layer = config.layer;
		if (layer == null || !layer.filters || layer.filters.length == 0) {
			alertify.warning(t('This layer has no layer style.'));
			return;
		}
		this.copied = JSON.parse(JSON.stringify(layer.filters.map((filter) => ({name: filter.name, params: filter.params}))));
		alertify.success(t('Layer style copied.'));
	}

	paste() {
		const layer = config.layer;
		if (this.copied == null) {
			alertify.warning(t('Copy a layer style first.'));
			return;
		}
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		const actions = (layer.filters || []).map((filter) => new app.Actions.Delete_layer_filter_action(layer.id, filter.id));
		this.copied.forEach((filter) => {
			actions.push(new app.Actions.Add_layer_filter_action(layer.id, filter.name, JSON.parse(JSON.stringify(filter.params))));
		});
		return app.State.do_action(
			new app.Actions.Bundle_action('paste_layer_style', 'Paste Layer Style', actions)
		);
	}
}

export default Layer_style_class;
