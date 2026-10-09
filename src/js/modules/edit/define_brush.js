import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Edit_selection_class from './selection.js';
import { fit_tip_size, tip_mask, tip_has_paint, save_stored_tip } from './../../libs/brush-tip.js';
import { t } from '../tools/translate.js';

let counter = 0;

/**
 * Edit > Define Brush - the selected part of the picture (or the whole picture) becomes the tip of the Brush:
 * dark parts paint, white and transparent parts do not. The Brush then uses it with the tip option "Custom".
 */
class Edit_define_brush_class {

	async define_brush() {
		const selection = new Edit_selection_class();
		const part = selection.get_selection_canvas(null, true);
		const source = part ? part.canvas : selection.get_merged_canvas();

		//a tip does not need to be big, 128 pixels on the longer side is plenty
		const size = fit_tip_size(source.width, source.height);
		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;
		const ctx = canvas.getContext('2d', {willReadFrequently: true});
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(source, 0, 0, size.width, size.height);

		const mask = tip_mask(ctx.getImageData(0, 0, size.width, size.height));
		if (tip_has_paint(mask) == false) {
			alertify.error(t('The picture has nothing dark enough to paint with.'));
			return;
		}
		ctx.putImageData(new ImageData(mask.data, mask.width, mask.height), 0, 0);
		counter++;
		config.brush_tip = {id: `${Date.now()  }-${  counter}`, data: canvas.toDataURL('image/png')};
		//the next session starts with this tip too
		save_stored_tip(config.brush_tip);

		//the Brush uses it right away
		const brush = config.TOOLS.find((tool) => tool.name == 'brush');
		if (brush && brush.attributes.tip) {
			brush.attributes.tip.value = 'Custom';
		}
		await app.State.do_action(new app.Actions.Activate_tool_action('brush'));
		app.GUI.GUI_tools.show_action_attributes();
		alertify.success(t('Brush tip defined.'));
	}
}

export default Edit_define_brush_class;
