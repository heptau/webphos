import Edit_selection_transform_session_class from './selection_transform_session.js';
import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Helper_class from './../../libs/helpers.js';
import { grow_rect } from './../../libs/selection-area.js';
import {
	invert_mask, ellipse_mask, feather_mask, morph_mask, mask_bounds, color_range_mask, alpha_mask, keep_with_mask, resize_mask, combine_masks, select_similar_mask, select_subject_mask, luminosity_mask, edges_mask, select_sky_mask, rect_mask, rounded_rect_mask, transform_mask, smooth_mask, border_mask, refine_mask, stroke_mask, translate_mask
} from './../../libs/selection-mask.js';
import { selection_to_layer_rect } from './../../libs/selection-area.js';
import { deserialize_layer_mask, apply_layer_mask } from './../../libs/layer-mask.js';
import {
	serialize_selections, parse_selections, unique_name, mask_to_pixels, image_to_mask
} from './../../libs/selection-file.js';
import { parseHex } from './../../libs/adjustments.js';
import Base_layers_class from './../../core/base-layers.js';
import Selection_mask_class from './../../core/selection-mask-state.js';
import Selection_class from './../../tools/selection.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { clean_anchors, path_mask } from './../../libs/pen-path.js';
import { t } from '../tools/translate.js';

let instance = null;

/**
 * Select menu. The selection tool keeps a rectangle, Selection_mask_class adds an alpha mask on top of it
 * (inverse, feather, ellipse, color range, layer transparency, expand/contract of non-rectangular masks).
 */
