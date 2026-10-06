import config from '../../../config.js';
import Effects_layer_style_class from '../abstract/layer-style.js';
import { outline_alpha, inner_outline_alpha, parse_color, safe_color } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Stroke - outline along the edge of the non transparent part of an image layer, outside, inside or centered.
 * It is a live filter: the outside part is rendered behind the layer image (render_pre), the inside part on top
 * of it (render_post); both are cached, see libs/layer-styles.js for the outline computation.
 */
class Effects_stroke_class extends Effects_layer_style_class {

	stroke(filter_id) {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		var filter = this.Base_layers.find_filter_by_id(filter_id, 'stroke');

		var params = [
			{name: "size", title: "Size:", value: filter.size ??= 4, range: [1, 50]},
			{name: "position", title: "Position:", value: filter.position ??= 'outside', values: ['outside', 'inside', 'center']},
			{name: "color", title: "Color:", value: filter.color ??= "#ff0000", type: 'color'},
		];
		this.show_dialog('stroke', params, filter_id);
	}

	/**
	 * Widths of the outside and the inside part of the stroke for a position. The centered stroke splits its size.
	 *
	 * @param {number} size
	 * @param {string} position 'outside' (default), 'inside' or 'center'
	 * @returns {{outside: number, inside: number}}
	 */
	split_size(size, position) {
		size = Math.min(50, Math.max(1, parseInt(size) || 1));
		if (position === 'inside') {
			return {outside: 0, inside: size};
		}
		if (position === 'center') {
			return {outside: Math.ceil(size / 2), inside: Math.floor(size / 2)};
		}
		return {outside: size, inside: 0};
	}

	draw_preview(ctx, source, x, y, width, height, params, ratio) {
		var sizes = this.split_size(Math.max(1, Math.round(params.size * ratio)), params.position);
		if (sizes.outside > 0) {
			ctx.drawImage(this.build_outline(source, width, height, sizes.outside, params.color, 'outside'), x - sizes.outside, y - sizes.outside);
		}
		ctx.drawImage(source, x, y, width, height);
		if (sizes.inside > 0) {
			ctx.drawImage(this.build_outline(source, width, height, sizes.inside, params.color, 'inside'), x - sizes.inside, y - sizes.inside);
		}
	}

	/**
	 * Canvas with the outline of a picture, (width + 2 * size) x (height + 2 * size) pixels,
	 * the picture itself goes to [size, size] on it.
	 *
	 * @param {CanvasImageSource} source
	 * @param {number} width size of the picture on the result
	 * @param {number} height
	 * @param {number} size outline width in pixels
	 * @param {string} color hex color
	 * @param {string} [mode] 'outside' (drawn behind the picture, default) or 'inside' (drawn over the picture)
	 * @returns {HTMLCanvasElement}
	 */
	build_outline(source, width, height, size, color, mode) {
		width = Math.max(1, Math.round(width));
		height = Math.max(1, Math.round(height));
		var out_width = width + size * 2;
		var out_height = height + size * 2;

		var canvas = document.createElement('canvas');
		canvas.width = out_width;
		canvas.height = out_height;
		var ctx = canvas.getContext('2d', {willReadFrequently: true});
		ctx.drawImage(source, size, size, width, height);
		var image = ctx.getImageData(0, 0, out_width, out_height);

		var alpha = new Uint8ClampedArray(out_width * out_height);
		for (var p = 0; p < alpha.length; p++) {
			alpha[p] = image.data[p * 4 + 3];
		}
		var inside = mode === 'inside';
		var coverage = inside ? inner_outline_alpha(alpha, out_width, out_height, size) : outline_alpha(alpha, out_width, out_height, size);
		var rgb = parse_color(color);
		for (var q = 0; q < coverage.length; q++) {
			image.data[q * 4] = rgb[0];
			image.data[q * 4 + 1] = rgb[1];
			image.data[q * 4 + 2] = rgb[2];
			//outside part only where the picture does not cover it (semi-transparent parts are not tinted),
			//inside part only where the picture is
			image.data[q * 4 + 3] = inside ? coverage[q] * alpha[q] / 255 : coverage[q] * (255 - alpha[q]) / 255;
		}
		ctx.putImageData(image, 0, 0);
		return canvas;
	}

	/**
	 * Cached outline of a layer
	 */
	get_outline(layer, size, color, mode) {
		return this.cached(layer, size + '|' + color + '|' + mode,
			(source) => this.build_outline(source, layer.width, layer.height, size, color, mode), mode);
	}

	demo(canvas_id, canvas_thumb) {
		var canvas = document.getElementById(canvas_id);
		var ctx = canvas.getContext("2d");
		var width = this.Effects_browser.preview_width - 20;
		var height = this.Effects_browser.preview_height - 20;

		ctx.drawImage(this.build_outline(canvas_thumb, width - 8, height - 8, 4, '#ff0000'), 6, 6);
		ctx.drawImage(canvas_thumb, 10, 10, width - 8, height - 8);
	}

	render_pre(ctx, data, layer) {
		this.render_part(ctx, data, layer, 'outside');
	}

	render_post(ctx, data, layer) {
		this.render_part(ctx, data, layer, 'inside');
	}

	/**
	 * @param {string} mode 'outside' is drawn before the layer image, 'inside' after it
	 */
	render_part(ctx, data, layer, mode) {
		if (!layer || layer.type != 'image') {
			return;
		}
		var sizes = this.split_size(data.params.size, data.params.position);
		var size = sizes[mode];
		if (size <= 0) {
			return;
		}
		var outline = this.get_outline(layer, size, safe_color(data.params.color), mode);

		var previous_filter = ctx.filter;
		ctx.filter = 'none';
		ctx.save();
		this.transform_to_layer(ctx, layer);
		ctx.drawImage(outline, -layer.width / 2 - size, -layer.height / 2 - size);
		ctx.restore();
		ctx.filter = previous_filter;
	}

}

export default Effects_stroke_class;
