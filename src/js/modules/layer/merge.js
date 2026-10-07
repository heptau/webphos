import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Base_layers_class from './../../core/base-layers.js';
import { adjust_image, mix_adjusted } from './../../libs/adjustment-layers.js';
import { is_default as blend_if_is_default } from './../../libs/blend-if.js';
import { effective_alpha } from './../../libs/layer-groups.js';
import { t } from '../tools/translate.js';

class Layer_merge_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
	}

	merge() {
		if (this.Base_layers.find_previous(config.layer.id) == null) {
			alertify.error(t('There are no layers behind.'));
			return false;
		}

		//create tmp canvas
		var canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		var ctx = canvas.getContext("2d");

		//first layer
		var previous_layer = this.Base_layers.find_previous(config.layer.id);
		var previous_id = previous_layer.id;
		if (previous_layer.type == 'adjustment') {
			alertify.error(t('Merge Down needs a picture layer below.'));
			return false;
		}
		ctx.globalAlpha = effective_alpha(previous_layer);
		ctx.globalCompositeOperation = previous_layer.composition;
		this.Base_layers.render_object(ctx, previous_layer);

		//second layer
		var current_id = config.layer.id;
		var current_order = config.layer.order;
		if (config.layer.type == 'adjustment') {
			//the adjustment is applied to the layer below (the layer mask is not used)
			var original = ctx.getImageData(0, 0, canvas.width, canvas.height);
			var adjusted = adjust_image(original, config.layer.params.adjustment, config.layer.params.settings);
			mix_adjusted(original, adjusted, config.layer.opacity / 100, null);
			ctx.putImageData(new ImageData(adjusted.data, adjusted.width, adjusted.height), 0, 0);
		}
		else if (config.layer.blend_if && blend_if_is_default(config.layer.blend_if) == false) {
			//Blend If looks at the layer below, which is the one it is merged with
			ctx.globalAlpha = effective_alpha(config.layer);
			ctx.globalCompositeOperation = config.layer.composition;
			this.Base_layers.render_blend_if(ctx, config.layer, [previous_layer], null);
		}
		else {
			ctx.globalAlpha = effective_alpha(config.layer);
			ctx.globalCompositeOperation = config.layer.composition;
			this.Base_layers.render_object(ctx, config.layer);
		}

		//create requested layer
		var params = [];
		params.type = 'image';
		params.name = config.layer.name + ' + merged';
		params.order = current_order;
		params.data = canvas.toDataURL("image/png");
		app.State.do_action(
			new app.Actions.Bundle_action('merge_layers', 'Merge Layers', [
				new app.Actions.Insert_layer_action(params),
				new app.Actions.Delete_layer_action(current_id),
				new app.Actions.Delete_layer_action(previous_id)
			])
		);

		//free canvas data
		canvas.width = 1;
		canvas.height = 1;
	}

}

export default Layer_merge_class;