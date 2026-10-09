import Base_pixel_tool_class from './../core/base-pixel-tool.js';
import { remove_red_eye } from './../libs/retouch.js';

/**
 * Red eye tool - click on a red pupil
 */
class Red_eye_class extends Base_pixel_tool_class {

	constructor(ctx) {
		super(ctx);
		this.name = 'red_eye';
		this.history_name = 'Red Eye';
		this.single_click = true;
	}

	stamp(ctx, position, size, params) {
		const radius = Math.max(2, size / 2);
		this.with_region(ctx, position, radius + 1, (image, x, y) => {
			remove_red_eye(image, x, y, radius, params.strength);
		});
	}
}

export default Red_eye_class;
