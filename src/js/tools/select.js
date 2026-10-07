import { pick_layer } from './../libs/auto-select.js';
import Edit_selection_move_class from './../modules/edit/selection_move.js';
import Selection_mask_class from './../core/selection-mask-state.js';
import { draw_mask_ants, draw_rect_ants, ant_phase } from './../libs/marching-ants.js';
import { schedule_ants_redraw } from './../core/base-selection.js';
import app from './../app.js';
import { describe_transform, remember_transform } from './../libs/transform-repeat.js';
import { linked_with, follow_transform } from './../libs/layer-link.js';
import config from './../config.js';
import Base_tools_class from './../core/base-tools.js';
import Base_layers_class from './../core/base-layers.js';
import Base_selection_class from './../core/base-selection.js';
import Helper_class from './../libs/helpers.js';
import Dialog_class from './../libs/popup.js';

class Select_tool_class extends Base_tools_class {

	constructor(ctx) {
		super();
		this.Base_layers = new Base_layers_class();
		this.POP = new Dialog_class();
		this.Helper = new Helper_class();
		this.ctx = ctx;
		this.name = 'select';
		this.saved = false;
		this.mousedown_dimensions = { x: null, y: null, width: null, height: null };
		this.keyboard_move_start_position = null;
		this.moving = false;
		this.resizing = false;
		this.snap_line_info = {x: null, y: null};
		this.rotate_initial = null;

		var sel_config = {
			enable_background: false,
			enable_borders: true,
			enable_controls: true,
			keep_ratio: true,
			enable_rotation: true,
			enable_move: true,
			data_function: function () {
				return config.layer;
			},
		};
		this.Base_selection = new Base_selection_class(ctx, sel_config, this.name);
	}

