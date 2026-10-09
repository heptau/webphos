import config from './../../config.js';
import GUI_tools_class from './../../core/gui/gui-tools.js';

/**
 * Change size of active tool with [ and ] keys (Photoshop style)
 */
class Tools_brush_size_class {

	constructor() {
		this.GUI_tools = new GUI_tools_class();
	}

	increase() {
		this.change(1);
	}

	decrease() {
		this.change(-1);
	}

	/**
	 * @param {int} direction 1 or -1
	 */
	change(direction) {
		const attributes = config.TOOL ? config.TOOL.attributes : null;
		if (attributes == null || attributes.size == undefined) {
			return;
		}
		const is_object = typeof attributes.size == 'object';
		let size = parseFloat(is_object ? attributes.size.value : attributes.size) || 1;
		const min = is_object && attributes.size.min != null ? attributes.size.min : 1;
		const max = is_object && attributes.size.max != null ? attributes.size.max : 999;

		//bigger steps for bigger brushes, like in Photoshop
		const step = size < 10 ? 1 : (size < 50 ? 5 : 10);
		size = Math.min(max, Math.max(min, Math.round(size + direction * step)));

		if (is_object) {
			attributes.size.value = size;
		}
		else {
			attributes.size = size;
		}
		if (config.TOOL.on_update != undefined) {
			const tool = this.GUI_tools.tools_modules[config.TOOL.name];
			if (tool && tool.object[config.TOOL.on_update]) {
				tool.object[config.TOOL.on_update]({key: 'size', value: size});
			}
		}
		this.GUI_tools.show_action_attributes();
	}
}

export default Tools_brush_size_class;
