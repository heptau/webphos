import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Helper_class from './../libs/helpers.js';
import Base_gui_class from './../core/base-gui.js';
import { average_color, sample_radius } from './../libs/color-sampling.js';

//painting tools where Alt + click temporarily works as the eyedropper (as in Photoshop and GIMP)
const ALT_PICK_TOOLS = ['brush', 'pencil', 'fill', 'gradient'];

class Pick_color_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.Base_gui = new Base_gui_class();
		this.ctx = ctx;
		this.name = 'pick_color';
	}

	dragStart(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousedown(event);
	}

	dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);
	}

	load() {

		//Alt + click in a painting tool picks the color under the cursor instead of painting
		document.addEventListener('mousedown', (event) => {
			if (event.altKey != true || event.button != 0 || ALT_PICK_TOOLS.includes(config.TOOL.name) == false) {
				return;
			}
			//this runs before the main mouse tracking, so the position comes straight from the event
			if (event.target.id != 'canvas_minipaint' && event.target.id != 'main_wrapper') {
				return;
			}
			const mouse = this.get_mouse_coordinates_from_event(event);
			this.to_background = false; //the foreground color, even when the last pick went to the background
			this.pick_color_at(mouse, {global: true, radius: 0});
			event.stopImmediatePropagation();
			event.preventDefault();
		}, true);

		//mouse events
		document.addEventListener('mousedown', (event) => {
			this.dragStart(event);
		});
		document.addEventListener('mousemove', (event) => {
			this.dragMove(event);
		});
		document.addEventListener('mouseup', (event) => {
			const mouse = this.get_mouse_info(event);
			if (config.TOOL.name != this.name || mouse.click_valid == false)
				return;
			this.copy_color_to_clipboard();
		});

		// collect touch events
		document.addEventListener('touchstart', (event) => {
			this.dragStart(event);
		});
		document.addEventListener('touchmove', (event) => {
			this.dragMove(event);
		});
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}
		this.to_background = Boolean(e.altKey);

		this.pick_color(mouse);
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false) {
			return;
		}
		this.to_background = Boolean(e.altKey);

		this.pick_color(mouse);
	}

	pick_color(mouse) {
		const params = this.getParams();
		const sample = params.sample && params.sample.value !== undefined ? params.sample.value : params.sample;
		this.pick_color_at(mouse, {global: params.global, radius: sample_radius(sample)});
	}

	/**
	 * @param {object} mouse position in canvas coordinates
	 * @param {{global: boolean, radius: number}} options global = all layers, otherwise the active one;
	 *   radius = half of the sampled square (0 = one pixel)
	 */
	pick_color_at(mouse, options) {
		let canvas, ctx;
		const params = {global: options.global};
		const radius = options.radius;

		//get canvas from layer
		if (params.global == false) {
			//active layer
			canvas = this.Base_layers.convert_layer_to_canvas(config.layer.id, null, false);
			ctx = canvas.getContext("2d");
		}
		else {
			//global
			canvas = document.createElement('canvas');
			ctx = canvas.getContext("2d");
			canvas.width = config.WIDTH;
			canvas.height = config.HEIGHT;
			this.Base_layers.convert_layers_to_canvas(ctx, null, false);
		}
		//find color - a point or the average of a square area (sample size)
		let c;
		if (Number.isFinite(mouse.x) == false || Number.isFinite(mouse.y) == false) {
			return;
		}
		if (radius == 0) {
			c = ctx.getImageData(Math.floor(mouse.x), Math.floor(mouse.y), 1, 1).data;
		}
		else {
			const x0 = Math.max(0, Math.floor(mouse.x) - radius);
			const y0 = Math.max(0, Math.floor(mouse.y) - radius);
			const area = ctx.getImageData(x0, y0, radius * 2 + 1, radius * 2 + 1);
			c = average_color(area, Math.floor(mouse.x) - x0, Math.floor(mouse.y) - y0, radius);
		}
		const hex = this.Helper.rgbToHex(c[0], c[1], c[2]);

		const newColorDefinition = { hex };
		if (c[3] > 0) {
			//set alpha
			newColorDefinition.a = c[3];
		}
		if (this.to_background) {
			//Alt + click sets the background color (as in Photoshop)
			config.COLOR_BG = hex;
			const swatch = document.querySelector('.fgbg .bg_swatch');
			if (swatch) {
				swatch.value = hex;
			}
			this.Helper.setCookie('color_bg', hex);
			return;
		}
		this.Base_gui.GUI_colors.set_color(newColorDefinition);
	}

	copy_color_to_clipboard() {
		navigator.clipboard.writeText(config.COLOR);
	}

}

export default Pick_color_class;
