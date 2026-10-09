import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import { measure, format_measure } from './../libs/measure.js';

/**
 * Measure tool - drag a line, the width, height, length and angle are shown in the status bar
 */
class Measure_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'measure';
		this.from = null;
		this.to = null;
	}

	load() {
		this.default_events();
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false) {
			return;
		}
		this.from = {x: mouse.x, y: mouse.y};
		this.to = {x: mouse.x, y: mouse.y};
		this.show();
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || this.from == null) {
			return;
		}
		this.to = {x: mouse.x, y: mouse.y};
		this.show();
	}

	mouseup() {
		//the line stays visible until the next click
	}

	show() {
		const item = document.getElementById('status_measure_item');
		if (item) {
			item.hidden = false;
			document.getElementById('status_measure').textContent = format_measure(measure(this.from, this.to));
		}
		config.need_render = true;
	}

	on_leave() {
		this.from = this.to = null;
		const item = document.getElementById('status_measure_item');
		if (item) {
			item.hidden = true;
		}
		config.need_render = true;
		return [];
	}

	render_overlay(ctx) {
		if (this.from == null || this.to == null) {
			return;
		}
		const scale = 1 / (config.ZOOM || 1);
		ctx.save();
		ctx.lineWidth = 3 * scale;
		ctx.strokeStyle = '#000000';
		ctx.beginPath();
		ctx.moveTo(this.from.x, this.from.y);
		ctx.lineTo(this.to.x, this.to.y);
		ctx.stroke();
		ctx.lineWidth = scale;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		[this.from, this.to].forEach((point) => {
			ctx.beginPath();
			ctx.arc(point.x, point.y, 3 * scale, 0, Math.PI * 2);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.lineWidth = scale;
			ctx.strokeStyle = '#000000';
			ctx.stroke();
		});
		ctx.restore();
	}
}

export default Measure_class;
