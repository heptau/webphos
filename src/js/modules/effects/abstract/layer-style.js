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
		const padding = this.preview_padding;

		const settings = {
			title: this.Helper.ucfirst(type).replace(/-/g, ' '),
			preview: true,
			preview_padding: padding,
			effects: true,
			params,
			on_change: (params, canvas_preview) => {
				this.params = params;
				const width = this.POP.width_mini - padding * 2;
				const height = this.POP.height_mini - padding * 2;
				canvas_preview.clearRect(0, 0, this.POP.width_mini, this.POP.height_mini);
				this.draw_preview(canvas_preview, this.POP.layer_active_small, padding, padding, width, height, params,
					this.POP.width_mini / config.WIDTH);
			},
			on_finish: (params) => {
				this.params = params;
				this.save(params, type, filter_id);
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
		const cache = this.caches[slot] || (this.caches[slot] = new WeakMap());
		const source = layer.link_canvas != null ? layer.link_canvas : layer.link;
		const full_key = [layer.width, layer.height, key].join('|');
		const cached = cache.get(layer);
		if (cached && cached.source === source && cached.key === full_key) {
			return cached.canvas;
		}
		const canvas = build(source);
		cache.set(layer, {source, key: full_key, canvas});
		return canvas;
	}

	/**
	 * Moves the context to the layer's center and rotates it like the layer image is drawn
	 */
	transform_to_layer(ctx, layer) {
		ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
		ctx.rotate((layer.rotate * Math.PI) / 180);
	}

	render_pre() {
		//styles override what they need
	}

	render_post() {
		//styles override what they need
	}

}

export default Effects_layer_style_class;
