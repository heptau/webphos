import app from './../app.js';
import config from './../config.js';
import { blocks_update } from '../libs/layer-lock.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';
import { Base_action } from './base.js';

export class Update_layer_action extends Base_action {
	/**
	 * Updates an existing layer with the provided settings
	 * WARNING: If passing objects or arrays into settings, make sure these are new or cloned objects, and not a modified existing object!
	 *
	 * @param {string} layer_id
	 * @param {object} settings
	 */
	constructor(layer_id, settings) {
		super('update_layer', 'Update Layer');
		this.layer_id = layer_id;
		this.settings = settings;
		this.reference_layer = null;
		this.old_settings = {};
	}

	async do() {
		super.do();
		this.reference_layer = app.Layers.get_layer(this.layer_id);
		if (!this.reference_layer) {
			throw new Error('Aborted - layer with specified id doesn\'t exist');
		}
		if (blocks_update(this.reference_layer, this.settings)) {
			alertify.error(t('Layer is locked.'));
			this.reference_layer = null;
			throw new Error('Aborted - layer is locked');
		}
		for (const i in this.settings) {
			if (i == 'id')
				continue;
			if (i == 'order')
				continue;
			this.old_settings[i] = this.reference_layer[i];
			this.reference_layer[i] = this.settings[i];
		}
		if (this.reference_layer.type === 'text') {
			this.reference_layer._needs_update_data = true;
		}
		if (this.settings.params || this.settings.width || this.settings.height) {
			config.need_render_changed_params = true;
		}
		if ('mask' in this.settings || 'mask_enabled' in this.settings || 'locked' in this.settings || 'group' in this.settings || 'group_opacity' in this.settings || 'group_props' in this.settings || 'link_id' in this.settings) {
			app.GUI.GUI_layers.render_layers(); //the layer list shows the layer mask
		}
		config.need_render = true;
	}

	async undo() {
		super.undo();
		if (this.reference_layer) {
			for (const i in this.old_settings) {
				this.reference_layer[i] = this.old_settings[i];
			}
			if (this.reference_layer.type === 'text') {
				this.reference_layer._needs_update_data = true;
			}
			if (this.old_settings.params || this.old_settings.width || this.old_settings.height) {
				config.need_render_changed_params = true;
			}
			if ('mask' in this.old_settings || 'mask_enabled' in this.old_settings || 'locked' in this.old_settings || 'group' in this.old_settings || 'group_opacity' in this.old_settings || 'group_props' in this.old_settings || 'link_id' in this.old_settings) {
				app.GUI.GUI_layers.render_layers();
			}
			this.old_settings = {};
		}
		this.reference_layer = null;
		config.need_render = true;
	}

	free() {
		this.settings = null;
		this.old_settings = null;
		this.reference_layer = null;
	}
}
