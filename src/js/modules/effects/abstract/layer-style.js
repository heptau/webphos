import config from './../../../config.js';
import Effects_common_class from './css.js';
import Dialog_class from './../../../libs/popup.js';
import Effects_browser_class from './../browser.js';
import Base_layers_class from './../../../core/base-layers.js';

/**
 * Base of layer styles (stroke, inner shadow, color overlay...) that draw themselves instead of using a CSS filter.
 * A style implements:
 * - draw_preview(ctx, source, x, y, width, height, params, ratio) - draws the picture with the style into the dialog preview
 * - render_pre / render_post(ctx, filter, layer) - draws the style in the layer render (before / after the layer image)
 * - demo(canvas_id, canvas_thumb) - thumbnail for the effects browser
 * and a dialog opening method that calls show_dialog().
 */
class Effects_layer_style_class extends Effects_common_class {

	constructor() {
		super();
		this.POP = new Dialog_class();
		this.Effects_browser = new Effects_browser_class();
		this.Base_layers = new Base_layers_class();
		this.preview_padding = 20;
		this.caches = {}; //slot -> WeakMap(layer -> {source, key, canvas})
	}

	show_dialog(type, params, filter_id) {
		var _this = this;
		var padding = this.preview_padding;

		var settings = {
			title: this.Helper.ucfirst(type).replace(/-/g, ' '),
			preview: true,
			preview_padding: padding,
			effects: true,
			params: params,
			on_change: function (params, canvas_preview) {
				_this.params = params;
				var width = _this.POP.width_mini - padding * 2;
				var height = _this.POP.height_mini - padding * 2;
				canvas_preview.clearRect(0, 0, _this.POP.width_mini, _this.POP.height_mini);
				_this.draw_preview(canvas_preview, this.layer_active_small, padding, padding, width, height, params,
					_this.POP.width_mini / config.WIDTH);
			},
			on_finish: function (params) {
				_this.params = params;
				_this.save(params, type, filter_id);
			},
		};
		this.Base_layers.disable_filter(filter_id);
		this.POP.show(settings);
		this.Base_layers.disable_filter(null);
	}

	/**
	 * Returns the cached canvas of a layer or builds it (recomputed when the image, its size or the parameters change)
	 *
	 * @param {object} layer
	 * @param {string} key all parameters that change the result
	 * @param {function(CanvasImageSource): HTMLCanvasElement} build
	 * @param {string} [slot] a style that needs more than one canvas per layer uses a slot for each
	 */
	cached(layer, key, build, slot) {
		slot = slot || 'main';
		var cache = this.caches[slot] || (this.caches[slot] = new WeakMap());
		var source = layer.link_canvas != null ? layer.link_canvas : layer.link;
		var full_key = [layer.width, layer.height, key].join('|');
		var cached = cache.get(layer);
		if (cached && cached.source === source && cached.key === full_key) {
			return cached.canvas;
		}
		var canvas = build(source);
		cache.set(layer, {source: source, key: full_key, canvas: canvas});
		return canvas;
	}

	/**
	 * Moves the context to the layer's center and rotates it like the layer image is drawn
	 */
	transform_to_layer(ctx, layer) {
		ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
		ctx.rotate((layer.rotate * Math.PI) / 180);
	}

	render_pre(ctx, data, layer) {
		//styles override what they need
	}

	render_post(ctx, data, layer) {
		//styles override what they need
	}

}

export default Effects_layer_style_class;
