import config from '../../../config.js';
import Effects_layer_style_class from '../abstract/layer-style.js';
import { safe_color, clamp_int } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Bevel & Emboss - light and dark rim along the edges inside the non transparent part of the layer,
 * so the shape looks raised. Drawn after the layer image (render_post) from a cached canvas.
 */
class Effects_bevel_class extends Effects_layer_style_class {

	bevel(filter_id) {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		var filter = this.Base_layers.find_filter_by_id(filter_id, 'bevel');

		var params = [
			{name: "size", title: "Size:", value: filter.size ??= 4, range: [1, 30]},
			{name: "soften", title: "Soften:", value: filter.soften ??= 2, range: [0, 20]},
			{name: "angle", title: "Light angle:", value: filter.angle ??= 135, range: [0, 360]},
			{name: "highlight", title: "Highlight:", value: filter.highlight ??= "#ffffff", type: 'color'},
			{name: "highlight_opacity", title: "Highlight opacity:", value: filter.highlight_opacity ??= 75, range: [0, 100]},
			{name: "shadow", title: "Shadow:", value: filter.shadow ??= "#000000", type: 'color'},
			{name: "shadow_opacity", title: "Shadow opacity:", value: filter.shadow_opacity ??= 75, range: [0, 100]},
		];
		this.show_dialog('bevel', params, filter_id);
	}

	/**
	 * Rim of the picture on one side: a color fill minus the picture moved by (dx, dy), blurred and clipped to the picture.
	 */
	build_rim(source, width, height, dx, dy, soften, color, opacity) {
		var pad = soften * 3 + Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) + 1;
		var work = document.createElement('canvas');
		work.width = width + pad * 2;
		work.height = height + pad * 2;
		var ctx = work.getContext('2d');
		ctx.fillStyle = safe_color(color);
		ctx.fillRect(0, 0, work.width, work.height);

		ctx.globalCompositeOperation = 'destination-out';
		ctx.filter = soften > 0 ? 'blur(' + soften + 'px)' : 'none';
		ctx.drawImage(source, pad + dx, pad + dy, width, height);
		ctx.filter = 'none';

		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(source, pad, pad, width, height);

		var rim = document.createElement('canvas');
		rim.width = width;
		rim.height = height;
		var rim_ctx = rim.getContext('2d');
		rim_ctx.globalAlpha = opacity / 100;
		rim_ctx.drawImage(work, -pad, -pad);
		return rim;
	}

	/**
	 * Canvas of the same size as the picture with the highlight (light side) and shadow (opposite side).
	 *
	 * @param {CanvasImageSource} source
	 * @param {number} width
	 * @param {number} height
	 * @param {object} params size, soften, angle, highlight, highlight_opacity, shadow, shadow_opacity
	 * @returns {HTMLCanvasElement}
	 */
	build_bevel(source, width, height, params) {
		width = Math.max(1, Math.round(width));
		height = Math.max(1, Math.round(height));
		var size = clamp_int(params.size, 1, 100, 4);
		var soften = clamp_int(params.soften, 0, 50, 2);
		var angle = clamp_int(params.angle, 0, 360, 135) * Math.PI / 180;
		//direction to the light; the picture moved away from it leaves a rim on the lit side
		var lx = Math.cos(angle);
		var ly = -Math.sin(angle);

		var canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');
		ctx.drawImage(this.build_rim(source, width, height, -lx * size, -ly * size, soften, params.highlight,
			clamp_int(params.highlight_opacity, 0, 100, 75)), 0, 0);
		ctx.drawImage(this.build_rim(source, width, height, lx * size, ly * size, soften, params.shadow,
			clamp_int(params.shadow_opacity, 0, 100, 75)), 0, 0);
		return canvas;
	}

	draw_preview(ctx, source, x, y, width, height, params, ratio) {
		var scaled = Object.assign({}, params, {
			size: Math.max(1, Math.round(params.size * ratio)),
			soften: Math.round(params.soften * ratio),
		});
		ctx.drawImage(source, x, y, width, height);
		ctx.drawImage(this.build_bevel(source, width, height, scaled), x, y);
	}

	demo(canvas_id, canvas_thumb) {
		var canvas = document.getElementById(canvas_id);
		var ctx = canvas.getContext("2d");
		var width = this.Effects_browser.preview_width - 20;
		var height = this.Effects_browser.preview_height - 20;

		ctx.drawImage(canvas_thumb, 10, 10, width, height);
		ctx.drawImage(this.build_bevel(canvas_thumb, width, height, {
			size: 3, soften: 1, angle: 135, highlight: '#ffffff', highlight_opacity: 75, shadow: '#000000', shadow_opacity: 75,
		}), 10, 10);
	}

	render_post(ctx, data, layer) {
		if (!layer || layer.type != 'image') {
			return;
		}
		var p = data.params;
		var key = [p.size, p.soften, p.angle, safe_color(p.highlight), p.highlight_opacity, safe_color(p.shadow), p.shadow_opacity].join('|');
		var rim = this.cached(layer, key, (source) => this.build_bevel(source, layer.width, layer.height, p));

		var previous_filter = ctx.filter;
		ctx.filter = 'none';
		ctx.save();
		this.transform_to_layer(ctx, layer);
		ctx.drawImage(rim, -layer.width / 2, -layer.height / 2);
		ctx.restore();
		ctx.filter = previous_filter;
	}

}

export default Effects_bevel_class;
