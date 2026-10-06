import config from '../../../config.js';
import Effects_common_class from '../abstract/css.js';
import Dialog_class from '../../../libs/popup.js';
import Effects_browser_class from '../browser.js';
import Base_layers_class from './../../../core/base-layers.js';
import { glow_filter } from './../../../libs/layer-styles.js';
import alertify from './../../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../../tools/translate.js';

/**
 * Layer style Outer Glow - soft glow around the opaque part of the layer (live filter, see libs/layer-styles.js)
 */
class Effects_glow_class extends Effects_common_class {

	constructor() {
		super();
		this.POP = new Dialog_class();
		this.Effects_browser = new Effects_browser_class();
		this.Base_layers = new Base_layers_class();
		this.preview_padding = 20;
	}

	glow(filter_id) {
		if (config.layer.type == null) {
			alertify.error(t('Layer is empty.'));
			return;
		}

		var filter = this.Base_layers.find_filter_by_id(filter_id, 'glow');

		var params = [
			{name: "size", title: "Size:", value: filter.size ??= 12, range: [1, 100]},
			{name: "strength", title: "Strength:", value: filter.strength ??= 2, range: [1, 5]},
			{name: "color", title: "Color:", value: filter.color ??= "#ffee00", type: 'color'},
		];
		this.show_dialog('glow', params, filter_id);
	}

	css(params, type) {
		var size = params.size;
		if (type == 'preview') {
			size = Math.max(1, Math.round(size * this.POP.width_mini / config.WIDTH));
		}
		return glow_filter(size, params.strength, params.color);
	}

	preview(params, type) {
		return this.css(params, 'preview');
	}

	demo(canvas_id, canvas_thumb) {
		var canvas = document.getElementById(canvas_id);
		var ctx = canvas.getContext("2d");

		ctx.filter = glow_filter(5, 2, '#ffee00');
		ctx.drawImage(canvas_thumb,
			10, 10,
			this.Effects_browser.preview_width - 20, this.Effects_browser.preview_height - 20);
		ctx.filter = 'none';
	}

	render_pre(ctx, data) {
		var filter = this.css(data.params, 'save');

		if (ctx.filter == 'none') {
			ctx.filter = filter;
		}
		else {
			ctx.filter += ' ' + filter;
		}
	}

	render_post(ctx, data) {
		ctx.filter = 'none';
	}

}

export default Effects_glow_class;
