import config from '../../../config.js';
import Effects_layer_style_class from '../abstract/layer-style.js';
import { safe_color, clamp_int, blend_operation, BLEND_MODES } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Color Overlay - covers the non transparent part of an image layer with a color.
 * Drawn after the layer image (render_post) from a cached canvas.
 */
class Effects_colorOverlay_class extends Effects_layer_style_class {

	color_overlay(filter_id) {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		var filter = this.Base_layers.find_filter_by_id(filter_id, 'color-overlay');

		var params = [
			{name: "color", title: "Color:", value: filter.color ??= "#ff0000", type: 'color'},
			{name: "opacity", title: "Opacity:", value: filter.opacity ??= 50, range: [1, 100]},
			{name: "blend", title: "Blend mode:", value: filter.blend ??= 'normal', values: BLEND_MODES},
		];
		this.show_dialog('color-overlay', params, filter_id);
	}

	/**
	 * The picture filled with one color (transparent parts stay transparent)
	 *
	 * @param {CanvasImageSource} source
	 * @param {number} width
	 * @param {number} height
	 * @param {string} color hex color
	 * @returns {HTMLCanvasElement}
	 */
	build_overlay(source, width, height, color) {
		var canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width));
		canvas.height = Math.max(1, Math.round(height));
		var ctx = canvas.getContext('2d');
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		ctx.globalCompositeOperation = 'source-in';
		ctx.fillStyle = safe_color(color);
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return canvas;
	}

	draw_preview(ctx, source, x, y, width, height, params) {
		ctx.drawImage(source, x, y, width, height);
		ctx.save();
		ctx.globalAlpha = clamp_int(params.opacity, 1, 100, 50) / 100;
		ctx.globalCompositeOperation = blend_operation(params.blend) || ctx.globalCompositeOperation;
		ctx.drawImage(this.build_overlay(source, width, height, params.color), x, y);
		ctx.restore();
	}

	demo(canvas_id, canvas_thumb) {
		var canvas = document.getElementById(canvas_id);
		var ctx = canvas.getContext("2d");
		var width = this.Effects_browser.preview_width - 20;
		var height = this.Effects_browser.preview_height - 20;

		ctx.drawImage(canvas_thumb, 10, 10, width, height);
		ctx.globalAlpha = 0.5;
		ctx.drawImage(this.build_overlay(canvas_thumb, width, height, '#ff0000'), 10, 10);
		ctx.globalAlpha = 1;
	}

	render_post(ctx, data, layer) {
		if (!layer || layer.type != 'image') {
			return;
		}
		var color = safe_color(data.params.color);
		var overlay = this.cached(layer, color, (source) => this.build_overlay(source, layer.width, layer.height, color));

		var previous_filter = ctx.filter;
		ctx.filter = 'none';
		ctx.save();
		ctx.globalAlpha = ctx.globalAlpha * clamp_int(data.params.opacity, 1, 100, 50) / 100;
		ctx.globalCompositeOperation = blend_operation(data.params.blend) || ctx.globalCompositeOperation;
		this.transform_to_layer(ctx, layer);
		ctx.drawImage(overlay, -layer.width / 2, -layer.height / 2);
		ctx.restore();
		ctx.filter = previous_filter;
	}

}

export default Effects_colorOverlay_class;
