import config from './../config.js';
import Base_mask_tool_class from './../core/base-mask-tool.js';
import Helper_class from './../libs/helpers.js';
import { polygon_mask } from './../libs/selection-mask.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * Lasso - freehand or polygonal selection (Photoshop style).
 * Shift adds to the current selection, Alt subtracts from it, Shift+Alt intersects.
 * The result is stored as a selection mask, see core/selection-mask-state.js.
 */
class Lasso_class extends Base_mask_tool_class {

	constructor(ctx) {
		super(ctx, 'lasso');
		this.Helper = new Helper_class();
		this.points = null; //path being drawn
		this.cursor = null;
		this.drawing = false;
	}

	load() {
		document.addEventListener('mousedown', (event) => this.dragStart(event));
		document.addEventListener('mousemove', (event) => this.dragMove(event));
		document.addEventListener('mouseup', (event) => this.dragEnd(event));
		document.addEventListener('dblclick', (event) => this.double_click(event));

		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name != this.name || this.Helper.is_input(event.target)) {
				return;
			}
			if (event.keyCode == 27) {
				//escape - cancel current path
				this.cancel();
			}
			else if (event.keyCode == 13 && this.drawing) {
				//enter - close polygon
				this.finish(event);
			}
			else if (event.keyCode == 46 && !this.drawing) {
				this.Selection.delete_selection();
			}
		}, false);
	}

	is_polygonal() {
		return Boolean(this.getParams().polygonal);
	}

	dragStart(event) {
		if (config.TOOL.name != this.name) {
			return;
		}
		this.mousedown(event);
	}

	dragMove(event) {
		if (config.TOOL.name != this.name) {
			return;
		}
		this.mousemove(event);
	}

	dragEnd(event) {
		if (config.TOOL.name != this.name) {
			return;
		}
		this.mouseup(event);
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || mouse.valid == false) {
			return;
		}
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		const point = {x: mouse.x, y: mouse.y};

		if (this.is_polygonal()) {
			if (this.drawing == false) {
				this.points = [point];
				this.drawing = true;
			}
			else if (this.is_near_start(point)) {
				this.finish(e);
				return;
			}
			else {
				this.points.push(point);
			}
		}
		else {
			this.points = [point];
			this.drawing = true;
		}
		this.cursor = point;
		config.need_render = true;
	}

	mousemove(e) {
		if (this.drawing == false) {
			return;
		}
		const mouse = this.get_mouse_info(e);
		const point = {x: mouse.x, y: mouse.y};
		this.cursor = point;

		if (this.is_polygonal() == false) {
			if (mouse.is_drag == false) {
				return;
			}
			const last = this.points[this.points.length - 1];
			if (Math.abs(last.x - point.x) >= 1 || Math.abs(last.y - point.y) >= 1) {
				this.points.push(point);
			}
		}
		config.need_render = true;
	}

	mouseup(e) {
		if (this.drawing && this.is_polygonal() == false) {
			this.finish(e);
		}
	}

	double_click(e) {
		if (config.TOOL.name == this.name && this.drawing && this.is_polygonal()) {
			this.finish(e);
		}
	}

	is_near_start(point) {
		const start = this.points[0];
		const distance = Math.hypot(point.x - start.x, point.y - start.y);
		return this.points.length >= 3 && distance <= 8 / config.ZOOM;
	}

	cancel() {
		this.points = null;
		this.cursor = null;
		this.drawing = false;
		config.need_render = true;
	}

	/**
	 * Turns the drawn path into the selection mask
	 *
	 * @param {Event} e used for modifier keys
	 */
	async finish(e) {
		const points = this.points;
		this.cancel();
		if (points == null || points.length < 3) {
			return;
		}

		await this.commit_mask(polygon_mask(points, config.WIDTH, config.HEIGHT), e);
	}

	/**
	 * Path being drawn and the tint of a custom selection mask
	 */
	render_overlay(ctx) {
		this.render_mask_overlay(ctx);

		if (this.points == null || this.points.length == 0) {
			return;
		}
		const line = 2 / config.ZOOM;
		const points = this.points;
		const polygonal = this.is_polygonal();

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		if (polygonal && this.cursor) {
			ctx.lineTo(this.cursor.x, this.cursor.y);
		}
		else {
			ctx.closePath();
		}
		ctx.lineWidth = line;
		ctx.strokeStyle = 'rgb(255, 255, 255)';
		ctx.setLineDash([]);
		ctx.stroke();
		ctx.lineWidth = line / 2;
		ctx.strokeStyle = 'rgb(0, 0, 0)';
		ctx.setLineDash([4 / config.ZOOM, 4 / config.ZOOM]);
		ctx.stroke();
		if (polygonal) {
			//start point marker - click it to close the polygon
			ctx.setLineDash([]);
			ctx.fillStyle = 'rgb(255, 255, 255)';
			ctx.strokeStyle = 'rgb(0, 0, 0)';
			ctx.lineWidth = line / 2;
			ctx.beginPath();
			ctx.arc(points[0].x, points[0].y, 4 / config.ZOOM, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
		ctx.restore();
	}

	on_switch_keep_selection() {
		this.cancel();
	}

	on_leave() {
		this.cancel();
		return super.on_leave();
	}
}

export default Lasso_class;
