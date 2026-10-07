import app from './../app.js';
import config from './../config.js';
import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

/**
 * History brush - paints back the picture the document had before its first change (the same snapshot that
 * View > Split Compare shows), so a filter or a stroke can be undone just where the brush goes.
 */
class History_brush_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'history_brush';
		this.history_name = 'History Brush';
		this.spacing_factor = 5;
	}

	mousedown(e) {
		this.source = app.State.original_canvas;
		if (!this.source || app.State.action_history_index == 0) {
			if (this.get_mouse_info(e).click_valid) {
				alertify.warning(t('There are no changes to paint back.'));
			}
			this.started = false;
			return;
		}
		super.mousedown(e);
	}

	stamp(ctx, position, size, params) {
		var layer = config.layer;
		var scale_x = layer.width / layer.width_original;
		var scale_y = layer.height / layer.height_original;
		var hardness = Math.min(100, Math.max(0, parseFloat(params.hardness) || 0)) / 100;
		var opacity = Math.min(100, Math.max(1, parseFloat(params.opacity) || 100)) / 100;
		var diameter = Math.max(1, Math.round(size));
		var radius = diameter / 2;

		//the part of the snapshot under the brush (the snapshot is the size of the document)
		var piece = document.createElement('canvas');
		piece.width = diameter;
		piece.height = diameter;
		var piece_ctx = piece.getContext('2d');
		var center_x = layer.x + position.x * scale_x;
		var center_y = layer.y + position.y * scale_y;
		piece_ctx.drawImage(this.source, center_x - radius * scale_x, center_y - radius * scale_y, diameter * scale_x, diameter * scale_y, 0, 0, diameter, diameter);

		//round, soft brush tip
		var tip = document.createElement('canvas');
		tip.width = diameter;
		tip.height = diameter;
		var tip_ctx = tip.getContext('2d');
		var gradient = tip_ctx.createRadialGradient(radius, radius, radius * hardness, radius, radius, radius);
		gradient.addColorStop(0, 'rgba(0, 0, 0, ' + opacity + ')');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
		tip_ctx.fillStyle = gradient;
		tip_ctx.fillRect(0, 0, diameter, diameter);

		piece_ctx.globalCompositeOperation = 'destination-in';
		piece_ctx.drawImage(tip, 0, 0);

		var x = Math.round(position.x - radius);
		var y = Math.round(position.y - radius);
		ctx.save();
		ctx.globalCompositeOperation = 'destination-out';
		ctx.drawImage(tip, x, y);
		ctx.globalCompositeOperation = 'source-over';
		ctx.drawImage(piece, x, y);
		ctx.restore();
	}
}

export default History_brush_class;
