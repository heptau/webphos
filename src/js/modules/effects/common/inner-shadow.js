import config from '../../../config.js';
import Effects_layer_style_class from '../abstract/layer-style.js';
import { safe_color, clamp_int } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Inner Shadow - shadow cast inside the non transparent part of an image layer.
 * Drawn after the layer image (render_post) from a cached canvas.
 */
class Effects_innerShadow_class extends Effects_layer_style_class {

	inner_shadow(filter_id) {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const filter = this.Base_layers.find_filter_by_id(filter_id, 'inner-shadow');

		const params = [
			{name: "x", title: "Offset X:", value: filter.x ??= 5, range: [-50, 50]},
			{name: "y", title: "Offset Y:", value: filter.y ??= 5, range: [-50, 50]},
			{name: "blur", title: "Radius:", value: filter.blur ??= 8, range: [0, 50]},
			{name: "opacity", title: "Opacity:", value: filter.opacity ??= 75, range: [1, 100]},
			{name: "color", title: "Color:", value: filter.color ??= "#000000", type: 'color'},
		];
		this.show_dialog('inner-shadow', params, filter_id);
	}

	/**
	 * Canvas of the same size as the picture holding only the shadow that falls inside the picture.
	 * The picture is moved by the offset and subtracted from a color fill, so the shadow appears on the
	 * sides facing the light; a blur softens it. The result is clipped to the original picture.
	 *
	 * @param {CanvasImageSource} source
	 * @param {number} width
	 * @param {number} height
	 * @param {object} params x, y, blur, color
	 * @returns {HTMLCanvasElement}
	 */
	build_shadow(source, width, height, params) {
		width = Math.max(1, Math.round(width));
		height = Math.max(1, Math.round(height));
		const x = clamp_int(params.x, -100, 100, 0);
		const y = clamp_int(params.y, -100, 100, 0);
		const blur = clamp_int(params.blur, 0, 100, 0);
		const pad = blur * 3 + Math.max(Math.abs(x), Math.abs(y));

		//work area is larger, otherwise the blur would be cut off at the picture edges
		const work = document.createElement('canvas');
		work.width = width + pad * 2;
		work.height = height + pad * 2;
		const ctx = work.getContext('2d');
		ctx.fillStyle = safe_color(params.color);
		ctx.fillRect(0, 0, work.width, work.height);

		ctx.globalCompositeOperation = 'destination-out';
		ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
		ctx.drawImage(source, pad + x, pad + y, width, height);
		ctx.filter = 'none';

		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(source, pad, pad, width, height);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d').drawImage(work, -pad, -pad);
		return canvas;
	}

	draw_preview(ctx, source, x, y, width, height, params, ratio) {
		const scaled = {
			x: params.x * ratio,
			y: params.y * ratio,
			blur: params.blur * ratio,
			color: params.color,
		};
		ctx.drawImage(source, x, y, width, height);
		ctx.save();
		ctx.globalAlpha = clamp_int(params.opacity, 1, 100, 75) / 100;
		ctx.drawImage(this.build_shadow(source, width, height, scaled), x, y);
		ctx.restore();
	}

	demo(canvas_id, canvas_thumb) {
		const canvas = document.getElementById(canvas_id);
		const ctx = canvas.getContext("2d");
		const width = this.Effects_browser.preview_width - 20;
		const height = this.Effects_browser.preview_height - 20;

		ctx.drawImage(canvas_thumb, 10, 10, width, height);
		ctx.drawImage(this.build_shadow(canvas_thumb, width, height, {x: 4, y: 4, blur: 5, color: '#000000'}), 10, 10);
	}

	render_post(ctx, data, layer) {
		if (!layer || layer.type != 'image') {
			return;
		}
		const params = {x: data.params.x, y: data.params.y, blur: data.params.blur, color: safe_color(data.params.color)};
		const key = [params.x, params.y, params.blur, params.color].join('|');
		const shadow = this.cached(layer, key, (source) => this.build_shadow(source, layer.width, layer.height, params));

		const previous_filter = ctx.filter;
		ctx.filter = 'none';
		ctx.save();
		ctx.globalAlpha = ctx.globalAlpha * clamp_int(data.params.opacity, 1, 100, 75) / 100;
		this.transform_to_layer(ctx, layer);
		ctx.drawImage(shadow, -layer.width / 2, -layer.height / 2);
		ctx.restore();
		ctx.filter = previous_filter;
	}

}

export default Effects_innerShadow_class;
