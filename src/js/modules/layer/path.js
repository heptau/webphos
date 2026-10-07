import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Edit_selection_class from './../edit/selection.js';
import { clean_anchors } from './../../libs/pen-path.js';
import { mask_outline } from './../../libs/mask-contour.js';
import { t } from '../tools/translate.js';

/**
 * Layer > Edit Path (also a double click on a path layer) puts the path of the layer back into the Pen tool.
 * Select > Make Path from Selection turns the selection into a path (corner points along its outline).
 */
class Layer_path_class {

	/**
	 * @param {object} path anchors in picture pixels, closed, layer_id (null = a new layer), size, mode
	 */
	async open_in_pen(path) {
		if (config.TOOL.name != 'pen') {
			await app.State.do_action(new app.Actions.Activate_tool_action('pen'));
		}
		app.GUI.GUI_tools.tools_modules.pen.object.load_path(path);
	}

	edit_path() {
		var layer = config.layer;
		if (layer == null || layer.type != 'pen') {
			alertify.error(t('Select a path layer first.'));
			return;
		}
		var scale_x = layer.width / (layer.width_original || layer.width);
		var scale_y = layer.height / (layer.height_original || layer.height);
		var point = (p) => (p ? {x: layer.x + p.x * scale_x, y: layer.y + p.y * scale_y} : null);
		var anchors = clean_anchors(layer.data).map((a) => ({x: layer.x + a.x * scale_x, y: layer.y + a.y * scale_y, in: point(a.in), out: point(a.out)}));
		var params = layer.params || {};
		return this.open_in_pen({anchors: anchors, closed: params.closed === true, layer_id: layer.id, size: params.size, mode: params.mode});
	}

	make_path_from_selection() {
		var current = new Edit_selection_class().get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		var outline = mask_outline(current.mask);
		if (outline.length < 3) {
			alertify.error(t('Empty selection'));
			return;
		}
		return this.open_in_pen({anchors: outline.map((p) => ({x: p.x, y: p.y, in: null, out: null})), closed: true, layer_id: null});
	}
}

export default Layer_path_class;