	load() {
		var _this = this;

		//mouse events
		document.addEventListener('mousedown', function (e) {
			_this.dragStart(e);
		});
		document.addEventListener('mousemove', function (e) {
			_this.dragMove(e);
		});
		document.addEventListener('mouseup', function (e) {
			_this.dragEnd(e);
		});

		// collect touch events
		document.addEventListener('touchstart', function (e) {
			_this.dragStart(e);
		});
		document.addEventListener('touchmove', function (e) {
			_this.dragMove(e);
		});
		document.addEventListener('touchend', function (e) {
			_this.dragEnd(e);
		});

		//keyboard actions
		document.addEventListener('keydown', (event) => {
			if (config.TOOL.name != this.name)
				return;
			if (this.POP.get_active_instances() > 0) {
				return;
			}
			if (this.Helper.is_input(event.target))
				return;
			var k = event.key;

			if (k == "Escape" && this.selection_drag) {
				//dragging a selection: nothing is changed
				this.selection_drag = null;
				new Edit_selection_move_class().cancel();
				return;
			}
			if (k == "ArrowUp") {
				this.move(0, -1, event);
			}
			else if (k == "ArrowDown") {
				this.move(0, 1, event);
			}
			else if (k == "ArrowRight") {
				this.move(1, 0, event);
			}
			else if (k == "ArrowLeft") {
				this.move(-1, 0, event);
			}
			if (k == "Delete") {
				if (config.TOOL.name == this.name) {
					app.State.do_action(
						new app.Actions.Delete_layer_action(config.layer.id)
					);
				}
			}
		});
		document.addEventListener('keyup', (event) => {
			if (config.TOOL.name != this.name)
				return;
			if (this.POP.active == true)
				return;
			if (this.Helper.is_input(event.target))
				return;
			var k = event.key;
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
				if (this.keyboard_move_start_position) {
					let x = config.layer.x;
					let y = config.layer.y;
					config.layer.x = this.keyboard_move_start_position.x;
					config.layer.y = this.keyboard_move_start_position.y;
					var key_x = x - this.keyboard_move_start_position.x;
					var key_y = y - this.keyboard_move_start_position.y;
					var key_actions = [new app.Actions.Update_layer_action(config.layer.id, { x, y })];
					(this.keyboard_linked || []).forEach(function (start) {
						start.layer.x = start.x;
						start.layer.y = start.y;
						key_actions.push(new app.Actions.Update_layer_action(start.layer.id, {x: start.x + key_x, y: start.y + key_y}));
					});
					this.keyboard_linked = [];
					app.State.do_action(
						key_actions.length == 1 ? key_actions[0] : new app.Actions.Bundle_action('move_layer', 'Move Layer', key_actions)
					);
					this.keyboard_move_start_position = null;
				}
			}
		});
	}

	dragStart(event) {
		var mouse = this.get_mouse_info(event);
		if (config.TOOL.name != this.name)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		this.mousedown(event);
	}

	dragMove(event) {
		var mouse = this.get_mouse_info(event);
		if (config.TOOL.name != this.name)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		this.mousemove(event);
	}

	dragEnd(event) {
		var mouse = this.get_mouse_info(event);
		if (config.TOOL.name != this.name)
			return;
		if (mouse.click_valid == false) {
			return;
		}

		this.mouseup(event);
		this.Base_layers.render();
	}

	/**
	 * the layers linked with the active layer (Layer > Link Layers) that move together with it, with their positions now
	 */
	linked_starts() {
		return linked_with(config.layers, config.layer)
			.filter((layer) => layer.locked !== true)
			.map((layer) => ({layer: layer, x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotate: layer.rotate}));
	}

	/**
	 * the active layer is being resized or turned: the linked layers get the same change, placed around it
	 * (for the preview while dragging, or for the action that ends the drag)
	 *
	 * @param {{x: number, y: number, width: number, height: number, rotate: number|null}} after the active layer now
	 * @returns {{start: object, frame: object}[]}
	 */
	linked_frames(after) {
		var before = Object.assign({}, this.mousedown_dimensions, {rotate: this.rotate_initial});
		return (this.linked_start || [])
			.filter((start) => start.layer.type != 'adjustment')
			.map((start) => ({start: start, frame: follow_transform(before, after, start)}));
	}

	async mousedown(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.click_valid == false || config.mouse_lock === true) {
			return;
		}

		this.rotate_initial = config.layer.rotate;

		if (this.Base_selection.mouse_lock != null) {
			this.resizing = true;
			this.Base_selection.find_settings().keep_ratio = config.layer.type === 'image';
			if (config.layer.type === 'text' && config.layer.params && config.layer.params.boundary === 'dynamic') {
				config.layer.params.boundary = 'box';
			}
		}
		else if (this.start_selection_drag(mouse)) {
			//a press inside of the selection drags the selection (with its pixels, or only the outline)
			this.saved = false;
		}
		else {
			this.moving = true;
			await this.auto_select_object(e);
			this.Base_selection.find_settings().keep_ratio = config.layer.type === 'image';
			this.saved = false;
		}

		this.mousedown_dimensions = {
			x: Math.round(config.layer.x),
			y: Math.round(config.layer.y),
			width: Math.round(config.layer.width),
			height: Math.round(config.layer.height)
		};
		this.linked_start = this.linked_starts();
	}

	/**
	 * Move tool option "Selection": what a press inside of a selection drags
	 *
	 * @returns {string} 'Content', 'Outline' or 'Layer' (the selection is ignored, the layer is moved)
	 */
	selection_mode() {
		var value = this.getParams().selection_content;
		return value && value.value !== undefined ? value.value : (value || 'Content');
	}

	/**
	 * @param {{x: number, y: number}} mouse
	 * @returns {boolean} the press starts dragging the selection
	 */
	start_selection_drag(mouse) {
		var mode = this.selection_mode();
		var mover = new Edit_selection_move_class();
		if (!mover.applies({x: mouse.x, y: mouse.y}, mode)) {
			return false;
		}
		mover.begin(mode);
		this.selection_drag = {mode: mode, x: mouse.x, y: mouse.y};
		return true;
	}

	mousemove(e) {
		var mouse = this.get_mouse_info(e);
		if (mouse.is_drag == false || mouse.click_valid == false || config.mouse_lock === true) {
			return;
		}
		if (this.selection_drag) {
			new Edit_selection_move_class().update(mouse.x - this.selection_drag.x, mouse.y - this.selection_drag.y, e.altKey === true);
			return;
		}
		if (this.resizing) {

			//also handle rotation
			let rotate = this.Base_selection.current_angle
			if(config.layer.rotate != rotate && rotate !== null){
				config.layer.rotate = rotate;
			}

			//the linked layers follow
			this.linked_frames({
				x: config.layer.x, y: config.layer.y, width: config.layer.width, height: config.layer.height,
				rotate: config.layer.rotate
			}).forEach(function (item) {
				Object.assign(item.start.layer, item.frame);
			});
			config.need_render = true;

			return;
		}
		else if (this.moving) {
			//move object
			config.layer.x = Math.round(mouse.x - mouse.click_x + this.mousedown_dimensions.x);
			config.layer.y = Math.round(mouse.y - mouse.click_y + this.mousedown_dimensions.y);

			//apply snap
			var snap_info = this.calc_snap(e, config.layer.x, config.layer.y);
			if(snap_info != null){
				if(snap_info.x != null) {
					config.layer.x = snap_info.x;
				}
				if(snap_info.y != null) {
					config.layer.y = snap_info.y;
				}
			}

			//the linked layers follow
			var follow_x = config.layer.x - this.mousedown_dimensions.x;
			var follow_y = config.layer.y - this.mousedown_dimensions.y;
			(this.linked_start || []).forEach(function (start) {
				start.layer.x = start.x + follow_x;
				start.layer.y = start.y + follow_y;
			});

			config.need_render = true;
		}
	}

	mouseup(e) {
		var mouse = this.get_mouse_info(e);
		if (this.selection_drag) {
			var drag = this.selection_drag;
			this.selection_drag = null;
			return new Edit_selection_move_class().finish(mouse.x - drag.x, mouse.y - drag.y, e.altKey === true);
		}
		if (mouse.click_valid == false || config.mouse_lock === true) {
			return;
		}
		if (this.resizing) {
			let x = config.layer.x;
			let y = config.layer.y;
			let width = config.layer.width;
			let height = config.layer.height;
			let turned = this.Base_selection.current_angle;
			let linked_after = this.linked_frames({
				x, y, width, height, rotate: turned !== null ? turned : this.rotate_initial
			});
			//the linked layers go back to where they were, the action changes them
			var linked_resize = [];
			linked_after.forEach(function (item) {
				var start = item.start;
				Object.assign(start.layer, {x: start.x, y: start.y, width: start.width, height: start.height, rotate: start.rotate});
				linked_resize.push(new app.Actions.Update_layer_action(start.layer.id, item.frame));
			});
			this.linked_start = [];

			//reset values
			config.layer.x = this.mousedown_dimensions.x;
			config.layer.y = this.mousedown_dimensions.y;
			config.layer.width = this.mousedown_dimensions.width;
			config.layer.height = this.mousedown_dimensions.height;
			if (
				this.mousedown_dimensions.x !== x || this.mousedown_dimensions.y !== y ||
				this.mousedown_dimensions.width !== width || this.mousedown_dimensions.height !== height
			) {
				app.State.do_action(
					new app.Actions.Bundle_action('resize_layer', 'Resize Layer', [
						new app.Actions.Update_layer_action(config.layer.id, {
							x, y, width, height
						})
					])
				);
			}

			//also handle rotation
			let rotate = this.Base_selection.current_angle;
			//Edit > Transform Again repeats this
			remember_transform(describe_transform(
				{x: this.mousedown_dimensions.x, y: this.mousedown_dimensions.y, width: this.mousedown_dimensions.width, height: this.mousedown_dimensions.height, rotate: this.rotate_initial},
				{x, y, width, height, rotate: rotate !== null ? rotate : this.rotate_initial}
			));
			if(this.rotate_initial != rotate && rotate !== null){
				//save state
				config.layer.rotate = this.rotate_initial;
				app.State.do_action(
					new app.Actions.Bundle_action('resize_layer', 'Resize Layer', [
						new app.Actions.Update_layer_action(config.layer.id, {
							rotate
						})
					])
				);
			}
			if (linked_resize.length > 0 && (
				this.mousedown_dimensions.x !== x || this.mousedown_dimensions.y !== y ||
				this.mousedown_dimensions.width !== width || this.mousedown_dimensions.height !== height ||
				(rotate !== null && this.rotate_initial != rotate)
			)) {
				app.State.do_action(
					new app.Actions.Bundle_action('resize_layer', 'Resize Linked Layers', linked_resize),
					{merge_with_history: 'resize_layer'}
				);
			}
		}
		else if (this.moving) {
			var new_x = Math.round(mouse.x - mouse.click_x + this.mousedown_dimensions.x);
			var new_y = Math.round(mouse.y - mouse.click_y + this.mousedown_dimensions.y);
			config.layer.x = this.mousedown_dimensions.x;
			config.layer.y = this.mousedown_dimensions.y;

			if(mouse.x - mouse.click_x || mouse.y - mouse.click_y) {
				var snap_info = this.calc_snap(e, new_x, new_y);
				if (snap_info != null) {
					if (snap_info.x != null) {
						new_x = snap_info.x;
					}
					if (snap_info.y != null) {
						new_y = snap_info.y;
					}
				}
			}

			//the linked layers go back to where they were, the action moves them
			var linked_updates = [];
			var move_x = new_x - this.mousedown_dimensions.x;
			var move_y = new_y - this.mousedown_dimensions.y;
			(this.linked_start || []).forEach(function (start) {
				start.layer.x = start.x;
				start.layer.y = start.y;
				linked_updates.push(new app.Actions.Update_layer_action(start.layer.id, {x: start.x + move_x, y: start.y + move_y}));
			});
			this.linked_start = [];

			if (this.mousedown_dimensions.x !== new_x || this.mousedown_dimensions.y !== new_y) {
				var moved_from = this.mousedown_dimensions;
				remember_transform(describe_transform(
					{x: moved_from.x, y: moved_from.y, width: moved_from.width, height: moved_from.height, rotate: 0},
					{x: new_x, y: new_y, width: moved_from.width, height: moved_from.height, rotate: 0}
				));
				app.State.do_action(
					new app.Actions.Bundle_action('move_layer', 'Move Layer', [
						new app.Actions.Update_layer_action(config.layer.id, {
							x: new_x,
							y: new_y
						})
					].concat(linked_updates))
				);
			}
		}
		this.moving = false;
		this.resizing = false;
	}

	/**
	 * The selection (the Move tool can drag it) as marching ants, or the preview of it while it is dragged
	 */
	draw_selection(ctx) {
		var state = new Selection_mask_class();
		var preview = state.get_preview();
		if (preview) {
			ctx.drawImage(preview.overlay, 0, 0);
			return;
		}
		var current = state.get();
		if (current == null) {
			return;
		}
		if (current.kind == 'custom') {
			draw_mask_ants(ctx, current.mask, ant_phase());
		}
		else {
			draw_rect_ants(ctx, current.rect.x, current.rect.y, current.rect.width, current.rect.height, config.ZOOM || 1, ant_phase());
		}
		schedule_ants_redraw();
	}

	/**
	 * Leaving the Move tool for a tool that does not share the selection forgets it (the selection tools do the same)
	 */
	on_leave() {
		if (!app.Layers || !app.Layers.Base_selection) {
			return [];
		}
		var tools = this.Base_gui.GUI_tools.tools_modules;
		return tools.selection ? tools.selection.object.on_leave() : [];
	}

	render_overlay(ctx){
		var ctx = this.Base_layers.ctx;
		var mouse = this.get_mouse_info(event);

		this.draw_selection(ctx);

		//maybe related tool have additional overlay render handlers?
		if(config.layer.render_function != null) {
			var render_class = config.layer.render_function[0];
			var render_function = 'select';
			if (
				typeof this.Base_gui.GUI_tools.tools_modules[render_class].object[
					render_function
					] != "undefined"
			) {
				this.Base_gui.GUI_tools.tools_modules[render_class].object[
					render_function
					](this.ctx);
			}
		}

		if (mouse.is_drag == false)
			return;

		this.render_overlay_parent(ctx);
	}

	/**
	 * calculates current object snap coordinates and returns it. One of coordinates can be null.
	 *
	 * @param event
	 * @param pos_x
	 * @param pos_y
	 * @returns object|null
	 */
	calc_snap(event, pos_x, pos_y) {
		var snap_position = { x: null, y: null };
		var params = this.getParams();

		if(config.SNAP === false || event.shiftKey == true){
			this.snap_line_info = {x: null, y: null};
			return null;
		}

		//settings
		var sensitivity = 0.01;
		var max_distance = (config.WIDTH + config.HEIGHT) / 2 * sensitivity / config.ZOOM;

		//collect snap positions
		var snap_positions = this.get_snap_positions(config.layer.id);

		//find closest snap positions
		var min_group = {
			x: {
				start: null,
				center: null,
				end: null,
			},
			y: {
				start: null,
				center: null,
				end: null,
			},
		};
		var min_group_distance = {
			x: {
				start: null,
				center: null,
				end: null,
			},
			y: {
				start: null,
				center: null,
				end: null,
			},
		};
		//x
		for(var i in snap_positions.x){
			var distance = Math.abs(pos_x - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.start || min_group_distance.x.start === null)){
				min_group_distance.x.start = distance;
				min_group.x.start = snap_positions.x[i];
			}

			var distance = Math.abs(pos_x + config.layer.width/2 - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.center || min_group_distance.x.center === null)){
				min_group_distance.x.center = distance;
				min_group.x.center = snap_positions.x[i];
			}

			var distance = Math.abs(pos_x + config.layer.width - snap_positions.x[i]);
			if(distance < max_distance && (distance < min_group_distance.x.end || min_group_distance.x.end === null)){
				min_group_distance.x.end = distance;
				min_group.x.end = snap_positions.x[i];
			}
		}
		//y
		for(var i in snap_positions.y){
			var distance = Math.abs(pos_y - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.start || min_group_distance.y.start === null)){
				min_group_distance.y.start = distance;
				min_group.y.start = snap_positions.y[i];
			}

			var distance = Math.abs(pos_y + config.layer.height/2 - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.center || min_group_distance.y.center === null)){
				min_group_distance.y.center = distance;
				min_group.y.center = snap_positions.y[i];
			}

			var distance = Math.abs(pos_y + config.layer.height - snap_positions.y[i]);
			if(distance < max_distance && (distance < min_group_distance.y.end || min_group_distance.y.end === null)){
				min_group_distance.y.end = distance;
				min_group.y.end = snap_positions.y[i];
			}
		}

		//find best begin, center, end
		var min_distance = {
			x: null,
			y: null,
		};
		//x
		if(min_group_distance.x.start != null)
			min_distance.x = min_group_distance.x.start;
		if(min_group_distance.x.center != null && (min_group_distance.x.center < min_distance.x || min_distance.x === null))
			min_distance.x = min_group_distance.x.center;
		if(min_group_distance.x.end != null && (min_group_distance.x.end < min_distance.x || min_distance.x === null))
			min_distance.x = min_group_distance.x.end;
		//y
		if(min_group_distance.y.start != null)
			min_distance.y = min_group_distance.y.start;
		if(min_group_distance.y.center != null && (min_group_distance.y.center < min_distance.y || min_distance.y === null))
			min_distance.y = min_group_distance.y.center;
		if(min_group_distance.y.end != null && (min_group_distance.y.end < min_distance.y || min_distance.y === null))
			min_distance.y = min_group_distance.y.end;

		//apply snap
		var success = false;
		//x
		if(min_group.x.center != null && min_group_distance.x.center == min_distance.x) {
			snap_position.x = Math.round(min_group.x.center - config.layer.width / 2);
			success = true;
			this.snap_line_info.x = {
				start_x: min_group.x.center,
				start_y: 0,
				end_x: min_group.x.center,
				end_y: config.HEIGHT
			};
		}
		else if(min_group.x.start != null && min_group_distance.x.start == min_distance.x) {
			snap_position.x = Math.round(min_group.x.start);
			success = true;
			this.snap_line_info.x = {
				start_x: min_group.x.start,
				start_y: 0,
				end_x: min_group.x.start,
				end_y: config.HEIGHT,
			};
		}
		else if(min_group.x.end != null && min_group_distance.x.end == min_distance.x) {
			snap_position.x = Math.round(min_group.x.end - config.layer.width);
			success = true;
			this.snap_line_info.x = {
				start_x: min_group.x.end,
				start_y: 0,
				end_x: min_group.x.end,
				end_y: config.HEIGHT
			};
		}
		else{
			this.snap_line_info.x = null;
		}
		//y
		if(min_group.y.center != null && min_group_distance.y.center == min_distance.y) {
			snap_position.y = Math.round(min_group.y.center - config.layer.height / 2);
			success = true;
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.center,
				end_x: config.WIDTH,
				end_y: min_group.y.center,
			};
		}
		else if(min_group.y.start != null && min_group_distance.y.start == min_distance.y) {
			snap_position.y = Math.round(min_group.y.start);
			success = true;
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.start,
				end_x: config.WIDTH,
				end_y: min_group.y.start,
			};
		}
		else if(min_group.y.end != null && min_group_distance.y.end == min_distance.y) {
			snap_position.y = Math.round(min_group.y.end - config.layer.height);
			success = true;
			this.snap_line_info.y = {
				start_x: 0,
				start_y: min_group.y.end,
				end_x: config.WIDTH,
				end_y: min_group.y.end,
			};
		}
		else{
			this.snap_line_info.y = null;
		}

		if(success) {
			return snap_position;
		}

		return null;
	}

	move(direction_x, direction_y, event) {
		if (!this.keyboard_move_start_position) {
			this.keyboard_move_start_position = {
				x: config.layer.x,
				y: config.layer.y
			}
			this.keyboard_linked = this.linked_starts();
		}
		//as in Photoshop: arrow = 1 px, Shift + arrow = 10 px (Ctrl/Cmd + arrow = 50 px)
		var power = 1;
		if (event.shiftKey == true)
			power = 10;
		if (event.ctrlKey == true || event.metaKey)
			power = 50;

		config.layer.x += direction_x * power;
		config.layer.y += direction_y * power;
		var shift_x = config.layer.x - this.keyboard_move_start_position.x;
		var shift_y = config.layer.y - this.keyboard_move_start_position.y;
		(this.keyboard_linked || []).forEach(function (start) {
			start.layer.x = start.x + shift_x;
			start.layer.y = start.y + shift_y;
		});
		config.need_render = true;
	}

	async auto_select_object(e) {
		var params = this.getParams();
		if (params.auto_select == false)
			return;

		var layers_sorted = this.Base_layers.get_sorted_layers();
		var mouse = this.get_mouse_info(e);

		//the layer under the pointer (the active layer anywhere in its frame, see libs/auto-select.js)
		var id = pick_layer(layers_sorted, config.layer.id, {x: mouse.x, y: mouse.y}, (value) => {
			var canvas = this.Base_layers.convert_layer_to_canvas(value.id, null, false);
			return this.check_hit_region(e, canvas.getContext("2d"), value);
		});
		if (id !== null && id != config.layer.id) {
			await app.State.do_action(
				new app.Actions.Select_layer_action(id)
			);
		}
	}

	check_hit_region(e, ctx, layer) {
		var mouse = this.get_mouse_info(e);

		if(layer.type == 'image' && Math.abs(layer.width * layer.height / 1000000) > 5){
			//too big to check using getImageData - use simple way
			if (mouse.x > layer.x && mouse.x < layer.x + layer.width &&
				mouse.y > layer.y && mouse.y < layer.y + layer.height) {
				//hit
				return true;
			}

			return false;
		}

		var data = ctx.getImageData(mouse.x, mouse.y, 1, 1).data;
		var blank = [0, 0, 0, 0];
		if (config.TRANSPARENCY == false) {
			blank = [0, 0, 0, 0];
		}

		if (data[0] != blank[0] || data[1] != blank[1] || data[2] != blank[2]
			|| data[3] != blank[3]) {
			//hit
			return true;
		}

		return false;
	}

}

export default Select_tool_class;
