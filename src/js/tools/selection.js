import { draw_mask_ants, ant_phase } from './../libs/marching-ants.js';
import { schedule_ants_redraw } from './../core/base-selection.js';
import app from './../app.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Base_selection_class from './../core/base-selection.js';
import GUI_tools_class from './../core/gui/gui-tools.js';
import Helper_class from './../libs/helpers.js';
import Selection_mask_class from './../core/selection-mask-state.js';
import { erase_with_mask } from './../libs/selection-mask.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

var instance = null;

class Selection_class extends Base_tools_class {

	constructor(ctx) {
		super();

		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		var _this = this;

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

		var sel_config = {
			ants: true,
			enable_background: true,
			enable_borders: true,
			enable_controls: false,
			enable_rotation: false,
			enable_move: false,
			data_function: function () {
				return _this.selection;
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
		var _this = this;

		//mouse events
		document.addEventListener('mousedown', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('mousemove', function (event) {
			_this.dragMove(event);
		});
		document.addEventListener('mouseup', function (event) {
			_this.dragEnd(event);
		});

		// collect touch events
		document.addEventListener('touchstart', function (event) {
			_this.dragStart(event);
		});
		document.addEventListener('touchmove', function (event) {
			_this.dragMove(event);
		});
		document.addEventListener('touchend', function (event) {
			_this.dragEnd(event);
		});

		document.addEventListener('keydown', (e) => {
			var code = e.keyCode;
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
			if (code == 65 && (e.ctrlKey == true || e.metaKey)) {
				//A
				e.preventDefault();
				this.select_all();
			}
		}, false);
	}

	dragStart(event) {
		var _this = this;
		if (config.TOOL.name != _this.name)
			return;
		_this.mousedown(event);
	}

	dragMove(event) {
		var _this = this;
		if (config.TOOL.name != _this.name)
			return;
		_this.mousemove(event);
	}

	dragEnd(event) {
		var _this = this;
		if (config.TOOL.name != _this.name)
			return;
		_this.mouseup(event);
	}

	mousedown(e) {
		var mouse = this.get_mouse_info(e);
		var layer = config.layer;
		if (this.Base_selection.is_drag == false || mouse.click_valid == false)
			return;

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		this.mousedown_selection = JSON.parse(JSON.stringify(this.selection));

		if (this.selection.width != null && this.selection.height != null
			&& mouse.x > this.selection.x
			&& mouse.x < this.selection.x + this.selection.width
			&& mouse.y > this.selection.y
			&& mouse.y < this.selection.y + this.selection.height
			&& layer.width == layer.width_original && layer.height == layer.height_original
			) {
			//move
			this.type = 'move';

			if (this.tmpCanvas == null) {
				this.init_tmp_canvas();

				//register tmp canvas for faster redraw
				config.layer.link_canvas = this.tmpCanvas;
				config.need_render = true;
			}
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
		}
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (this.Base_selection.is_drag == false || mouse.is_drag == false)
			return;
		if (e.type == 'mousedown' && (mouse.click_valid == false) || config.layer.type != 'image') {
			return;
		}
		if (this.selection_coords_from === null) {
			return;
		}
		if (this.type == 'create') {
			//create new selection
			this.selection.width = mouse.x - mouse.click_x;
			this.selection.height = mouse.y - mouse.click_y;
			config.need_render = true;
		}
	}

	mouseup(e) {
		var mouse = this.get_mouse_info(e);

		if (!this.Base_selection.is_drag) {
			return;
		}
		if ((e.type == 'mousedown' && mouse.click_valid == false) || config.layer.type != 'image') {
			return;
		}
		if (this.type === 'move') {
			return; // Translate appears to not work at the moment
		}

		var width = mouse.x - this.selection.x;
		var height = mouse.y - this.selection.y;

		if (width == 0 || height == 0) {
			//cancel selection
			app.State.do_action(
				new app.Actions.Bundle_action('clear_selection', 'Clear Selection', this.on_leave())
			);
			return;
		}

		if (this.selection.width != null && this.selection.height != null) {
			//make sure coords not negative
			var details = this.selection;
			var x = details.x;
			var y = details.y;
			if (details.width < 0) {
				x = x + details.width;
				this.selection_coords_from.x = x;
			}
			if (details.height < 0) {
				y = y + details.height;
				this.selection_coords_from.y = y;
			}
			this.selection = {
				x: x,
				y: y,
				width: Math.abs(details.width),
				height: Math.abs(details.height),
			};
			var shape = this.getParams().shape;
			var is_ellipse = shape && (shape.value || shape) == 'Ellipse';
			app.State.do_action(
				new app.Actions.Set_selection_action(this.selection.x, this.selection.y, this.selection.width, this.selection.height, this.mousedown_selection)
			).then(function () {
				if (is_ellipse) {
					//the elliptical marquee is the rectangle turned into an ellipse mask
					app.GUI.run_target('edit/selection.to_ellipse');
				}
			});
		}
	}

	select_all() {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		let actions = [];

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

	render(ctx, layer) {
		//nothing
	}

	/**
	 * Custom masks (feathered, inverted, elliptical...) are shown as a green tint instead of the rectangle fill.
	 */
	render_overlay(ctx) {
		var current = this.Selection_mask.get();
		var preview = this.Selection_mask.get_preview();
		var custom = preview != null || (current != null && current.kind == 'custom');
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
		var selection = this.selection;
		var layer = config.layer;

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		if (selection == null) {
			alertify.error(t('Nothing is selected.'));
			return;
		}

		var current = this.Selection_mask.get();
		if (current != null && current.kind == 'custom') {
			this.delete_masked(current.mask);
			return;
		}

		this.init_tmp_canvas();

		var mouse_x = selection.x - layer.x;
		var mouse_y = selection.y - layer.y;

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
		var layer = config.layer;
		this.init_tmp_canvas();
		var image = this.tmpCanvasCtx.getImageData(0, 0, this.tmpCanvas.width, this.tmpCanvas.height);
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
		let actions = [
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
