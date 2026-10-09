import { draw_mask_ants, ant_phase } from './../libs/marching-ants.js';
import { schedule_ants_redraw } from './../core/base-selection.js';
import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Base_selection_class from './../core/base-selection.js';
import GUI_tools_class from './../core/gui/gui-tools.js';
import Helper_class from './../libs/helpers.js';
import { marquee_rect } from './../libs/marquee.js';
import Selection_mask_class from './../core/selection-mask-state.js';
import { erase_with_mask } from './../libs/selection-mask.js';
import { point_in_selection, fit_mask_to_rect } from './../libs/selection-move.js';
import Edit_selection_move_class from './../modules/edit/selection_move.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

let instance = null;

class Selection_class extends Base_tools_class {

	constructor(ctx) {
		super();

		//singleton
		if (instance) {
			return instance;
		}
		instance = this;


		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'selection';
		this.type = null;
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
		this.selection_coords_from = null;
		this.selection = {
			x: null,
			y: null,
			width: null,
			height: null,
		};

		const sel_config = {
			ants: true,
			enable_background: true,
			enable_borders: true,
			//handles resize the selection, dragging inside moves it (the outline; the Move tool takes the pixels along)
			enable_controls: true,
			enable_rotation: false,
			enable_move: true,
			data_function: () => {
				return this.selection;
			},
		};
		this.sel_config = sel_config;
		this.Selection_mask = new Selection_mask_class();
		this.Selection_mask.bind(() => this.selection);
		this.mousedown_selection = null;
		this.Base_selection = new Base_selection_class(ctx, sel_config, this.name);
		this.GUI_tools = new GUI_tools_class();
	}

	load() {

		//mouse events
		document.addEventListener('mousedown', (event) => {
			this.dragStart(event);
		});
		document.addEventListener('mousemove', (event) => {
			this.dragMove(event);
		});
		document.addEventListener('mouseup', (event) => {
			this.dragEnd(event);
		});

		// collect touch events
		document.addEventListener('touchstart', (event) => {
			this.dragStart(event);
		});
		document.addEventListener('touchmove', (event) => {
			this.dragMove(event);
		});
		document.addEventListener('touchend', (event) => {
			this.dragEnd(event);
		});

		document.addEventListener('keydown', (e) => {
			const code = e.keyCode;
			if (this.Helper.is_input(e.target))
				return;

			if (code == 27) {
				//escape
				app.State.do_action(new app.Actions.Bundle_action('clear_selection', 'Clear Selection', this.on_leave()));
			}
			if (code == 46) {
				//delete
				if (config.TOOL.name == this.name) {
					this.delete_selection();
				}
			}
		}, false);
	}

	dragStart(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousedown(event);
	}

	dragMove(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mousemove(event);
	}

	dragEnd(event) {
		if (config.TOOL.name != this.name)
			return;
		this.mouseup(event);
	}

	mousedown(e) {
		const mouse = this.get_mouse_info(e);
		if (this.Base_selection.is_drag == false || mouse.click_valid == false)
			return;

		//the marquee only draws a rectangle: it works on any layer (also a vector one)

		this.mousedown_selection = JSON.parse(JSON.stringify(this.selection));
		this.mousedown_mask = this.Selection_mask.get();

		if (this.Base_selection.mouse_lock != null && this.selection.width && this.selection.height) {
			//a handle of the selection is dragged (the rectangle is changed by Base_selection, the result is set on mouse up)
			this.type = 'resize';
			return;
		}
		if (this.mousedown_mask != null && point_in_selection(this.mousedown_mask, {x: mouse.x, y: mouse.y})) {
			//a press inside of the selection drags its outline (the pixels stay, see the Move tool)
			this.type = 'move_outline';
			this.outline_start = {x: mouse.x, y: mouse.y};
			new Edit_selection_move_class().begin('Outline');
		}
		else {
			//create new selection
			this.selection = {
				x: mouse.x,
				y: mouse.y,
				width: 0,
				height: 0,
			};
			this.type = 'create';
			this.selection_coords_from = {x: mouse.x, y: mouse.y};
			if (this.marquee_options(e).style == 'Fixed Size') {
				//a click is enough, the size is given
				this.selection = this.round_rect(marquee_rect(this.selection_coords_from, this.selection_coords_from, this.marquee_options(e)));
			}
		}
	}

