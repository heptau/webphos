import Base_tools_class from './../core/base-tools.js';

/**
 * Adjustment layer (Layer > New Adjustment Layer). It draws nothing by itself: the picture below it is changed
 * by Base_layers.render_adjustment, because the layer needs the layers below. This class only makes the layer type known.
 */
class Adjustment_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.ctx = ctx;
		this.name = 'adjustment';
	}

	render() {
		//see Base_layers.render_adjustment
	}
}

export default Adjustment_class;
