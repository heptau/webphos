import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import { push_pixels } from './../libs/retouch.js';

/**
 * Liquify (forward warp) - drag to push the pixels along, like moving wet paint
 */
class Liquify_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'liquify';
		this.history_name = 'Liquify';
		this.spacing_factor = 6;
		this.previous = null;
	}

	begin(ctx, position) {
		this.previous = {x: position.x, y: position.y};
	}

	stamp(ctx, position, size, params) {
		var previous = this.previous || position;
		var dx = position.x - previous.x;
		var dy = position.y - previous.y;
		this.previous = {x: position.x, y: position.y};
		var radius = Math.max(3, size / 2);
		this.with_region(ctx, position, radius + 1, (image, x, y) => {
			push_pixels(image, x, y, radius, dx, dy, params.strength);
		});
	}
}

export default Liquify_class;
