import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { linked_with, link_changes, toggle_link_changes, unlink_changes } from './../../libs/layer-link.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Link Layers / Unlink Layer. Layers that are linked with the active layer move together with it
 * (Move tool and arrow keys). Shift+click on a layer in the Layers panel links / unlinks it with the active layer.
 */
class Layer_link_class {

	/**
	 * Layer > Link Layers - choose the layers that belong to the active layer
	 */
	link() {
		var active = config.layer;
		var others = config.layers.filter((layer) => layer.type != null && layer.id != active.id);
		if (active == null || active.type == null || others.length == 0) {
			alertify.warning(t('There is no other layer to link with.'));
			return;
		}
		var current = linked_with(config.layers, active).map((layer) => layer.id);
		new Dialog_class().show({
			title: 'Link Layers',
			params: others.map((layer) => ({
				name: 'layer_' + layer.id,
				title: layer.name,
				value: current.includes(layer.id),
			})),
			on_finish: (params) => {
				var chosen = others.filter((layer) => params['layer_' + layer.id] === true).map((layer) => layer.id);
				this.apply(link_changes(config.layers, active, chosen), 'Link Layers');
			},
		});
	}

	unlink() {
		var layer = config.layer;
		if (layer == null || layer.link_id == null) {
			alertify.warning(t('This layer is not linked.'));
			return;
		}
		this.apply(unlink_changes(config.layers, layer), 'Unlink Layer');
	}

	/**
	 * Shift+click in the Layers panel
	 */
	toggle_with_active(target_id) {
		this.apply(toggle_link_changes(config.layers, config.layer, parseInt(target_id, 10)), 'Link Layers');
	}

	apply(changes, name) {
		if (changes.length == 0) {
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('link_layers', name, changes.map(
				(change) => new app.Actions.Update_layer_action(change.id, {link_id: change.link_id})
			))
		);
	}
}

export default Layer_link_class;
