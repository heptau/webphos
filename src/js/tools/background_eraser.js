import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import { erase_similar } from './../libs/retouch.js';

/**
 * Background eraser - erases the color that was under the pointer when the stroke started,
 * other colors in the brush stay (good for removing a background around an edge).
 */
class Background_eraser_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'background_eraser';
		this.history_name = 'Background Eraser';
		this.color = [255, 255, 255];
	}

	begin(ctx, position) {
		const pixel = ctx.getImageData(
			Math.min(ctx.canvas.width - 1, Math.max(0, Math.round(position.x))),
			Math.min(ctx.canvas.height - 1, Math.max(0, Math.round(position.y))), 1, 1
		).data;
		this.color = [pixel[0], pixel[1], pixel[2]];
	}

	stamp(ctx, position, size, params) {
		const radius = Math.max(2, size / 2);
		//tolerance in percent of the color range
		const tolerance = (params.tolerance || 30) * 2.55;
		this.with_region(ctx, position, radius + 1, (image, x, y) => {
			erase_similar(image, x, y, radius, this.color, tolerance);
		});
	}
}

export default Background_eraser_class;