class Edit_selection_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_layers = new Base_layers_class();
		this.Selection = new Selection_class(this.Base_layers.ctx);
		this.Selection_mask = new Selection_mask_class();
		this.Dialog = new Dialog_class();
		this.Helper = new Helper_class();
		this.tool_before_quick_mask = null;
		this.last_deselected = null; //mask of the selection removed by deselect()
		this.Selection_mask.restore_saved(); //selections saved in previous sessions

	}

	/**
	 * Select > Quick Mask (Q) - toggles the quick mask (selection brush) tool and the previous tool
	 */
	quick_mask() {
		let target = 'quick_mask';
		if (config.TOOL.name == 'quick_mask') {
			target = this.tool_before_quick_mask && this.tool_before_quick_mask != 'quick_mask' ? this.tool_before_quick_mask : 'selection';
		}
		else {
			this.tool_before_quick_mask = config.TOOL.name;
		}
		return app.State.do_action(
			new app.Actions.Activate_tool_action(target)
		);
	}

	select_all() {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		this.Selection.select_all();
	}

	deselect() {
		if (this.has_selection() == false) {
			return;
		}
		//remember the selection for Select > Reselect
		const current = this.get_mask();
		if (current != null) {
			this.last_deselected = {width: current.mask.width, height: current.mask.height, data: new Uint8ClampedArray(current.mask.data)};
		}
		this.Selection.clear_selection();
	}

	/**
	 * Select > Reselect (Shift+Ctrl+D) - brings back the selection removed by Deselect
	 */
	reselect() {
		if (this.last_deselected == null) {
			alertify.error(t('There is no selection to restore.'));
			return;
		}
		const mask = resize_mask(this.last_deselected, config.WIDTH, config.HEIGHT);
		return this.set_mask(mask, true);
	}

	has_selection() {
		const selection = this.Selection.selection;
		return selection != null && Boolean(selection.width) && Boolean(selection.height);
	}

	/**
	 * Current selection as a mask (see Selection_mask_class.get)
	 */
	get_mask() {
		return this.Selection_mask.get();
	}

	delete() {
		this.Selection.delete_selection();
	}

	/**
	 * Edit > Stroke Selection - draws the outline of the selection with the foreground color
	 */
	async stroke_selection() {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		const Edit_fill_class = (await import('./fill.js')).default;
		this.Dialog.show({
			title: 'Stroke Selection',
			params: [
				{name: "width", title: "Width:", value: 3, range: [1, 100]},
				{name: "location", title: "Location:", type: 'select', values: ['Inside', 'Center', 'Outside'], value: 'Center'},
			],
			on_finish: (params) => {
				const current = this.get_mask();
				if (current == null) {
					return;
				}
				const outline = stroke_mask(current.mask, params.width, String(params.location).toLowerCase());
				new Edit_fill_class().fill(outline);
			},
		});
	}

	/**
	 * Select > Inverse (Shift+Ctrl+I). Everything that was selected becomes unselected and vice versa.
	 */
	invert() {
		const current = this.get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		const s = this.Selection.selection;
		return app.State.do_action(
			new app.Actions.Set_selection_mask_action(invert_mask(current.mask), {x: s.x, y: s.y, width: s.width, height: s.height})
		);
	}

	/**
	 * Select > Modify > Rectangle to Ellipse - turns the selection rectangle into an ellipse
	 */
	to_ellipse() {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		const s = this.Selection.selection;
		const rect = {x: s.x, y: s.y, width: s.width, height: s.height};
		return app.State.do_action(
			new app.Actions.Set_selection_mask_action(ellipse_mask(rect, config.WIDTH, config.HEIGHT), rect)
		);
	}

	/**
	 * Select > Modify > Expand
	 */
	expand() {
		this.modify_dialog('Expand Selection', 1);
	}

	/**
	 * Select > Modify > Contract
	 */
	contract() {
		this.modify_dialog('Contract Selection', -1);
	}

	modify_dialog(title, sign) {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		const base = this.get_mask();
		this.preview_dialog({
			title,
			params: [
				{name: "amount", title: "Amount:", value: 10, range: [1, 100]},
			],
			compute: (params) => {
				const amount = sign * (parseInt(params.amount) || 0);
				if (base.kind == 'rect') {
					const rect = grow_rect(base.rect, amount, config.WIDTH, config.HEIGHT);
					return rect ? rect_mask(rect, config.WIDTH, config.HEIGHT) : null;
				}
				return morph_mask(base.mask, amount);
			},
			on_finish: (params) => {
				this.grow(sign * (parseInt(params.amount) || 0));
			},
		});
	}

	grow(amount) {
		const current = this.get_mask();
		if (current == null) {
			return;
		}
		if (current.kind == 'rect') {
			const rect = grow_rect(this.Selection.selection, amount, config.WIDTH, config.HEIGHT);
			if (rect == null) {
				alertify.error(t('Empty selection'));
				return;
			}
			return app.State.do_action(
				new app.Actions.Set_selection_action(rect.x, rect.y, rect.width, rect.height)
			);
		}
		return this.set_mask(morph_mask(current.mask, amount));
	}

	/**
	 * Select > Modify > Feather - soft selection edge
	 */
	feather() {
		this.mask_dialog('Feather Selection', [
			{name: "radius", title: "Feather radius:", value: 10, range: [1, 100]},
		], (mask, params) => feather_mask(mask, parseInt(params.radius) || 0));
	}

	/**
	 * Select > Color Range - selects pixels of the active layer similar to a color
	 */
	async color_range() {
		const layer = this.get_image_layer();
		if (layer == null) {
			return;
		}
		if (!config.TOOL.keep_selection) {
			//the selection (and its preview) is only drawn by the selection tools
			await app.State.do_action(new app.Actions.Activate_tool_action(this.Selection.name));
		}
		const image = this.layer_on_canvas(layer);
		this.preview_dialog({
			title: 'Color Range',
			params: [
				{name: "color", title: "Color:", value: config.COLOR, type: 'color'},
				{name: "fuzziness", title: "Fuzziness:", value: 40, range: [0, 200]},
			],
			compute: (params) => color_range_mask(image, parseHex(params.color), params.fuzziness),
			on_finish: (params) => {
				this.set_mask(color_range_mask(image, parseHex(params.color), params.fuzziness), true);
			},
		});
	}

	/**
	 * Select > Subject - selects the object in front of a calm background (the background is found from the edges)
	 */
	async select_subject() {
		const layer = this.get_image_layer();
		if (layer == null) {
			return;
		}
		if (!config.TOOL.keep_selection) {
			await app.State.do_action(new app.Actions.Activate_tool_action(this.Selection.name));
		}
		const image = this.layer_on_canvas(layer);
		this.preview_dialog({
			title: 'Select Subject',
			params: [
				{name: "tolerance", title: "Tolerance:", value: 30, range: [1, 120]},
				{name: "smooth", title: "Smooth edge:", value: 2, range: [0, 20]},
			],
			compute: (params) => select_subject_mask(image, params.tolerance, params.smooth),
			on_finish: (params) => {
				this.set_mask(select_subject_mask(image, params.tolerance, params.smooth), true);
			},
		});
	}

	/**
	 * a dialog with live preview for a selection computed from the picture of the active layer
	 */
	async image_mask_dialog(title, params, compute) {
		const layer = this.get_image_layer();
		if (layer == null) {
			return;
		}
		if (!config.TOOL.keep_selection) {
			await app.State.do_action(new app.Actions.Activate_tool_action(this.Selection.name));
		}
		const image = this.layer_on_canvas(layer);
		this.preview_dialog({
			title,
			params,
			compute: (values) => compute(image, values),
			on_finish: (values) => {
				this.set_mask(compute(image, values), true);
			},
		});
	}

	/**
	 * Select > Sky - the sky connected to the top of the picture
	 */
	select_sky() {
		return this.image_mask_dialog('Select Sky', [
			{name: "tolerance", title: "Tolerance:", value: 30, range: [1, 120]},
		], (image, params) => select_sky_mask(image, params.tolerance));
	}

	/**
	 * Select > Edges - the places where the picture changes quickly
	 */
	select_edges() {
		return this.image_mask_dialog('Select Edges', [
			{name: "sensitivity", title: "Sensitivity:", value: 40, range: [1, 100]},
			{name: "soften", title: "Soften:", value: 1, range: [0, 10]},
		], (image, params) => {
			const mask = edges_mask(image, params.sensitivity);
			return params.soften > 0 ? feather_mask(mask, parseInt(params.soften)) : mask;
		});
	}

	/**
	 * Select > Luminosity Mask - lights, midtones or darks
	 */
	luminosity() {
		return this.image_mask_dialog('Luminosity Mask', [
			{name: "range", title: "Range:", type: 'select', values: ['Lights', 'Midtones', 'Darks'], value: 'Lights'},
			{name: "narrow", title: "Narrow:", value: 1, range: [1, 4]},
		], (image, params) => luminosity_mask(image, String(params.range).toLowerCase(), params.narrow));
	}

	/**
	 * Select > Selection to New Layer - the selection as a black and white picture on a new layer
	 */
	mask_to_layer() {
		const current = this.get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		const mask = current.mask;
		const canvas = document.createElement('canvas');
		canvas.width = mask.width;
		canvas.height = mask.height;
		const ctx = canvas.getContext('2d');
		const image = ctx.createImageData(mask.width, mask.height);
		for (let p = 0, i = 0; p < mask.data.length; p++, i += 4) {
			image.data[i] = image.data[i + 1] = image.data[i + 2] = mask.data[p];
			image.data[i + 3] = 255;
		}
		ctx.putImageData(image, 0, 0);
		app.State.do_action(
			new app.Actions.Bundle_action('mask_to_layer', 'Selection to New Layer', [
				new app.Actions.Insert_layer_action({
					name: t('Selection Mask'),
					type: 'image',
					x: 0,
					y: 0,
					width: canvas.width,
					height: canvas.height,
					width_original: canvas.width,
					height_original: canvas.height,
					data: canvas.toDataURL('image/png'),
				}, false),
			])
		);
	}

	/**
	 * Select > Layer Transparency - selects all non transparent pixels of the active layer
	 */
	layer_transparency() {
		const layer = this.get_image_layer();
		if (layer == null) {
			return;
		}
		this.set_mask(alpha_mask(this.layer_on_canvas(layer)), true);
	}

	/**
	 * All visible layers merged to one canvas-size canvas (opacity and blend modes are respected)
	 *
	 * @returns {HTMLCanvasElement}
	 */
	get_merged_canvas() {
		const canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		const ctx = canvas.getContext('2d');
		//the same way the canvas is drawn: clipping masks, Blend If and adjustment layers count
		this.Base_layers.convert_layers_to_canvas(ctx, null, false);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		return canvas;
	}

	/**
	 * Selected part of the layer image (soft/non rectangular masks make the rest transparent).
	 *
	 * @param {object} layer raster layer
	 * @param {boolean} [merged] take the pixels from all visible layers merged together instead of the layer
	 * @returns {{canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number, width_original: number, height_original: number}|null}
	 *   canvas with the pixels in original layer resolution and the place (in canvas coordinates) it came from; null when there is no selection
	 */
	get_selection_canvas(layer, merged) {
		if (merged) {
			//the merged image behaves like one canvas-size layer
			layer = {
				type: 'image', link: this.get_merged_canvas(), x: 0, y: 0, width: config.WIDTH, height: config.HEIGHT,
				width_original: config.WIDTH, height_original: config.HEIGHT,
			};
		}
		const current = this.get_mask();
		if (current == null || !layer || layer.type != 'image') {
			return null;
		}
		const bounds = current.kind == 'custom' ? mask_bounds(current.mask) : current.rect;
		const rect = bounds ? selection_to_layer_rect(bounds, layer) : null;
		if (rect == null) {
			return null;
		}

		const full = document.createElement('canvas');
		full.width = layer.width_original;
		full.height = layer.height_original;
		const full_ctx = full.getContext('2d');
		full_ctx.drawImage(layer.link, 0, 0);
		const layer_mask = !merged && layer.mask && layer.mask_enabled !== false ? deserialize_layer_mask(layer.mask) : null;
		if (current.kind == 'custom' || layer_mask) {
			const image = full_ctx.getImageData(0, 0, full.width, full.height);
			if (layer_mask) {
				//what the layer mask hides is not copied
				apply_layer_mask(image, layer_mask);
			}
			if (current.kind == 'custom') {
				keep_with_mask(image, current.mask, layer);
			}
			full_ctx.putImageData(image, 0, 0);
		}

		const canvas = document.createElement('canvas');
		canvas.width = rect.width;
		canvas.height = rect.height;
		canvas.getContext('2d').drawImage(full, -rect.x, -rect.y);

		const scale_x = layer.width / layer.width_original;
		const scale_y = layer.height / layer.height_original;
		return {
			canvas,
			x: Math.round(layer.x + rect.x * scale_x),
			y: Math.round(layer.y + rect.y * scale_y),
			width: Math.round(rect.width * scale_x),
			height: Math.round(rect.height * scale_y),
			width_original: rect.width,
			height_original: rect.height,
		};
	}

	/**
	 * Select > Selection from Path - the inside of the active path layer (made by the Pen tool) becomes the selection
	 */
	selection_from_path() {
		const layer = config.layer;
		if (layer == null || layer.type != 'pen') {
			alertify.error(t('Select a path layer first.'));
			return;
		}
		const moved = clean_anchors(layer.data).map((a) => ({
			x: layer.x + a.x * layer.width / (layer.width_original || layer.width),
			y: layer.y + a.y * layer.height / (layer.height_original || layer.height),
			in: a.in ? {x: layer.x + a.in.x * layer.width / (layer.width_original || layer.width), y: layer.y + a.in.y * layer.height / (layer.height_original || layer.height)} : null,
			out: a.out ? {x: layer.x + a.out.x * layer.width / (layer.width_original || layer.width), y: layer.y + a.out.y * layer.height / (layer.height_original || layer.height)} : null,
		}));
		if (moved.length < 3) {
			alertify.error(t('A path needs at least 3 points.'));
			return;
		}
		return this.set_mask(path_mask(moved, config.WIDTH, config.HEIGHT), true);
	}

	/**
	 * Select > Transform Selection - a frame with handles on the canvas; scales, turns and moves the selection itself,
	 * the pixels stay as they are
	 */
	transform_selection() {
		return new Edit_selection_transform_session_class().start();
	}

	/**
	 * The same with numbers in a dialog (Numbers in the bar of Transform Selection)
	 */
	transform_selection_numbers() {
		this.mask_dialog('Transform Selection', [
			{name: "scale_x", title: "Width (%):", value: 100, range: [1, 400]},
			{name: "scale_y", title: "Height (%):", value: 100, range: [1, 400]},
			{name: "rotate", title: "Rotate:", value: 0, range: [-180, 180], step: 0.5},
			{name: "dx", title: "Horizontal:", value: 0, range: [-1000, 1000]},
			{name: "dy", title: "Vertical:", value: 0, range: [-1000, 1000]},
		], (mask, params) => transform_mask(mask, params));
	}

	/**
	 * Select > Modify > Round Corners - the corners of the selection (its bounding rectangle) get rounded
	 */
	round_corners() {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		this.mask_dialog('Round Corners', [
			{name: "radius", title: "Radius:", value: 20, range: [1, 500]},
		], (mask, params) => {
			const bounds = mask_bounds(mask);
			return bounds ? rounded_rect_mask(bounds, parseInt(params.radius) || 0, mask.width, mask.height) : mask;
		});
	}

	/**
	 * Select > Modify > Offset - moves the selection by a number of pixels
	 */
	offset() {
		this.mask_dialog('Offset Selection', [
			{name: "dx", title: "Horizontal:", value: 20, range: [-500, 500]},
			{name: "dy", title: "Vertical:", value: 0, range: [-500, 500]},
		], (mask, params) => translate_mask(mask, parseInt(params.dx) || 0, parseInt(params.dy) || 0));
	}

	/**
	 * Select > Modify > Smooth - rounds corners and removes jagged edges
	 */
	smooth() {
		this.mask_dialog('Smooth Selection', [
			{name: "radius", title: "Smooth radius:", value: 5, range: [1, 100]},
		], (mask, params) => smooth_mask(mask, parseInt(params.radius) || 0));
	}

	/**
	 * Select > Modify > Border - selects a band along the edge of the selection
	 */
	border() {
		this.mask_dialog('Border Selection', [
			{name: "width", title: "Width:", value: 10, range: [1, 100]},
		], (mask, params) => border_mask(mask, parseInt(params.width) || 1));
	}

	/**
	 * Select > Refine Edge - smooth, feather, contrast and shift edge in one step
	 */
	refine_edge() {
		//the image of the active layer guides the edge aware part (Snap to edges)
		const layer = config.layer && config.layer.type == 'image' ? config.layer : null;
		const guide = layer ? this.layer_on_canvas(layer) : null;
		const params = [];
		if (guide) {
			params.push(
				{name: "edge_radius", title: "Snap to edges:", value: 0, range: [0, 50]},
				{name: "edge_sensitivity", title: "Edge sensitivity:", value: 60, range: [1, 100]}
			);
		}
		params.push(
			{name: "smooth", title: "Smooth radius:", value: 0, range: [0, 100]},
			{name: "feather", title: "Feather radius:", value: 0, range: [0, 100]},
			{name: "contrast", title: "Contrast:", value: 0, range: [0, 100]},
			{name: "shift", title: "Shift edge:", value: 0, range: [-100, 100]}
		);
		this.mask_dialog('Refine Edge', params, (mask, values) => refine_mask(mask, values, guide));
	}

	/**
	 * Dialog that changes the current selection mask with the given function, with a live preview on the canvas
	 */
	mask_dialog(title, params_definition, change) {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		const base = this.get_mask();
		this.preview_dialog({
			title,
			params: params_definition,
			compute: (params) => change(base.mask, params),
			on_finish: (params) => {
				const current = this.get_mask();
				if (current != null) {
					this.set_mask(change(current.mask, params), false);
				}
			},
		});
	}

	/**
	 * Dialog that shows the resulting selection mask on the canvas while the parameters are changed.
	 *
	 * @param {object} options title, params (popup parameters), compute(params) -> mask|null (called after a short pause
	 *   when the parameters change), on_finish(params)
	 */
	preview_dialog(options) {
		let timer = null;
		const show_preview = (params) => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				if (!this.Dialog.active) {
					return;
				}
				try {
					const mask = options.compute(params);
					if (mask) {
						this.Selection_mask.set_preview(mask, () => this.Dialog.active);
					}
				}
				catch (error) {
					console.warn('Selection preview failed', error);
				}
				config.need_render = true;
			}, 120);
		};
		const finish = () => {
			clearTimeout(timer);
			this.Selection_mask.clear_preview();
			config.need_render = true;
		};

		const defaults = {};
		options.params.forEach((param) => {
			defaults[param.name] = param.value !== undefined ? param.value : (param.values ? param.values[0] : undefined);
		});
		this.Dialog.show({
			title: options.title,
			params: options.params,
			live: true,
			on_change: show_preview,
			on_cancel: finish,
			on_finish: (params) => {
				finish();
				options.on_finish(params);
			},
		});
		show_preview(defaults);
	}

	/**
	 * Select > Similar - adds all pixels of the layer whose color is close to the selected ones
	 */
	select_similar() {
		this.similar_dialog('Select Similar', false);
	}

	/**
	 * Select > Grow - adds connected pixels whose color is close to the selected ones
	 */
	grow_similar() {
		this.similar_dialog('Grow Selection', true);
	}

	similar_dialog(title, contiguous) {
		if (this.has_selection() == false) {
			alertify.error(t('Empty selection'));
			return;
		}
		const layer = this.get_image_layer();
		if (layer == null) {
			return;
		}
		const base = this.get_mask();
		const image = this.layer_on_canvas(layer);
		this.preview_dialog({
			title,
			params: [
				{name: "tolerance", title: "Tolerance:", value: 32, range: [0, 255]},
			],
			compute: (params) => select_similar_mask(image, base.mask, params.tolerance, contiguous),
			on_finish: (params) => {
				const current = this.get_mask();
				if (current != null) {
					this.set_mask(select_similar_mask(image, current.mask, params.tolerance, contiguous), false);
				}
			},
		});
	}

	/**
	 * Select > Save Selection - stores the current selection (with its soft edges) under a name
	 */
	async save_selection() {
		await this.Selection_mask.restore_saved();
		const current = this.get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		const names = this.Selection_mask.saved_names();
		let number = names.length + 1;
		while (names.indexOf(`Selection ${  number}`) >= 0) {
			number++;
		}
		this.Dialog.show({
			title: 'Save Selection',
			params: [
				{name: "name", title: "Name:", value: `Selection ${  number}`},
			],
			on_finish: (params) => {
				const name = String(params.name || '').trim();
				if (name == '') {
					alertify.error(t('Name is required.'));
					return;
				}
				const mask = this.get_mask();
				if (mask == null) {
					return;
				}
				const overwritten = this.Selection_mask.save(name, mask.mask);
				alertify.success(t(overwritten ? 'Saved selection replaced.' : 'Selection saved.'));
			},
		});
	}

	/**
	 * Select > Load Selection - restores a saved selection, optionally combined with the current one
	 */
	async load_selection() {
		await this.Selection_mask.restore_saved();
		const names = this.Selection_mask.saved_names();
		if (names.length == 0) {
			alertify.error(t('No saved selections.'));
			return;
		}
		this.Dialog.show({
			title: 'Load Selection',
			params: [
				{name: "name", title: "Selection:", values: names},
				{name: "operation", title: "Operation:", values: ['replace', 'add', 'subtract', 'intersect']},
				{name: "invert", title: "Invert:", value: false},
			],
			on_finish: (params) => {
				let mask = this.Selection_mask.load(params.name);
				if (mask == null) {
					return;
				}
				mask = resize_mask(mask, config.WIDTH, config.HEIGHT);
				if (params.invert) {
					mask = invert_mask(mask);
				}
				const current = this.get_mask();
				if (params.operation != 'replace' && current != null) {
					mask = combine_masks(current.mask, mask, params.operation);
				}
				this.set_mask(mask, true);
			},
		});
	}

	/**
	 * Select > Delete Saved Selection
	 */
	async delete_saved_selection() {
		await this.Selection_mask.restore_saved();
		const names = this.Selection_mask.saved_names();
		if (names.length == 0) {
			alertify.error(t('No saved selections.'));
			return;
		}
		this.Dialog.show({
			title: 'Delete Saved Selection',
			params: [
				{name: "name", title: "Selection:", values: names},
			],
			on_finish: (params) => {
				this.Selection_mask.remove(params.name);
			},
		});
	}

	/**
	 * Select > Export Saved Selections - saves saved selections to a JSON file
	 */
	async export_saved_selections() {
		await this.Selection_mask.restore_saved();
		const names = this.Selection_mask.saved_names();
		if (names.length == 0) {
			alertify.error(t('No saved selections.'));
			return;
		}
		this.Dialog.show({
			title: 'Export Saved Selections',
			params: [
				{name: "which", title: "Selection:", values: ['(all)', ...names]},
			],
			on_finish: (params) => {
				const chosen = params.which == '(all)' ? names : [params.which];
				const list = chosen
					.map((name) => ({name, mask: this.Selection_mask.load(name)}))
					.filter((item) => item.mask != null);
				const blob = new Blob([serialize_selections(list)], {type: 'application/json'});
				this.download(blob, chosen.length == 1 ? `${chosen[0]  }.selection.json` : 'minipaint-selections.json');
			},
		});
	}

	/**
	 * Select > Import Saved Selections - adds selections from a JSON file to the saved ones
	 */
	async import_saved_selections() {
		const file = await this.pick_file('.json,application/json');
		if (file == null) {
			return;
		}
		if (file.size > 100 * 1024 * 1024) {
			alertify.error(t('File is too large.'));
			return;
		}
		const parsed = parse_selections(await file.text());
		if (parsed.error) {
			alertify.error(t('This is not a Lumifex selections file.'));
			return;
		}
		await this.Selection_mask.restore_saved();
		const names = this.Selection_mask.saved_names();
		parsed.selections.forEach((item) => {
			const name = unique_name(item.name, names);
			this.Selection_mask.save(name, item.mask);
			names.push(name);
		});
		if (parsed.selections.length == 0) {
			alertify.error(t('No valid selections in the file.'));
		}
		else {
			alertify.success(`${t('Imported selections:')  } ${parsed.selections.length}${parsed.skipped ? ` (${t('skipped:')} ${parsed.skipped})` : ''}`);
		}
	}

	/**
	 * Select > Export Selection as Image - grayscale PNG of the selection (white = selected)
	 */
	export_selection_image() {
		const current = this.get_mask();
		if (current == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		const mask = current.mask;
		const canvas = document.createElement('canvas');
		canvas.width = mask.width;
		canvas.height = mask.height;
		const ctx = canvas.getContext('2d');
		ctx.putImageData(new ImageData(mask_to_pixels(mask), mask.width, mask.height), 0, 0);
		canvas.toBlob((blob) => {
			if (blob) {
				this.download(blob, 'selection-mask.png');
			}
		}, 'image/png');
	}

	/**
	 * Select > Import Selection from Image - brightness (or alpha of an image with transparency) becomes the selection
	 */
	async import_selection_image() {
		const file = await this.pick_file('image/*');
		if (file == null) {
			return;
		}
		try {
			const image = await this.load_image(file);
			const canvas = document.createElement('canvas');
			canvas.width = config.WIDTH;
			canvas.height = config.HEIGHT;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			const mask = image_to_mask(ctx.getImageData(0, 0, canvas.width, canvas.height));
			await this.set_mask(mask, true);
		}
		catch {
			alertify.error(t('Image could not be loaded'));
		}
	}

	/**
	 * Decodes an image file. Does not use blob: URLs, the Content-Security-Policy of the page only allows data: and https: images.
	 *
	 * @param {File} file
	 * @returns {Promise<ImageBitmap|HTMLImageElement>}
	 */
	async load_image(file) {
		if (typeof createImageBitmap === 'function') {
			return createImageBitmap(file);
		}
		const data_url = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Image could not be loaded'));
			img.src = data_url;
		});
	}

	/**
	 * Opens the browser file picker
	 *
	 * @param {string} accept
	 * @returns {Promise<File|null>} null when nothing was chosen
	 */
	pick_file(accept) {
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = accept;
			input.style.display = 'none';
			const done = (file) => {
				input.remove();
				resolve(file);
			};
			input.addEventListener('change', () => done(input.files && input.files[0] ? input.files[0] : null));
			input.addEventListener('cancel', () => done(null));
			document.body.appendChild(input);
			input.click();
		});
	}

	download(blob, filename) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	get_image_layer() {
		const layer = config.layer;
		if (layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return null;
		}
		return layer;
	}

	/**
	 * Layer image drawn at its place on a canvas-size image
	 *
	 * @returns {ImageData}
	 */
	layer_on_canvas(layer) {
		const canvas = document.createElement('canvas');
		canvas.width = config.WIDTH;
		canvas.height = config.HEIGHT;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(layer.link, layer.x, layer.y, layer.width, layer.height);
		return ctx.getImageData(0, 0, canvas.width, canvas.height);
	}

	/**
	 * Makes the mask the current selection: the selection rectangle becomes the mask's bounding box.
	 *
	 * @param {object} mask
	 * @param {boolean} [activate_tool] switch to the selection tool first (needed when there is no selection yet)
	 */
	async set_mask(mask, activate_tool) {
		const actions = this.mask_actions(mask);
		if (actions == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		if (activate_tool && config.TOOL.name != this.Selection.name) {
			actions.unshift(new app.Actions.Activate_tool_action(this.Selection.name));
		}
		await app.State.do_action(
			new app.Actions.Bundle_action('set_selection_mask', 'Selection', actions)
		);
		config.need_render = true;
	}

	/**
	 * Command form of set_mask for the tools (they run it through run_target)
	 *
	 * @param {{mask: object}} params
	 */
	set_mask_of_size(params) {
		return this.set_mask(params.mask, false);
	}

	/**
	 * The actions that make the mask the current selection (the rectangle of the selection becomes the bounds of the mask)
	 *
	 * @param {object} mask
	 * @returns {object[]|null} null when the mask is empty
	 */
	mask_actions(mask) {
		const bounds = mask_bounds(mask);
		if (bounds == null) {
			return null;
		}
		return [
			new app.Actions.Set_selection_action(bounds.x, bounds.y, bounds.width, bounds.height),
			new app.Actions.Set_selection_mask_action(mask, bounds)
		];
	}
}

export default Edit_selection_class;
