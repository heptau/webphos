import app from './../../../app.js';
import Dialog_class from './../../../libs/popup.js';
import Base_layers_class from './../../../core/base-layers.js';
import Helper_class from './../../../libs/helpers.js';

class Effects_common_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.params = null;
	}

	show_dialog(type, params, filter_id) {
		let title = this.Helper.ucfirst(type);
		title = title.replace(/-/g, ' ');

		let preview_padding = 0;
		if(typeof this.preview_padding != "undefined"){
			preview_padding = this.preview_padding;
		}

		const settings = {
			title,
			preview: true,
			preview_padding,
			effects: true,
			params,
			on_change: (params, canvas_preview) => {
				this.params = params;
				canvas_preview.filter = this.preview(params, type);
				canvas_preview.drawImage(this.POP.layer_active_small,
					preview_padding, preview_padding,
					this.POP.width_mini - preview_padding * 2, this.POP.height_mini - preview_padding * 2
				);
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

	save(params, type, filter_id) {
		return app.State.do_action(
			new app.Actions.Add_layer_filter_action(null, type, params, filter_id)
		);
	}

	preview(params, type) {
		if(type == 'shadow'){
			type = 'drop-shadow';
		}

		const value = this.convert_value(params.value, params, 'preview');
		return `${type  }(${value})`;
	}

	convert_value(value) {
		return value;
	}

}

export default Effects_common_class;
