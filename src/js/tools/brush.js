import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import { stabilize } from './../libs/stabilizer.js';
import { stroke_scale, is_stretched } from './../libs/stroke-scale.js';
import { load_stored_tip } from './../libs/brush-tip.js';
import { symmetry_transforms } from './../libs/symmetry.js';
import { stamps_along } from './../libs/brush-tip.js';
import { has_dynamics, apply_dynamics } from './../libs/brush-dynamics.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

class Brush_class extends Base_tools_class {

	constructor() {
		super();
		this.Base_layers = new Base_layers_class();
		this.name = 'brush';
		this.layer = {};
		this.params_hash = false;
		this.pressure_supported = false;
		this.pointer_pressure = 0; // has range [0 - 1]
		this.max_speed = 20;
		this.power = 2; //how speed affects size
		this.event_links = [];
		this.data_index = 0;
	}

	load() {
		let is_touch = false;

		//the tip defined in an earlier session
		if (!config.brush_tip) {
			config.brush_tip = load_stored_tip();
		}

		//pointer events
		document.addEventListener('pointerdown', (event) => {
			this.pointerdown(event);
		});
		document.addEventListener('pointermove', (event) => {
			this.pointermove(event);
		});

		//mouse events
		document.addEventListener('mousedown', (event) => {
			if(is_touch)
				return;
			this.dragStart(event);
		});
		document.addEventListener('mousemove', (event) => {
			if(is_touch)
				return;
			this.dragMove(event);
		});
		document.addEventListener('mouseup', (event) => {
			if(is_touch)
				return;
			this.dragEnd(event);
		});

		// collect touch events
		document.addEventListener('touchstart', (event) => {
			is_touch = true;
			this.dragStart(event);
		});
		document.addEventListener('touchmove', (event) => {
			this.dragMove(event);
		});
		document.addEventListener('touchend', (event) => {
			this.dragEnd(event);
		});
	}

	pointerdown(e) {
		// Devices that don't actually support pen pressure can give 0.5 as a false reading.
		// It is highly unlikely a real pen will read exactly 0.5 at the start of a stroke.
		if (e.pressure && e.pressure !== 0 && e.pressure !== 0.5 && e.pressure <= 1) {
			this.pressure_supported = true;
			this.pointer_pressure = e.pressure;
		} else {
			this.pressure_supported = false;
		}
	}

	pointermove(e) {
		// Pressure of exactly 1 seems to be an input error, sometimes I see it when lifting the pen
		// off the screen when pressure reading should be near 0.
		if (this.pressure_supported && e.pressure < 1) {
			this.pointer_pressure = e.pressure;
		}
	}

	dragStart(event) {
		if (config.TOOL.name != this.name)
			return;
		this.click_counter++;

		const mouse = this.get_mouse_info(event);
		if (mouse.is_drag == false)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		let events = [];
		if (event.changedTouches) {
			events = event.changedTouches;
		}
		else{
			events.push(event);
		}
		for(let i = 0; i < events.length; i++){
			let identifier = null;
			if(typeof events[i].identifier != "undefined") {
				identifier = events[i].identifier;
			}

			this.event_links.push({
				identifier,
				index: this.data_index,
			});

			this.mousedown_action(events[i], this.data_index, identifier);

			this.data_index++;
		}
	}

	dragMove(event) {
		let mouse;
		if (config.TOOL.name != this.name)
			return;

		if (typeof event.changedTouches == "undefined") {
			//mouse cursor
			mouse = this.get_mouse_info(event);
			const params = this.getParams();
			this.show_mouse_cursor(mouse.x, mouse.y, params.size, 'circle');
		}

		mouse = this.get_mouse_info(event);
		if (mouse.is_drag == false)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		let events = [];
		if (event.changedTouches) {
			events = event.changedTouches;
		}
		else{
			events.push(event);
		}
		for(let i = 0; i < events.length; i++){
			let identifier = null;
			if(typeof events[i].identifier != "undefined") {
				identifier = events[i].identifier;
			}

			for(let j = 0; i < this.event_links.length; j++){
				if(this.event_links[j].identifier == identifier){
					//found link
					this.mousemove_action(events[i], this.event_links[j].index);
					break;
				}
			}
		}
	}

