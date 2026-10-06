import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Helper_class from './../libs/helpers.js';
import Base_gui_class from './../core/base-gui.js';
import { average_color, sample_radius } from './../libs/color-sampling.js';

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
		var _this = this;
		if (config.TOOL.name != _this.name)
			return;
		_this.mousedown(event);
	}

	dragMove(event) {
		var _this = this;
		if (config.TOOL.name != _this.name)
			return;
		_this.mousemove(event);
	}

	load() {
		var _this = this;

		//mouse events
		document.addEventListener('mousedown', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('mousemove', function (event) {
			_this.dragMove(event);
		});
		document.addEventListener('mouseup', function (event) {
			var mouse = _this.get_mouse_info(event);
			if (config.TOOL.name != _this.name || mouse.click_valid == false)
				return;
			_this.copy_color_to_clipboard();
		});

		// collect touch events
		document.addEventListener('touchstart', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('touchmove', function (event) {
			_this.dragMove(event);
		});
	}

	mousedown(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}
		this.to_background = Boolean(e.altKey);

		this.pick_color(mouse);
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false) {
			return;
		}
		this.to_background = Boolean(e.altKey);

		this.pick_color(mouse);
	}

	pick_color(mouse) {
		var params = this.getParams();

		//get canvas from layer
		if (params.global == false) {
			//active layer
			var canvas = this.Base_layers.convert_layer_to_canvas(config.layer.id, null, false);
			var ctx = canvas.getContext("2d");
		}
		else {
			//global
			var canvas = document.createElement('canvas');
			var ctx = canvas.getContext("2d");
			canvas.width = config.WIDTH;
			canvas.height = config.HEIGHT;
			this.Base_layers.convert_layers_to_canvas(ctx, null, false);
		}
		//find color - a point or the average of a square area (sample size)
		var sample = params.sample && params.sample.value !== undefined ? params.sample.value : params.sample;
		var radius = sample_radius(sample);
		var c;
		if (radius == 0) {
			c = ctx.getImageData(mouse.x, mouse.y, 1, 1).data;
		}
		else {
			var x0 = Math.max(0, Math.floor(mouse.x) - radius);
			var y0 = Math.max(0, Math.floor(mouse.y) - radius);
			var area = ctx.getImageData(x0, y0, radius * 2 + 1, radius * 2 + 1);
			c = average_color(area, Math.floor(mouse.x) - x0, Math.floor(mouse.y) - y0, radius);
		}
		var hex = this.Helper.rgbToHex(c[0], c[1], c[2]);

		const newColorDefinition = { hex };
		if (c[3] > 0) {
			//set alpha
			newColorDefinition.a = c[3];
		}
		if (this.to_background) {
			//Alt + click sets the background color (as in Photoshop)
			config.COLOR_BG = hex;
			var swatch = document.querySelector('.fgbg .bg_swatch');
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