	mousemove(e) {
		const mouse = this.get_mouse_info(e);
		if (this.Base_selection.is_drag == false || mouse.is_drag == false)
			return;
		if (e.type == 'mousedown' && (mouse.click_valid == false)) {
			return;
		}
		if (this.type == 'move_outline') {
			new Edit_selection_move_class().update(mouse.x - this.outline_start.x, mouse.y - this.outline_start.y, false);
			return;
		}
		if (this.selection_coords_from === null) {
			return;
		}
		if (this.type == 'create') {
			//create new selection (Shift = square, Alt = from the center, Fixed Ratio / Fixed Size options)
			this.selection = this.round_rect(marquee_rect(this.selection_coords_from, mouse, this.marquee_options(e)));
			config.need_render = true;
		}
	}

	mouseup(e) {
		const mouse = this.get_mouse_info(e);

		if (!this.Base_selection.is_drag) {
			return;
		}
		if (e.type == 'mousedown' && mouse.click_valid == false) {
			return;
		}
		if (this.type === 'move_outline') {
			this.type = null;
			return new Edit_selection_move_class().finish(mouse.x - this.outline_start.x, mouse.y - this.outline_start.y, false);
		}
		if (this.type === 'resize') {
			this.type = null;
			return this.finish_resize();
		}

		if (!this.selection.width || !this.selection.height) {
			//cancel selection
			app.State.do_action(
				new app.Actions.Bundle_action('clear_selection', 'Clear Selection', this.on_leave())
			);
			return;
		}

		if (this.selection.width != null && this.selection.height != null) {
			//make sure coords not negative
			const details = this.selection;
			let x = details.x;
			let y = details.y;
			if (details.width < 0) {
				x = x + details.width;
				this.selection_coords_from.x = x;
			}
			if (details.height < 0) {
				y = y + details.height;
				this.selection_coords_from.y = y;
			}
			this.selection = {
				x,
				y,
				width: Math.abs(details.width),
				height: Math.abs(details.height),
			};
			const shape = this.getParams().shape;
			const is_ellipse = shape && (shape.value || shape) == 'Ellipse';
			app.State.do_action(
				new app.Actions.Set_selection_action(this.selection.x, this.selection.y, this.selection.width, this.selection.height, this.mousedown_selection)
			).then(() => {
				if (is_ellipse) {
					//the elliptical marquee is the rectangle turned into an ellipse mask
					app.GUI.run_target('edit/selection.to_ellipse');
				}
			});
		}
	}

	/**
	 * The handles of the selection were dragged: the new rectangle (a soft or odd shaped selection is stretched with it)
	 * is set in one step of the history
	 */
	finish_resize() {
		const rect = this.round_rect(this.selection);
		const original = this.mousedown_selection;
		const mask_before = this.mousedown_mask;
		//back to the old rectangle first, so Undo brings it back
		this.selection = original;
		if (!rect.width || !rect.height || (rect.x == original.x && rect.y == original.y && rect.width == original.width && rect.height == original.height)) {
			config.need_render = true;
			return;
		}
		if (mask_before != null && mask_before.kind == 'custom') {
			return app.GUI.run_target('edit/selection.set_mask_of_size', {mask: fit_mask_to_rect(mask_before.mask, rect)});
		}
		return app.State.do_action(new app.Actions.Set_selection_action(rect.x, rect.y, rect.width, rect.height));
	}

