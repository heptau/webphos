import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { metaDefaults } from './../../tools/text.js';
import { apply_meta, read_meta, toggle_flag, change_case, replace_text, is_empty_range, LOREM_IPSUM } from './../../libs/text-style.js';
import Layer_raster_class from './../layer/raster.js';
import { t } from '../tools/translate.js';

var instance = null;

/**
 * The Type menu: style of the text of the active text layer (Character, Paragraph, Style, Case), Lorem Ipsum and
 * Rasterize Type. The style goes to the part that is selected while the Text tool edits the layer, otherwise to the
 * whole text. Every command is one step of the history. (Warp Text is in modules/layer/warp_text.js.)
 */
class Type_character_class {

	constructor() {
		if (instance) {
			return instance;
		}
		instance = this;
	}

	/**
	 * @returns {object|null} the active layer when it is a text layer, otherwise a message is shown
	 */
	text_layer() {
		var layer = config.layer;
		if (layer == null || layer.type != 'text' || !Array.isArray(layer.data)) {
			alertify.error(t('This command works only on a text layer.'));
			return null;
		}
		return layer;
	}

	/**
	 * The part of the text that is selected in the editor of the Text tool, null when nothing is selected
	 * (then the commands work on the whole text). Taken before a dialog opens, the dialog may take the selection away.
	 *
	 * @param {object} layer
	 * @returns {{start: object, end: object}|null}
	 */
	selection_range(layer) {
		try {
			if (!config.TOOL || config.TOOL.name != 'text') {
				return null;
			}
			var tool = app.GUI.GUI_tools.tools_modules.text.object;
			var editor = tool.get_editor(layer);
			var selection = editor && editor.selection;
			if (!selection || !selection.start || !selection.end) {
				return null;
			}
			var range = {
				start: {line: selection.start.line, character: selection.start.character},
				end: {line: selection.end.line, character: selection.end.character},
			};
			return is_empty_range(range) ? null : range;
		}
		catch (error) {
			return null;
		}
	}

	change_data(layer, name, data, params) {
		var changes = {data: data};
		if (params) {
			changes.params = params;
		}
		return app.State.do_action(
			new app.Actions.Bundle_action(name, name, [new app.Actions.Update_layer_action(layer.id, changes)])
		);
	}

	character() {
		var layer = this.text_layer();
		if (layer == null) {
			return;
		}
		var range = this.selection_range(layer);
		var meta = read_meta(layer.data, metaDefaults, range);
		var fonts = Array.from(new Set([metaDefaults.family, meta.family, ...config.FONTS, ...Object.keys(config.user_fonts || {})])).sort();
		new Dialog_class().show({
			title: 'Character',
			params: [
				{name: "family", title: "Font:", values: fonts, value: meta.family},
				{name: "size", title: "Size:", value: meta.size, min: 1, max: 1000},
				{name: "fill_color", title: "Color:", value: meta.fill_color, type: 'color'},
				{name: "bold", title: "Bold:", value: !!meta.bold},
				{name: "italic", title: "Italic:", value: !!meta.italic},
				{name: "underline", title: "Underline:", value: !!meta.underline},
				{name: "strikethrough", title: "Strikethrough:", value: !!meta.strikethrough},
				{name: "kerning", title: "Kerning:", value: meta.kerning, min: -999, max: 999},
				{name: "leading", title: "Leading:", value: meta.leading, min: -999, max: 999},
				{name: "stroke_color", title: "Stroke color:", value: meta.stroke_color, type: 'color'},
				{name: "stroke_size", title: "Stroke size:", value: meta.stroke_size, min: 0, max: 100},
			],
			on_finish: (params) => {
				var number = (value, fallback) => {
					var parsed = parseFloat(value);
					return isNaN(parsed) ? fallback : parsed;
				};
				var changes = {
					family: String(params.family || metaDefaults.family),
					size: Math.max(1, number(params.size, metaDefaults.size)),
					fill_color: params.fill_color,
					bold: !!params.bold,
					italic: !!params.italic,
					underline: !!params.underline,
					strikethrough: !!params.strikethrough,
					kerning: number(params.kerning, 0),
					leading: number(params.leading, 0),
					stroke_color: params.stroke_color,
					stroke_size: Math.max(0, number(params.stroke_size, 0)),
				};
				return this.change_data(layer, 'Character', apply_meta(layer.data, changes, metaDefaults, range));
			},
		});
	}

	paragraph() {
		var layer = this.text_layer();
		if (layer == null) {
			return;
		}
		var current = layer.params && layer.params.halign ? layer.params.halign : 'left';
		var labels = {left: 'Align Left', center: 'Align Horizontal Center', right: 'Align Right'};
		new Dialog_class().show({
			title: 'Paragraph',
			params: [
				{name: "align", title: "Alignment:", values: Object.values(labels), value: labels[current] || labels.left},
			],
			on_finish: (params) => {
				var align = Object.keys(labels).find((key) => labels[key] === params.align) || 'left';
				return this.change_data(layer, 'Paragraph', layer.data, Object.assign({}, layer.params, {halign: align}));
			},
		});
	}

	/**
	 * @param {string} key bold, italic, underline or strikethrough
	 */
	toggle_style(key) {
		var layer = this.text_layer();
		if (layer == null || ['bold', 'italic', 'underline', 'strikethrough'].indexOf(key) < 0) {
			return;
		}
		return this.change_data(layer, 'Text Style', toggle_flag(layer.data, key, metaDefaults, this.selection_range(layer)));
	}

	/**
	 * @param {string} mode upper, lower or title
	 */
	change_case(mode) {
		var layer = this.text_layer();
		if (layer == null || ['upper', 'lower', 'title'].indexOf(mode) < 0) {
			return;
		}
		return this.change_data(layer, 'Text Case', change_case(layer.data, mode, this.selection_range(layer)));
	}

	lorem() {
		var layer = this.text_layer();
		if (layer == null) {
			return;
		}
		return this.change_data(layer, 'Paste Lorem Ipsum', replace_text(layer.data, LOREM_IPSUM));
	}

	rasterize() {
		if (this.text_layer() == null) {
			return;
		}
		return new Layer_raster_class().raster();
	}
}

export default Type_character_class;
