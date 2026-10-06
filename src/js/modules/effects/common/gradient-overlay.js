import config from '../../../config.js';
import Effects_layer_style_class from '../abstract/layer-style.js';
import { safe_color, clamp_int, gradient_line, alpha_bounds, blend_operation, BLEND_MODES, parse_gradient_stops } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Gradient Overlay - covers the non transparent part of an image layer with a linear or radial gradient.
 * Drawn after the layer image (render_post) from a cached canvas.
 */
class Effects_gradientOverlay_class extends Effects_layer_style_class {

	gradient_overlay(filter_id) {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		var filter = this.Base_layers.find_filter_by_id(filter_id, 'gradient-overlay');

		var params = [
			{name: "style", title: "Style:", value: filter.style ??= 'linear', values: ['linear', 'radial']},
			{name: "color", title: "Start color:", value: filter.color ??= "#ff0000", type: 'color'},
			{name: "color2", title: "End color:", value: filter.color2 ??= "#0000ff", type: 'color'},
			{name: "angle", title: "Angle:", value: filter.angle ??= 90, range: [0, 360]},
			{name: "middle", title: "Use middle color:", value: filter.middle ??= false},
			{name: "color_mid", title: "Middle color:", value: filter.color_mid ??= "#ffff00", type: 'color'},
			{name: "stops", title: "Custom stops:", value: filter.stops ??= '', placeholder: '#ff0000 0, #ffff00 50, #0000ff 100'},
			{name: "opacity", title: "Opacity:", value: filter.opacity ??= 70, range: [1, 100]},
			{name: "blend", title: "Blend mode:", value: filter.blend ??= 'normal', values: BLEND_MODES},
			{name: "reverse", title: "Reverse:", value: filter.reverse ??= false},
		];
		this.show_dialog('gradient-overlay', params, filter_id);
	}

	/**
	 * The picture filled with a gradient (transparent parts stay transparent)
	 *
	 * @param {CanvasImageSource} source
	 * @param {number} width
	 * @param {number} height
	 * @param {object} params style ('linear'|'radial'), color, color2, angle, reverse
	 * @returns {HTMLCanvasElement}
	 */
	build_overlay(source, width, height, params) {
		var canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width));
		canvas.height = Math.max(1, Math.round(height));
		var ctx = canvas.getContext('2d');
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		ctx.globalCompositeOperation = 'source-in';

		var from = safe_color(params.color);
		var to = safe_color(params.color2);
		if (params.reverse === true || params.reverse === 'true') {
			[from, to] = [to, from];
		}

		//the gradient spans the visible content of the layer, not its transparent margins
		var bounds = alpha_bounds(ctx.getImageData(0, 0, canvas.width, canvas.height))
			|| {x: 0, y: 0, width: canvas.width, height: canvas.height};

		var gradient;
		if (params.style === 'radial') {
			var radius = Math.hypot(bounds.width, bounds.height) / 2;
			var cx = bounds.x + bounds.width / 2;
			var cy = bounds.y + bounds.height / 2;
			gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
		}
		else {
			var line = gradient_line(bounds.width, bounds.height, params.angle);
			gradient = ctx.createLinearGradient(bounds.x + line.x0, bounds.y + line.y0, bounds.x + line.x1, bounds.y + line.y1);
		}
		var custom = parse_gradient_stops(params.stops);
		if (custom) {
			//any number of colors, typed as text; Reverse mirrors the positions
			var reversed = params.reverse === true || params.reverse === 'true';
			custom.forEach(function (stop) {
				gradient.addColorStop(reversed ? 1 - stop.position : stop.position, stop.color);
			});
		}
		else {
			gradient.addColorStop(0, from);
			if (params.middle === true || params.middle === 'true') {
				gradient.addColorStop(0.5, safe_color(params.color_mid));
			}
			gradient.addColorStop(1, to);
		}
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return canvas;
	}

	draw_preview(ctx, source, x, y, width, height, params) {
		ctx.drawImage(source, x, y, width, height);
		ctx.save();
		ctx.globalAlpha = clamp_int(params.opacity, 1, 100, 70) / 100;
		ctx.globalCompositeOperation = blend_operation(params.blend) || ctx.globalCompositeOperation;
		ctx.drawImage(this.build_overlay(source, width, height, params), x, y);
		ctx.restore();
	}

	demo(canvas_id, canvas_thumb) {
		var canvas = document.getElementById(canvas_id);
		var ctx = canvas.getContext("2d");
		var width = this.Effects_browser.preview_width - 20;
		var height = this.Effects_browser.preview_height - 20;

		ctx.drawImage(canvas_thumb, 10, 10, width, height);
		ctx.globalAlpha = 0.7;
		ctx.drawImage(this.build_overlay(canvas_thumb, width, height, {style: 'linear', color: '#ff0000', color2: '#0000ff', angle: 90}), 10, 10);
		ctx.globalAlpha = 1;
	}

	render_post(ctx, data, layer) {
		if (!layer || layer.type != 'image') {
			return;
		}
		var params = {
			style: data.params.style,
			color: data.params.color,
			color2: data.params.color2,
			angle: data.params.angle,
			reverse: data.params.reverse,
			middle: data.params.middle,
			color_mid: data.params.color_mid,
			stops: data.params.stops,
		};
		var key = [params.style, params.color, params.color2, params.angle, params.reverse, params.middle, params.color_mid, params.stops].join('|');
		var overlay = this.cached(layer, key, (source) => this.build_overlay(source, layer.width, layer.height, params));

		var previous_filter = ctx.filter;
		ctx.filter = 'none';
		ctx.save();
		ctx.globalAlpha = ctx.globalAlpha * clamp_int(data.params.opacity, 1, 100, 70) / 100;
		ctx.globalCompositeOperation = blend_operation(data.params.blend) || ctx.globalCompositeOperation;
		this.transform_to_layer(ctx, layer);
		ctx.drawImage(overlay, -layer.width / 2, -layer.height / 2);
		ctx.restore();
		ctx.filter = previous_filter;
	}

}

export default Effects_gradientOverlay_class;
