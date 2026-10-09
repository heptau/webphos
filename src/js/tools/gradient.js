import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Helper_class from './../libs/helpers.js';
import {
	gradient_type, layer_stops, reverse_stops, reflect_stops, stop_css, diamond_pixels, CENTERED_TYPES,
} from './../libs/gradient.js';

class Gradient_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'gradient';
		this.layer = {};
		this.diamond_cache = null;
	}

	/**
	 * the toolbar colors are the simple gradient, so they take over from a gradient made in the editor
	 */
	on_params_update(data) {
		if (data && ['color_1', 'color_2', 'alpha'].includes(data.key)) {
			config.gradient_stops = null;
		}
	}

	load() {
		this.default_events();
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		const params = this.getParams();
		if (mouse.click_valid == false)
			return;

		const type = gradient_type(params);
		let name = this.name;
		let is_vector = false;
		if (CENTERED_TYPES.includes(type)) {
			name = `${type  } gradient`;
			is_vector = true;
		}
		const layer_params = this.clone(this.getParams());
		if (Array.isArray(config.gradient_stops)) {
			//made in the Gradient Editor
			layer_params.stops = this.clone(config.gradient_stops);
		}

		//register new object - current layer is not ours or params changed
		this.layer = {
			type: this.name,
			name: `${this.Helper.ucfirst(name)  } #${  this.Base_layers.auto_increment}`,
			params: layer_params,
			status: 'draft',
			render_function: [this.name, 'render'],
			x: mouse.x,
			y: mouse.y,
			rotate: null,
			is_vector,
			color: null,
			data: {
				center_x: mouse.x,
				center_y: mouse.y,
			},
		};
		app.State.do_action(
			new app.Actions.Bundle_action('new_gradient_layer', 'New Gradient Layer', [
				new app.Actions.Insert_layer_action(this.layer)
			])
		);
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		const params = this.getParams();
		if (mouse.is_drag == false)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		const width = mouse.x - this.layer.x;
		const height = mouse.y - this.layer.y;

		if (CENTERED_TYPES.includes(gradient_type(params))) {
			config.layer.x = this.layer.data.center_x - width;
			config.layer.y = this.layer.data.center_y - height;
			config.layer.width = width * 2;
			config.layer.height = height * 2;
		}
		else {
			config.layer.width = width;
			config.layer.height = height;
		}

		this.Base_layers.render();
	}

	mouseup(e) {
		const mouse = this.get_mouse_info(e);
		const params = this.getParams();
		if (mouse.click_valid == false) {
			config.layer.status = null;
			return;
		}

		const width = mouse.x - this.layer.x;
		const height = mouse.y - this.layer.y;

		if (width == 0 && height == 0) {
			//same coordinates - cancel
			app.State.scrap_last_action();
			return;
		}

		let new_settings;
		if (CENTERED_TYPES.includes(gradient_type(params))) {
			new_settings = {
				x: this.layer.data.center_x - width,
				y: this.layer.data.center_y - height,
				width: width * 2,
				height: height * 2
			}
		}
		else {
			new_settings = {
				width,
				height
			}
		}
		new_settings.status = null;

		app.State.do_action(
			new app.Actions.Update_layer_action(config.layer.id, new_settings),
			{ merge_with_history: 'new_gradient_layer' }
		);

		this.Base_layers.render();
	}

	render(ctx, layer) {
		if (layer.width == 0 && layer.height == 0)
			return;

		const params = layer.params;
		const type = gradient_type(params);
		let stops = layer_stops(params);
		if (params.reverse === true || (params.reverse && params.reverse.value === true)) {
			stops = reverse_stops(stops);
		}
		const power = Math.min(99, parseFloat(params.radial_power) || 0);

		const start_x = layer.x;
		const start_y = layer.y;
		const end_x = layer.x + layer.width - 1;
		const end_y = layer.y + layer.height - 1;
		let gradient = null;

		if (type == 'Linear') {
			gradient = ctx.createLinearGradient(start_x, start_y, end_x, end_y);
		}
		else if (type == 'Reflected') {
			//the drag goes from the middle to one edge, the other side is the mirror image
			gradient = ctx.createLinearGradient(start_x - layer.width, start_y - layer.height, start_x + layer.width, start_y + layer.height);
			stops = reflect_stops(stops);
		}
		else if (type == 'Angular') {
			if (typeof ctx.createConicGradient != 'function') {
				return;
			}
			gradient = ctx.createConicGradient(Math.atan2(layer.height, layer.width), start_x, start_y);
		}
		else if (type == 'Radial') {
			const distance = Math.hypot(layer.width, layer.height);
			const center_x = layer.x + Math.round(layer.width / 2);
			const center_y = layer.y + Math.round(layer.height / 2);
			gradient = ctx.createRadialGradient(center_x, center_y, distance * power / 100, center_x, center_y, distance);
		}
		else {
			this.render_diamond(ctx, layer, stops, power);
			return;
		}

		stops.forEach((stop) => {
			gradient.addColorStop(stop.pos, stop_css(stop));
		});
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
	}

	/**
	 * Diamond gradient: computed on a smaller picture (it is smooth) and stretched over the canvas
	 */
	render_diamond(ctx, layer, stops, power) {
		const scale = Math.min(1, 512 / Math.max(config.WIDTH, config.HEIGHT));
		const width = Math.max(1, Math.round(config.WIDTH * scale));
		const height = Math.max(1, Math.round(config.HEIGHT * scale));
		const key = JSON.stringify([width, height, layer.x, layer.y, layer.width, layer.height, power, stops]);
		if (this.diamond_cache == null || this.diamond_cache.key != key) {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const image = new ImageData(width, height);
			image.data.set(diamond_pixels(width, height, {
				x: (layer.x + layer.width / 2) * scale,
				y: (layer.y + layer.height / 2) * scale,
				rx: layer.width / 2 * scale,
				ry: layer.height / 2 * scale,
				inner: power / 100,
			}, stops));
			canvas.getContext('2d').putImageData(image, 0, 0);
			this.diamond_cache = {key, canvas};
		}
		ctx.drawImage(this.diamond_cache.canvas, 0, 0, config.WIDTH, config.HEIGHT);
	}

}
export default Gradient_class;
