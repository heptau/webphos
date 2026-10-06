import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import { heal_spot } from './../libs/retouch.js';

/**
 * Healing brush - paint over a blemish; the texture is taken from the surroundings and
 * adapted to their colors (like Photoshop's Spot Healing Brush).
 */
class Heal_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'heal';
		this.history_name = 'Healing Brush';
		this.spacing_factor = 3;
	}

	stamp(ctx, position, size, params) {
		var radius = Math.max(2, size / 2);
		this.with_region(ctx, position, radius * 6.5, (image, x, y) => {
			heal_spot(image, x, y, radius, params.match_color !== false);
		});
	}
}

export default Heal_class;
