import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { rotate_box, rotated_canvas_size } from './../../libs/canvas-rotate.js';
import { t } from '../tools/translate.js';

/**
 * Image > Canvas Rotation - rotates the whole image (all layers and the canvas) by 90/180 degrees.
 * Unrotated raster layers are rotated in pixels, other layers get their rotate attribute increased.
 */
class Image_canvas_rotate_class {

	right() {
		return this.rotate(90);
	}

	left() {
		return this.rotate(270);
	}

	rotate_180() {
		return this.rotate(180);
	}

	async rotate(angle) {
		var layers = config.layers.filter((layer) => layer.type != null);

		for (var layer of layers) {
			if (layer.rotate === null) {
				alertify.error(t('Rotate is not supported on this type of object. Convert to raster?') + ' (' + layer.name + ')');
				return;
			}
		}

		var old_width = config.WIDTH;
		var old_height = config.HEIGHT;
		var size = rotated_canvas_size(old_width, old_height, angle);
		var actions = [];

		for (layer of layers) {
			var box = rotate_box(layer, old_width, old_height, angle);

			if (layer.type == 'image' && !layer.rotate) {
				var canvas = this.rotate_pixels(layer, angle);
				actions.push(
					new app.Actions.Update_layer_image_action(canvas, layer.id),
					new app.Actions.Update_layer_action(layer.id, {
						x: box.x,
						y: box.y,
						width: box.width,
						height: box.height,
						width_original: canvas.width,
						height_original: canvas.height,
					})
				);
			}
			else {
				//layer rotates around its center, so only its center point has to follow the canvas
				var original_cx = layer.x + layer.width / 2;
				var original_cy = layer.y + layer.height / 2;
				var moved = rotate_box({x: original_cx, y: original_cy, width: 0, height: 0}, old_width, old_height, angle);
				actions.push(
					new app.Actions.Update_layer_action(layer.id, {
						x: Math.round(moved.x - layer.width / 2),
						y: Math.round(moved.y - layer.height / 2),
						rotate: ((layer.rotate || 0) + angle) % 360,
					})
				);
			}
		}

		actions.push(
			new app.Actions.Prepare_canvas_action('undo'),
			new app.Actions.Update_config_action({
				WIDTH: size.width,
				HEIGHT: size.height,
			}),
			new app.Actions.Prepare_canvas_action('do')
		);
		return app.State.do_action(
			new app.Actions.Bundle_action('canvas_rotate', 'Canvas Rotate', actions)
		);
	}

	/**
	 * Rotated copy of the layer's original image
	 */
	rotate_pixels(layer, angle) {
		var source = layer.link;
		var w = layer.width_original;
		var h = layer.height_original;
		var swap = angle == 90 || angle == 270;

		var canvas = document.createElement('canvas');
		canvas.width = swap ? h : w;
		canvas.height = swap ? w : h;
		var ctx = canvas.getContext('2d');
		if (angle == 90) {
			ctx.translate(h, 0);
		} else if (angle == 180) {
			ctx.translate(w, h);
		} else {
			ctx.translate(0, w);
		}
		ctx.rotate(angle * Math.PI / 180);
		ctx.drawImage(source, 0, 0);
		return canvas;
	}

}

export default Image_canvas_rotate_class;