	dragEnd(event) {
		if (config.TOOL.name != this.name)
			return;

		const mouse = this.get_mouse_info(event);
		if (mouse.click_valid == false) {
			return;
		}

		let events = [];
		if (event.changedTouches) {
			events = event.changedTouches;
		}
		else{
			events.push(event);
		}
		for(let i = 0; i < events.length; i++){
			let identifier = null;
			if(typeof events[i].identifier != "undefined") {
				//unlink
				identifier = events[i].identifier;
			}

			for(let j = 0; i < this.event_links.length; j++){
				if(this.event_links[j].identifier == identifier){
					this.event_links.splice(j, 1);
					break;
				}
			}

			this.mouseup_action(events[i]);
		}
	}

	mousedown_action(e, index, event_identifier) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false)
			return;

		const params_hash = this.get_params_hash();

		if (config.layer.type != this.name || params_hash != this.params_hash || is_stretched(config.layer)) {
			//register new object - current layer is not ours, params changed or the layer was stretched with the handles
			this.layer = {
				type: this.name,
				data: [[]],
				params: Object.assign(this.clone(this.getParams()), {symmetry_center: [config.WIDTH / 2, config.HEIGHT / 2]}, this.tip_params()),
				status: 'draft',
				render_function: [this.name, 'render'],
				x: 0,
				y: 0,
				width: config.WIDTH,
				height: config.HEIGHT,
				hide_selection_if_active: true,
				rotate: null,
				is_vector: true,
				color: config.COLOR
			};
			app.State.do_action(
				new app.Actions.Bundle_action('new_brush_layer', 'New Brush Layer', [
					new app.Actions.Insert_layer_action(this.layer)
				])
			);
			this.params_hash = params_hash;

			//reset event links index
			this.data_index = 0;
			index = 0;
			this.event_links = [];
			this.event_links.push({
				identifier: event_identifier,
				index: this.data_index,
			});
		}
		else {
			const new_data = JSON.parse(JSON.stringify(config.layer.data));
			new_data.push([]);
			app.State.do_action(
				new app.Actions.Bundle_action('update_brush_layer', 'Update Brush Layer', [
					new app.Actions.Update_layer_action(config.layer.id, {
						data: new_data
					})
				])
			);
		}

		//in case of undo, recalculate index
		for(let i = index; i >= 0; i--){
			if(typeof config.layer.data[index] != "undefined"){
				break;
			}
			index--;
		}

		const current_group = config.layer.data[index];
		const params = this.getParams();

		//detect line size
		const size = params.size;
		let new_size = size;

		if (params.pressure == true) {
			if (this.pressure_supported) {
				new_size = size * this.pointer_pressure * 2;
			}
			else {
				new_size = size + size / this.max_speed * mouse.speed_average * this.power;
				new_size = Math.max(new_size, size / 4);
				new_size = Math.round(new_size);
			}
		}

		const mouse_coords = this.get_mouse_coordinates_from_event(e);
		const mouse_x = mouse_coords.x;
		const mouse_y = mouse_coords.y;

		//the stabilizer follows the stroke from its first point
		this.smooth_last = {x: mouse_x, y: mouse_y};

		current_group.push([mouse_x - config.layer.x, mouse_y - config.layer.y, new_size]);
		this.Base_layers.render();
	}

	mousemove_action(e, index) {
		const mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		//in case of undo, recalculate index
		for(let i = index; i >= 0; i--){
			if(typeof config.layer.data[index] != "undefined"){
				break;
			}
			index--;
		}

		const params = this.getParams();
		const current_group = config.layer.data[index];

		//detect line size
		const size = params.size;
		let new_size = size;

		if (params.pressure == true) {
			if (this.pressure_supported) {
				new_size = size * this.pointer_pressure * 2;
			}
			else {
				new_size = size + size / this.max_speed * mouse.speed_average * this.power;
				new_size = Math.max(new_size, size / 4);
				new_size = Math.round(new_size);
			}
		}

		const mouse_coords = this.get_mouse_coordinates_from_event(e);
		//stabilizer: the brush follows the mouse with a lag
		const smooth = stabilize(this.smooth_last, mouse_coords, params.stabilizer);
		this.smooth_last = smooth;
		const mouse_x = smooth.x;
		const mouse_y = smooth.y;

		current_group.push([mouse_x - config.layer.x, mouse_y - config.layer.y, new_size]);
		config.layer.status = 'draft';
		this.Base_layers.render();
	}

	mouseup_action(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			config.layer.status = null;
			return;
		}

		config.layer.status = null;

		this.check_dimensions();
		this.Base_layers.render();
	}

	/**
	 * the custom tip (when it is chosen in the tool options) goes with the layer, so it stays as it was drawn
	 */
	tip_params() {
		const tip = this.getParams().tip;
		const custom = (tip && tip.value !== undefined ? tip.value : tip) == 'Custom';
		if (custom && config.brush_tip) {
			return {tip_data: config.brush_tip.data};
		}
		if (custom) {
			alertify.warning(t('Define a brush tip first (Edit > Define Brush).'));
		}
		return {};
	}

	/**
	 * a new brush tip (Edit > Define Brush) starts a new brush layer
	 */
	get_params_hash() {
		return `${super.get_params_hash()  }|${  config.brush_tip ? config.brush_tip.id : ''}`;
	}

	/**
	 * The custom tip as a canvas filled with the color of the brush (white mask of the tip is painted over).
	 * The picture loads in the background; until it is there, null is returned and the layer is drawn again when it loads.
	 *
	 * @param {string} data_url PNG data URL of the tip mask
	 * @param {string} color
	 * @returns {HTMLCanvasElement|null}
	 */
	get_tip_canvas(data_url, color) {
		if (typeof data_url != 'string' || data_url.indexOf('data:image/png;base64,') != 0) {
			return null;
		}
		this.tip_images = this.tip_images || {};
		this.tip_canvases = this.tip_canvases || {};
		const key = `${data_url.length  }:${data_url.slice(-64)}|${  color}`;
		if (this.tip_canvases[key]) {
			return this.tip_canvases[key];
		}
		let image = this.tip_images[data_url];
		if (!image) {
			image = new Image();
			image.onload = () => {
				config.need_render = true;
			};
			image.src = data_url;
			this.tip_images[data_url] = image;
		}
		if (!image.complete || !image.naturalWidth) {
			return null;
		}
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(image, 0, 0);
		ctx.globalCompositeOperation = 'source-in';
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		this.tip_canvases[key] = canvas;
		return canvas;
	}

	/**
	 * Strokes made of stamps: of the custom tip, or of round dots when only the dynamics are on.
	 * One stamp every "spacing" percent of the brush size; the dynamics change every stamp a little.
	 */
	render_tip_strokes(ctx, data, params, tip) {
		const spacing = Math.max(1, params.size * (parseFloat(params.spacing) || 25) / 100);
		const longest = tip ? Math.max(tip.width, tip.height) : 1;
		const base_alpha = ctx.globalAlpha;
		for (let k = 0; k < data.length; k++) {
			const stamps = stamps_along(data[k], spacing).map((stamp) => {
				return {x: stamp.x, y: stamp.y, size: params.pressure == true ? stamp.size : params.size};
			});
			apply_dynamics(stamps, params, k).forEach((stamp) => {
				ctx.save();
				ctx.globalAlpha = base_alpha * stamp.alpha;
				ctx.translate(stamp.x, stamp.y);
				ctx.rotate(stamp.angle);
				if (tip) {
					const w = stamp.size * tip.width / longest;
					const h = stamp.size * tip.height / longest;
					ctx.drawImage(tip, -w / 2, -h / 2, w, h);
				}
				else {
					ctx.beginPath();
					ctx.arc(0, 0, stamp.size / 2, 0, 2 * Math.PI, false);
					ctx.fill();
				}
				ctx.restore();
			});
		}
	}

	render(ctx, layer) {
		if (layer.data.length == 0)
			return;

		const params = layer.params;
		const size = params.size;

		//set styles
		ctx.save();
		ctx.fillStyle = layer.color;
		ctx.strokeStyle = layer.color;
		ctx.lineWidth = params.size;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		ctx.translate(layer.x, layer.y);
		//the layer was resized with the handles: the strokes are stretched with it
		const scale = stroke_scale(layer);
		ctx.scale(scale.x, scale.y);

		//check for legacy format
		const data = this.check_legacy_format(layer.data);

		//symmetry: the same strokes again, mirrored or turned around the center of the picture
		const center = params.symmetry_center || [config.WIDTH / 2, config.HEIGHT / 2];
		const center_x = (center[0] - layer.x) / scale.x;
		const center_y = (center[1] - layer.y) / scale.y;
		symmetry_transforms(params.symmetry).forEach((transform, index) => {
			if (index == 0) {
				this.render_strokes(ctx, data, params, size);
				return;
			}
			ctx.save();
			ctx.translate(center_x, center_y);
			ctx.rotate(transform.angle);
			ctx.scale(transform.sx, transform.sy);
			ctx.translate(-center_x, -center_y);
			this.render_strokes(ctx, data, params, size);
			ctx.restore();
		});

		ctx.translate(-layer.x, -layer.y);
		ctx.restore();
	}

	render_strokes(ctx, data, params, size) {
		if (params.tip_data || has_dynamics(params)) {
			//custom brush tip and / or dynamics - until the tip is loaded nothing is drawn
			let tip = null;
			if (params.tip_data) {
				tip = this.get_tip_canvas(params.tip_data, ctx.fillStyle);
				if (tip == null) {
					return;
				}
			}
			this.render_tip_strokes(ctx, data, params, tip);
			return;
		}
		const n = data.length;
		for (let k = 0; k < n; k++) {
			const group_data = data[k]; //data from mouse down till mouse release
			const group_n = group_data.length;

			if (params.pressure == false) {
				//stabilized lines method does not support multiple line sizes
				this.render_stabilized(ctx, group_data);
			}
			else {
				if (group_data[0]) {
					ctx.beginPath();
					ctx.moveTo(group_data[0][0], group_data[0][1]);
					for (let i = 1; i < group_n; i++) {
						if (group_data[i] === null) {
							//break
							ctx.beginPath();
						}
						else {
							//line

							ctx.lineWidth = group_data[i][2];

							if (group_data[i - 1] == null && group_data[i + 1] == null) {
								//exception - point
								ctx.arc(group_data[i][0], group_data[i][1], size / 2, 0, 2 * Math.PI, false);
								ctx.fill();
							}
							else if (group_data[i - 1] != null) {
								//lines
								ctx.lineWidth = group_data[i][2];
								ctx.beginPath();
								ctx.moveTo(group_data[i - 1][0], group_data[i - 1][1]);
								ctx.lineTo(group_data[i][0], group_data[i][1]);
								ctx.stroke();
							}
						}
					}
					if (group_data[1] == null) {
						//point
						ctx.beginPath();
						ctx.arc(group_data[0][0], group_data[0][1], size / 2, 0, 2 * Math.PI, false);
						ctx.fill();
					}
				}
			}
		}
	}

	/**
	 * draw stabilized lines
	 * author: Manoj Verma
	 * source: https://stackoverflow.com/questions/7891740/drawing-smooth-lines-with-canvas/44810470#44810470
	 *
	 * @param ctx
	 * @param queue
	 */
	render_stabilized(ctx, queue) {
		let i;
		const data = JSON.parse(JSON.stringify(queue));
		const n = data.length;

		if (data.length == 1) {
			//point
			const point = data[0];
			ctx.beginPath();
			ctx.arc(point[0], point[1], point[2] / 2, 0, 2 * Math.PI, false);
			ctx.fill();
			return;
		}
		else if (data.length <= 5) {
			//not enough points yet

			for (i = 1; i < n; i++) {
				ctx.beginPath();
				ctx.moveTo(data[i - 1][0], data[i - 1][1]);
				ctx.lineTo(data[i][0], data[i][1]);
				ctx.stroke();
			}
			return;
		}

		//fix for loose ending, so lets duplicate last point
		data.push([data[n - 1][0], data[n - 1][1]]);

		ctx.beginPath();
		ctx.moveTo(data[0][0], data[0][1]);

		//prepare
		const temp_data1 = [data[0]];
		let c, d;
		for (i = 1; i < data.length - 1;  i = i+1) {
			c = (data[i][0] + data[i + 1][0]) / 2;
			d = (data[i][1] + data[i + 1][1]) / 2;
			temp_data1.push([c, d]);
		}

		const temp_data2 = [temp_data1[0]];
		for (i = 1; i < temp_data1.length - 1;  i = i+1) {
			c = (temp_data1[i][0] + temp_data1[i + 1][0]) / 2;
			d = (temp_data1[i][1] + temp_data1[i + 1][1]) / 2;
			temp_data2.push([c, d]);
		}

		const temp_data = [temp_data2[0]];
		for (i = 1; i < temp_data2.length - 1;  i = i+1) {
			c = (temp_data2[i][0] + temp_data2[i + 1][0]) / 2;
			d = (temp_data2[i][1] + temp_data2[i + 1][1]) / 2;
			temp_data.push([c, d]);
		}

		//draw
		for (i = 1; i < temp_data.length - 2;  i = i+1) {
			c = (temp_data[i][0] + temp_data[i + 1][0]) / 2;
			d = (temp_data[i][1] + temp_data[i + 1][1]) / 2;
			ctx.quadraticCurveTo(temp_data[i][0], temp_data[i][1], c, d);
		}

		// For the last 2 points
		ctx.quadraticCurveTo(
			temp_data[i][0],
			temp_data[i][1],
			temp_data[i+1][0],
			temp_data[i+1][1]
		);
		ctx.stroke();
	}

	check_legacy_format(data) {
		//check for legacy format
		if(data.length > 0 && typeof data[0][0] == "number"){
			//convert
			const legacy = JSON.parse(JSON.stringify(data));
			data = [];
			data.push([]);
			let group_index = 0;
			for(const i in legacy){
				if(legacy[i] === null){
					data.push([]);
					group_index++;
				}
				else {
					data[group_index].push([legacy[i][0], legacy[i][1], legacy[i][2]]);
				}
			}
		}

		return data;
	}

	/**
	 * recalculate layer x, y, width and height values.
	 */
	check_dimensions() {
		let k, group_data, group_n, i;
		const data = JSON.parse(JSON.stringify(config.layer.data)); // Deep copy for history
		this.check_legacy_format(data);

		if(config.layer.data.length == 0 || data[0].length == 0)
			return;

		//find bounds
		let min_x = data[0][0][0];
		let min_y = data[0][0][1];
		let max_x = data[0][0][0];
		let max_y = data[0][0][1];

		const n = data.length;
		for (k = 0; k < n; k++) {
			group_data = data[k];
			group_n = group_data.length;

			for (i = 1; i < group_n; i++) {
				min_x = Math.min(min_x, group_data[i][0]);
				min_y = Math.min(min_y, group_data[i][1]);
				max_x = Math.max(max_x, group_data[i][0]);
				max_y = Math.max(max_y, group_data[i][1]);
			}
		}

		//move current data
		for (k = 0; k < n; k++) {
			group_data = data[k];
			group_n = group_data.length;

			for (i = 0; i < group_n; i++) {
				group_data[i][0] = group_data[i][0] - min_x;
				group_data[i][1] = group_data[i][1] - min_y;
			}
		}

		//change layers bounds
		app.State.do_action(
			new app.Actions.Update_layer_action(config.layer.id, {
				x: config.layer.x + min_x,
				y: config.layer.y + min_y,
				width: max_x - min_x,
				height: max_y - min_y,
				//the size of the strokes: the layer can be stretched with the handles and the strokes with it
				width_original: max_x - min_x,
				height_original: max_y - min_y,
				data
			}),
			{
				merge_with_history: ['new_brush_layer', 'update_brush_layer']
			}
		);
	}

}

export default Brush_class;
