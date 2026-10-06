import app from './../../app.js';
import config from './../../config.js';
import { is_unit } from './../../libs/units.js';
import semver_compare from './../../../../node_modules/semver-compare/';

/**
 * loads json files, includes migrations for old versions
 *
 * @author ViliusL
 */
class File_open_json_class {

	constructor(owner) {
		this.owner = owner;
	}

	async load_json(data) {
		var json;
		if(typeof data == 'string')
			json = JSON.parse(data);
		else
			json = data;
		if (json.info.version == undefined) {
			json.info.version = "3.0.0";
		}

		//migration
		if(semver_compare(json.info.version, '4.0.0') < 0) {
			//convert from v3 to v4
			for (var i in json.layers) {
				//layers data
				json.layers[i].id = (parseInt(i) + 1);
				json.layers[i].opacity = json.layers[i].opacity * 100 || 100;
				json.layers[i].type = "image";
				json.layers[i].width = json.info.width;
				json.layers[i].height = json.info.height;
				json.layers[i].visible = (json.layers[i].visible == true); //convert to boolean
				delete json.layers[i].title;
			}
			json.data = [];
			for (var i in json.image_data) {
				//image data
				var new_id = null;
				for (var j in json.layers) {
					if (json.layers[j].name == json.image_data[i].name) {
						new_id = json.layers[j].id;
					}
				}
				if (new_id == null)
					continue;
				json.data.push(
					{
						id: new_id,
						data: json.image_data[i].data,
					}
				);
			}
		}
		if(semver_compare(json.info.version, '4.5.0') < 0) {
			//migrate "rectangle", "circle" and "line" types to "shape"
			for (var i in json.layers) {
				var old_type = json.layers[i].type;

				if(old_type == 'line' && json.layers[i].params.type.value == "Arrow"){
					//migrate line (type=arrow) to arrow.
					json.layers[i].type = 'arrow';
					delete json.layers[i].params.type;
					json.layers[i].render_function = ["arrow", "render"];
				}
				if(old_type == 'rectangle' || old_type == 'circle'){
					//migrate params
					json.layers[i].params.border_size = json.layers[i].params.size;
					delete json.layers[i].params.size;

					if(json.layers[i].params.fill == true) {
						json.layers[i].params.border = false;
					}
					else{
						json.layers[i].params.border = true;
					}
					json.layers[i].params.border_color = json.layers[i].color;
					json.layers[i].params.fill_color = json.layers[i].color;

					json.layers[i].color = null;
				}
				if(old_type == 'circle'){
					//rename circle to ellipse
					json.layers[i].type = 'ellipse';
					json.layers[i].render_function = ["ellipse", "render"];
				}
			}
		}
		if(semver_compare(json.info.version, '4.8.0') < 0) {
			//migrate "borders" layer to rectangle
			for (var i in json.layers) {
				var old_type = json.layers[i].type;

				if(old_type == 'borders'){
					json.layers[i].type = 'rectangle';
					json.layers[i].name += ' (legacy)';
					json.layers[i].params = {
						radius: 0,
						fill: false,
						square: false,
						border_size: json.layers[i].params.size,
						border: true,
						border_color: json.layers[i].color,
						fill_color: "#000000",
					};
					json.layers[i].render_function = ["rectangle", "render"];
				}
			}
		}
		if(semver_compare(json.info.version, '4.11.0') < 0) {
			//migrate star and star24 objects
			for (var i in json.layers) {
				var old_type = json.layers[i].type;

				if(old_type == 'star' && typeof json.layers[i].params.corners == "undefined"){
					json.layers[i].params.corners = 5;
					json.layers[i].params.inner_radius = 40;
					json.layers[i].render_function = ["star", "render"];
				}
				else if(old_type == 'star24'){
					json.layers[i].type = 'star';
					json.layers[i].params.corners = 24;
					json.layers[i].params.inner_radius = 80;
					json.layers[i].render_function = ["star", "render"];
				}
			}
		}

		const actions = [];

		//reset zoom
		await this.owner.Base_gui.GUI_preview.zoom(100); //reset zoom

		//set attributes
		actions.push(
			new app.Actions.Refresh_action_attributes_action('undo'),
			new app.Actions.Prepare_canvas_action('undo'),
			new app.Actions.Update_config_action({
				ZOOM: 1,
				WIDTH: parseInt(json.info.width),
				HEIGHT: parseInt(json.info.height),
				RESOLUTION: json.info.resolution > 0 ? json.info.resolution : null,
				UNITS: is_unit(json.info.units) ? json.info.units : null,
				user_fonts: json.user_fonts || {}
			}),
			new app.Actions.Reset_layers_action(),
			new app.Actions.Prepare_canvas_action('do'),
			new app.Actions.Refresh_action_attributes_action('do')
		);

		var max_id_order = 0;
		for (var i in json.layers) {
			var value = json.layers[i];

			if(value.id > max_id_order)
				max_id_order = value.id;
			if(typeof value.order != 'undefined' && value.order > max_id_order)
				max_id_order = value.order;

			if (value.type == 'image') {
				//add image data
				value.link = null;
				for (var j in json.data) {
					if (json.data[j].id == value.id) {
						value.data = json.data[j].data;
					}
				}
			}
			actions.push(
				new app.Actions.Insert_layer_action(value, false)
			);
		}
		if (json.info.layer_active != undefined) {
			actions.push(
				new app.Actions.Select_layer_action(json.info.layer_active, true)
			);
		}
		if (json.info.guides != undefined) {
			config.guides = json.info.guides;
		}
		actions.push(
			new app.Actions.Set_object_property_action(this.owner.Base_layers, 'auto_increment', max_id_order + 1),
			new app.Actions.Update_config_action({
				WIDTH: parseInt(json.info.width),
				HEIGHT: parseInt(json.info.height),
				RESOLUTION: json.info.resolution > 0 ? json.info.resolution : null,
				UNITS: is_unit(json.info.units) ? json.info.units : null,
			}),
			new app.Actions.Prepare_canvas_action('do')
		);
		await app.State.do_action(
			new app.Actions.Bundle_action('open_json_file', 'Open JSON File', actions)
		);
	}

}

// internal sub-module of file/open - not an app module, must not be auto-registered
File_open_json_class.auto_register = false;

export default File_open_json_class;
