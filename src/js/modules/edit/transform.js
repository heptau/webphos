import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Dialog_class from './../../libs/popup.js';
import { apply_transform, last_transform } from './../../libs/transform-repeat.js';
import { quad_for, quad_bounds, warp_to_quad } from './../../libs/perspective.js';
import Edit_distort_session_class from './distort_session.js';
import { t } from '../tools/translate.js';

const MAX_SIDE = 8192;

/**
 * Edit > Free Transform (Ctrl+T) - the selection tool shows handles to move, scale and rotate the active layer
 * Edit > Transform Again (Shift+Ctrl+T) - the last move, scale or rotation is repeated on the active layer
 */
class Edit_transform_class {

	free_transform() {
		return app.State.do_action(new app.Actions.Activate_tool_action('select'));
	}

	/**
	 * Edit > Skew / Perspective / Distort - with the mouse (the numbers are in the dialogs below)
	 */
	skew() {
		new Edit_distort_session_class().start('skew');
	}

	perspective() {
		new Edit_distort_session_class().start('perspective');
	}

	distort() {
		new Edit_distort_session_class().start('distort');
	}

	skew_numbers() {
		this.distort_dialog('skew', 'Skew', [
			{name: "horizontal", title: "Horizontal angle:", value: 0, range: [-80, 80], step: 0.5},
			{name: "vertical", title: "Vertical angle:", value: 0, range: [-80, 80], step: 0.5},
		]);
	}

	perspective_numbers() {
		this.distort_dialog('perspective', 'Perspective', [
			{name: "horizontal", title: "Horizontal:", value: 0, range: [-100, 100]},
			{name: "vertical", title: "Vertical:", value: 0, range: [-100, 100]},
		]);
	}

	distort_numbers() {
		var layer = config.layer;
		var w = layer ? Math.round(layer.width) : 100;
		var h = layer ? Math.round(layer.height) : 100;
		var corner = (key, name) => [
			{name: key + '_x', title: name + " X:", value: 0, range: [-w, w]},
			{name: key + '_y', title: name + " Y:", value: 0, range: [-h, h]},
		];
		this.distort_dialog('distort', 'Distort', [].concat(
			corner('tl', 'Top left'), corner('tr', 'Top right'), corner('br', 'Bottom right'), corner('bl', 'Bottom left')
		));
	}

	/**
	 * Skew, Perspective and Distort of the picture of the active layer: the rectangle of the picture goes onto another
	 * four-cornered shape. The result shows while the dialog is open (on a smaller copy, so it is quick); OK makes it
	 * in the full size. The layer stays a picture layer.
	 *
	 * @param {'skew'|'perspective'|'distort'} mode
	 * @param {string} title
	 * @param {object[]} params dialog parameters
	 */
	distort_dialog(mode, title, params) {
		var layer = config.layer;
		if (layer == null || layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		if (layer.rotate) {
			alertify.error(t('This does not work on a rotated layer. Turn it back to 0° first.'));
			return;
		}
		if (layer.mask) {
			alertify.error(t('Apply or delete the layer mask first.'));
			return;
		}
		var w = Math.max(1, Math.round(layer.width));
		var h = Math.max(1, Math.round(layer.height));

		//the picture as it is shown on the canvas (also when the layer was stretched)
		var full = document.createElement('canvas');
		full.width = w;
		full.height = h;
		full.getContext('2d').drawImage(layer.link, 0, 0, w, h);

		//a smaller copy for the preview
		var scale = Math.min(1, 500 / Math.max(w, h));
		var small = document.createElement('canvas');
		small.width = Math.max(1, Math.round(w * scale));
		small.height = Math.max(1, Math.round(h * scale));
		small.getContext('2d').drawImage(full, 0, 0, small.width, small.height);
		var small_image = small.getContext('2d').getImageData(0, 0, small.width, small.height);

		var saved = {x: layer.x, y: layer.y, width: layer.width, height: layer.height, link_canvas: layer.link_canvas};
		var restore = () => {
			layer.x = saved.x;
			layer.y = saved.y;
			layer.width = saved.width;
			layer.height = saved.height;
			if (saved.link_canvas) {
				layer.link_canvas = saved.link_canvas;
			}
			else {
				delete layer.link_canvas;
			}
			config.need_render = true;
		};

		new Dialog_class().show({
			title: title,
			params: params,
			on_change: (values) => {
				var quad = quad_for(mode, values, w, h);
				var result = warp_to_quad(small_image, quad.map((c) => [c[0] * scale, c[1] * scale]));
				if (result == null) {
					return;
				}
				var canvas = document.createElement('canvas');
				canvas.width = result.image.width;
				canvas.height = result.image.height;
				canvas.getContext('2d').putImageData(new ImageData(result.image.data, canvas.width, canvas.height), 0, 0);
				layer.link_canvas = canvas;
				layer.x = saved.x + result.x / scale;
				layer.y = saved.y + result.y / scale;
				layer.width = canvas.width / scale;
				layer.height = canvas.height / scale;
				config.need_render = true;
			},
			on_finish: (values) => {
				restore();
				var quad = quad_for(mode, values, w, h);
				var bounds = quad_bounds(quad);
				if (bounds.width > MAX_SIDE || bounds.height > MAX_SIDE) {
					alertify.error(t('The result would be too big.'));
					return;
				}
				var result = warp_to_quad(full.getContext('2d').getImageData(0, 0, w, h), quad);
				if (result == null) {
					alertify.error(t('The corners make a shape that folds over itself.'));
					return;
				}
				var canvas = document.createElement('canvas');
				canvas.width = result.image.width;
				canvas.height = result.image.height;
				canvas.getContext('2d').putImageData(new ImageData(result.image.data, canvas.width, canvas.height), 0, 0);
				return app.State.do_action(
					new app.Actions.Bundle_action('distort_layer', title, [
						new app.Actions.Update_layer_image_action(canvas, layer.id),
						new app.Actions.Update_layer_action(layer.id, {
							x: Math.round(saved.x + result.x),
							y: Math.round(saved.y + result.y),
							width: canvas.width,
							height: canvas.height,
							width_original: canvas.width,
							height_original: canvas.height,
						}),
					])
				);
			},
			on_cancel: restore,
		});
	}

	transform_again() {
		var change = last_transform();
		var layer = config.layer;
		if (change == null) {
			alertify.warning(t('There is no transformation to repeat.'));
			return;
		}
		if (layer == null || layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}
		if (layer.rotate === null && change.rotate != 0) {
			alertify.error(t('Rotate is not supported on this type of object. Convert to raster?'));
			return;
		}
		var settings = apply_transform(layer, change);
		if (layer.rotate === null) {
			delete settings.rotate;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action('transform_again', 'Transform Again', [
				new app.Actions.Update_layer_action(layer.id, settings),
			])
		);
	}
}

export default Edit_transform_class;