	round_rect(rect) {
		return {x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height)};
	}

	/**
	 * Marquee options from the tool settings and the keys held right now
	 */
	marquee_options(e) {
		const params = this.getParams();
		const value = (item) => (item && item.value !== undefined ? item.value : item);
		return {
			style: value(params.style),
			fixed_width: params.fixed_width,
			fixed_height: params.fixed_height,
			shift: Boolean(e && e.shiftKey),
			alt: Boolean(e && e.altKey),
		};
	}

	select_all() {
		const actions = [];

		if (config.TOOL.name != this.name) {
			actions.push(
				new app.Actions.Activate_tool_action(this.name)
			);
		}
		actions.push(
			new app.Actions.Set_selection_action(0, 0, config.WIDTH, config.HEIGHT, this.selection)
		);
		app.State.do_action(
			new app.Actions.Bundle_action('select_all', 'Select All', actions)
		);
	}

	render() {
		//nothing
	}

	/**
	 * Custom masks (feathered, inverted, elliptical...) are shown as a green tint instead of the rectangle fill.
	 */
	render_overlay(ctx) {
		const current = this.Selection_mask.get();
		const preview = this.Selection_mask.get_preview();
		const custom = preview != null || (current != null && current.kind == 'custom');
		if (this.sel_config.enable_background === custom) {
			this.sel_config.enable_background = !custom;
			setTimeout(() => {
				config.need_render = true;
			}, 0);
		}
		if (preview) {
			ctx.drawImage(preview.overlay, 0, 0);
		}
		else if (custom) {
			//marching ants along the edge of the mask
			draw_mask_ants(ctx, current.mask, ant_phase());
			schedule_ants_redraw();
		}
	}

	save_translate() {
		if (this.tmpCanvas == null)
			return;

		delete config.layer.link_canvas;
		app.State.do_action(
			new app.Actions.Bundle_action('selection_tool', 'Selection Tool', [
				new app.Actions.Update_layer_image_action(this.tmpCanvas)
			])
		);

		this.reset_tmp_canvas();
		config.need_render = true;
	}

	delete_selection() {
		const selection = this.selection;
		const layer = config.layer;

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		if (selection == null) {
			alertify.error(t('Nothing is selected.'));
			return;
		}

		const current = this.Selection_mask.get();
		if (current != null && current.kind == 'custom') {
			this.delete_masked(current.mask);
			return;
		}

		this.init_tmp_canvas();

		let mouse_x = selection.x - layer.x;
		let mouse_y = selection.y - layer.y;

		//adapt to origin size
		mouse_x = this.adaptSize(mouse_x, 'width');
		mouse_y = this.adaptSize(mouse_y, 'height');
		selection.width = this.adaptSize(selection.width, 'width');
		selection.height = this.adaptSize(selection.height, 'height');

		//do erase
		this.tmpCanvasCtx.clearRect(mouse_x, mouse_y, selection.width, selection.height);

		app.State.do_action(
			new app.Actions.Bundle_action('delete_selection', 'Delete Selection', [
				new app.Actions.Update_layer_image_action(this.tmpCanvas),
				new app.Actions.Reset_selection_action(this.selection)
			])
		);

		this.reset_tmp_canvas();
		delete config.layer.link_canvas;
		this.reset_tmp_canvas();
	}

	/**
	 * Erases pixels according to a custom selection mask (soft edges erase partially)
	 */
	delete_masked(mask) {
		const layer = config.layer;
		this.init_tmp_canvas();
		const image = this.tmpCanvasCtx.getImageData(0, 0, this.tmpCanvas.width, this.tmpCanvas.height);
		erase_with_mask(image, mask, layer);
		this.tmpCanvasCtx.putImageData(image, 0, 0);

		app.State.do_action(
			new app.Actions.Bundle_action('delete_selection', 'Delete Selection', [
				new app.Actions.Update_layer_image_action(this.tmpCanvas),
				new app.Actions.Reset_selection_action(this.selection)
			])
		);

		this.reset_tmp_canvas();
		delete config.layer.link_canvas;
		this.reset_tmp_canvas();
	}

	init_tmp_canvas() {
		this.tmpCanvas = document.createElement('canvas');
		this.tmpCanvasCtx = this.tmpCanvas.getContext("2d");
		this.tmpCanvas.width = config.layer.width_original;
		this.tmpCanvas.height = config.layer.height_original;
		this.tmpCanvasCtx.drawImage(config.layer.link, 0, 0);
	}

	on_leave() {
		if (!app.Layers || !app.Layers.Base_selection) {
			//app is still starting (the saved tool is being activated), nothing to reset
			return [];
		}
		const actions = [
			new app.Actions.Reset_selection_action(this.selection)
		];
		if (config.layer) {
			delete config.layer.link_canvas;
		}
		this.reset_tmp_canvas();
		return actions;
	}

	clear_selection() {
		app.State.do_action(
			new app.Actions.Bundle_action('clear_selection', 'Clear Selection', this.on_leave())
		);
	}

	reset_tmp_canvas() {
		if (this.tmpCanvas == null)
			return;
		this.tmpCanvas.width = 1;
		this.tmpCanvas.height = 1;
		this.tmpCanvas = null;
		this.tmpCanvasCtx = null;
	}

}
;
export default Selection_class;
