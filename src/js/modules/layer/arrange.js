import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { reverse_steps } from './../../libs/layer-order.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Reverse Layer Order, Delete Hidden Layers
 */
class Layer_arrange_class {

	reverse_order() {
		var layers = config.layers.concat().sort((a, b) => a.order - b.order);
		if (layers.length < 2) {
			alertify.warning(t('There is only one layer.'));
			return;
		}
		var actions = reverse_steps(layers.map((layer) => layer.id)).map(
			(id) => new app.Actions.Reorder_layer_action(id, 1)
		);
		return app.State.do_action(
			new app.Actions.Bundle_action('reverse_layers', 'Reverse Layer Order', actions)
		);
	}

	delete_hidden() {
		var hidden = config.layers.filter((layer) => layer.visible === false);
		if (hidden.length == 0) {
			alertify.warning(t('There are no hidden layers.'));
			return;
		}
		if (hidden.length == config.layers.length) {
			alertify.error(t('At least one layer must stay visible.'));
			return;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('delete_hidden_layers', 'Delete Hidden Layers',
				hidden.map((layer) => new app.Actions.Delete_layer_action(layer.id))
			)
		);
	}
}

export default Layer_arrange_class;
