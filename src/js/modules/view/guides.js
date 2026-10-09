import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import Base_layers_class from './../../core/base-layers.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Tools_settings_class from './../tools/settings.js';
import { t } from '../tools/translate.js';

class View_guides_class {


	constructor() {
		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Tools_settings = new Tools_settings_class();
		this.Helper = new Helper_class();
	}

	insert() {
		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		//convert units
		let position = 20;
		position = this.Helper.get_user_unit(position, units, resolution);

		const settings = {
			title: 'Insert guides',
			params: [
				{name: "type", title: "Type:", values: ["Vertical", "Horizontal"], value :"Vertical"},
				{name: "position", title: "Position:",  value: position},
			],
			on_finish: (params) => {
				this.insert_handler(params);
			},
		};
		this.POP.show(settings);
	}

	insert_handler(data){
		const type = data.type;
		let position = parseFloat(data.position);
		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		//convert units
		position = this.Helper.get_internal_unit(position, units, resolution);

		let x = null;
		let y = null;
		if(type == 'Vertical')
			x = position;
		if(type == 'Horizontal')
			y = position;

		//update
		config.guides.push({x, y});

		if(config.guides_enabled == false){
			//was disabled
			config.guides_enabled = true;
			this.Helper.setCookie('guides', 1);
			alertify.warning(t('Guides enabled.'));
		}

		config.need_render = true;
	}

	update(){
		let i, guide, value;
		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		const params = [];
		for(i in config.guides){
			guide = config.guides[i];

			//convert units
			value = guide.x;
			value = this.Helper.get_user_unit(value, units, resolution);

			if(guide.y === null) {
				params.push({name: i, title: "Vertical:", value});
			}
		}
		for(i in config.guides){
			guide = config.guides[i];

			//convert units
			value = guide.y;
			value = this.Helper.get_user_unit(value, units, resolution);

			if(guide.x === null) {
				params.push({name: i, title: "Horizontal:", value});
			}
		}

		const settings = {
			title: 'Update guides',
			params,
			on_finish: (params) => {
				this.update_handler(params);
			},
		};
		this.POP.show(settings);
	}

	update_handler(data){
		let i;
		const units = this.Tools_settings.get_setting('default_units');
		const resolution = this.Tools_settings.get_setting('resolution');

		//update
		for (i in data) {
			const key = parseInt(i);
			let value = parseFloat(data[i]);

			//convert units
			value = this.Helper.get_internal_unit(value, units, resolution);

			if (config.guides[key].x === null)
				config.guides[key].y = value;
			else
				config.guides[key].x = value;
		}

		//remove empty
		for (i = 0; i < config.guides.length; i++) {
			if(config.guides[i].x === 0 || config.guides[i].y === 0
				|| isNaN(config.guides[i].x) || isNaN( config.guides[i].y)){
				config.guides.splice(i, 1);
				i--;
			}
		}

		config.need_render = true;
	}

	/**
	 * View > Show / Hide Guides (Ctrl+;)
	 */
	toggle() {
		config.guides_enabled = !config.guides_enabled;
		this.Helper.setCookie('guides', config.guides_enabled ? 1 : 0);
		config.need_render = true;
	}

	/**
	 * View > Snap (Shift+Ctrl+;)
	 */
	toggle_snap() {
		const snap = !this.Tools_settings.get_setting('snap');
		this.Tools_settings.save_setting('snap', snap);
		config.SNAP = snap;
		alertify.warning(t(snap ? 'Snap enabled.' : 'Snap disabled.'));
	}

	remove() {
		config.guides = [];
		config.need_render = true;
	}

}

export default View_guides_class;
