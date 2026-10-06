/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import app from "./../app.js";
import config from "./../config.js";
import Base_gui_class from "./base-gui.js";
import Base_selection_class from "./base-selection.js";
import Image_trim_class from "./../modules/image/trim.js";
import View_ruler_class from "./../modules/view/ruler.js";
import zoomView from "./../libs/zoomView.js";
import Helper_class from "./../libs/helpers.js";
import { deserialize_layer_mask } from "./../libs/layer-mask.js";
import alertify from "./../../../node_modules/alertifyjs/build/alertify.min.js";
import { t } from '../modules/tools/translate.js';

var instance = null;

/**
 * Layers class - manages layers. Each layer is object with various types. Keys:
 * - id (int)
 * - link (image)
 * - parent_id (int)
 * - name (string)
 * - type (string)
 * - x (int)
 * - y (int)
 * - width (int)
 * - height (int)
 * - width_original (int)
 * - height_original (int)
 * - visible (bool)
 * - is_vector (bool)
 * - hide_selection_if_active (bool)
 * - opacity (0-100)
 * - mask (object|null) layer mask, see libs/layer-mask.js
 * - mask_enabled (bool, default true)
 * - order (int)
 * - composition (string)
 * - rotate (int) 0-359
 * - data (various data here)
 * - params (object)
 * - color {hex}
 * - status (string)
 * - filters (array)
 * - render_function (function)
 */
class Base_layers_class {
	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Base_gui = new Base_gui_class();
		this.Helper = new Helper_class();
		this.Image_trim = new Image_trim_class();
		this.View_ruler = new View_ruler_class();

		this.canvas = document.getElementById("canvas_minipaint");
		this.ctx = document.getElementById("canvas_minipaint").getContext("2d");
		this.ctx_preview = document
			.getElementById("canvas_preview")
			.getContext("2d");
		this.last_zoom = 1;
		this.auto_increment = 1;
		this.stable_dimensions = [];
		this.debug_rendering = false;
		this.render_success = null;
		this.disabled_filter_id = null;
	}

	/**
	 * do preparation on start
	 */
	init() {
		this.init_zoom_lib();

		new app.Actions.Insert_layer_action({}).do();

		var sel_config = {
			enable_background: false,
			enable_borders: true,
			enable_controls: false,
			enable_rotation: false,
			enable_move: false,
			data_function: function () {
				return config.layer;
			},
		};
		this.Base_selection = new Base_selection_class(
			this.ctx,
			sel_config,
			"main"
		);

		this.render(true);
	}

	init_zoom_lib() {
		zoomView.setBounds(0, 0, config.WIDTH, config.HEIGHT);
		zoomView.setContext(this.ctx);
		this.stable_dimensions = [config.WIDTH, config.HEIGHT];
	}

	pre_render() {
		this.ctx.save();
		zoomView.canvasDefault();
		this.ctx.clearRect(
			0,
			0,
			config.WIDTH * config.ZOOM,
			config.HEIGHT * config.ZOOM
		);
	}

	after_render() {
		config.need_render = false;
		config.need_render_changed_params = false;
		this.ctx.restore();
		zoomView.canvasDefault();
	}

	/**
	 * renders all layers objects on main canvas
	 *
	 * @param {bool} force
	 */
	render(force) {
		var _this = this;
		if (force !== true) {
			//request render and exit
			config.need_render = true;
			return;
		}

		if (
			this.stable_dimensions[0] != config.WIDTH ||
			this.stable_dimensions[1] != config.HEIGHT
		) {
			//dimensions changed - re-init zoom lib
			this.init_zoom_lib();
		}

		//no rendering while the history is being replayed (the layers are in a half finished state)
		if (config.need_render == true && config.freeze_render !== true) {
			this.render_success = null;

			if (this.debug_rendering === true) {
				console.log("Rendering...");
			}

			if (this.last_zoom != config.ZOOM) {
				//change zoom
				zoomView.scaleAt(
					this.Base_gui.GUI_preview.zoom_data.x,
					this.Base_gui.GUI_preview.zoom_data.y,
					config.ZOOM / this.last_zoom
				);
			} else if (this.Base_gui.GUI_preview.zoom_data.move_pos != null) {
				//move visible window
				var pos = this.Base_gui.GUI_preview.zoom_data.move_pos;
				var pos_global = zoomView.toScreen(pos);
				zoomView.move(-pos_global.x, -pos_global.y);
				this.Base_gui.GUI_preview.zoom_data.move_pos = null;
			}

			//prepare
			this.pre_render();

			//take data
			var layers_sorted = this.get_sorted_layers();

			zoomView.apply();

			const newCanvas = this.create_new_canvas(
				null,
				config.WIDTH,
				config.HEIGHT
			);

			this.render_objects(this.ctx, newCanvas, layers_sorted, ()=>{
				this.ctx.save();
			});

			//before / after comparison (View > Split Compare)
			this.render_compare();

			//grid
			this.Base_gui.draw_grid(this.ctx);

			//guides
			this.Base_gui.draw_guides(this.ctx);

			//render selected object controls
			this.Base_selection.draw_selection();

			//active tool overlay
			this.render_overlay();

			//render preview
			this.render_preview(layers_sorted);

			//reset
			this.after_render();

			this.last_zoom = config.ZOOM;

			this.Base_gui.GUI_details.render_details();
			this.View_ruler.render_ruler();

			if (this.render_success === false) {
				alertify.error(t("Rendered with errors."));
			}
		}

		requestAnimationFrame(function () {
			_this.render(force);
		});
	}

	/**
	 * the left part of the picture shows the original (config.compare = {before: canvas, x}), a line marks the border
	 */
	render_compare() {
		var compare = config.compare;
		if (!compare || !compare.before) {
			return;
		}
		var ctx = this.ctx;
		var x = Math.max(0, Math.min(config.WIDTH, compare.x));
		var unit = 1 / (config.ZOOM || 1);
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, x, config.HEIGHT);
		ctx.clip();
		ctx.clearRect(0, 0, config.WIDTH, config.HEIGHT);
		ctx.drawImage(compare.before, 0, 0);
		ctx.restore();

		ctx.save();
		ctx.lineWidth = 3 * unit;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, config.HEIGHT);
		ctx.stroke();
		ctx.lineWidth = unit * 1.5;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		//handle
		ctx.beginPath();
		ctx.arc(x, config.HEIGHT / 2, 11 * unit, 0, Math.PI * 2);
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.lineWidth = unit;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.stroke();
		ctx.fillStyle = '#555555';
		ctx.font = (11 * unit) + 'px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('\u2194', x, config.HEIGHT / 2 + unit);
		ctx.restore();
	}

	render_overlay() {
		var render_class = config.TOOL.name;
		var render_function = "render_overlay";

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

	/**
	 * LEGACY: use create_new_canvas();
	 */
	createNewCanvas(ctx, h, w) {
		this.create_new_canvas(ctx, w, h);
	}

	/**
	 * Creates a fresh new canvas with the same height and width as the provided one
	 * @param {canvas.context|null} ctx
	 * @param {number} [width]
	 * @param {number} [height]
	 */
	create_new_canvas(ctx, width, height) {
		const newCanvas = document.createElement("canvas");
		if(width){
			newCanvas.width = width;
		}
		else{
			newCanvas.width = ctx.canvas.width;
		}

		if(height){
			newCanvas.height = height;
		}
		else{
			newCanvas.height = ctx.canvas.height;
		}

		return newCanvas;
	}

	/**
	 * LEGACY: use render_objects()
	 */
	renderObjects(ctx, tempCanvas, layers, prepare, shouldSkip) {
		this.render_objects(ctx, tempCanvas, layers, prepare, shouldSkip);
	}

	/**
	 * Renders objects based on the provided layers
	 * @param {canvas.context} ctx - Main canvas context where it needs to be rendered
	 * @param {canvas} tempCanvas - A temporary canvas which is a copy of the original canvas, but will be used if there will be needed to isolate an effect from others
	 * @param {Object[]} layers - Array of layers
	 * @param {Function} prepare - An optional function to prepare temporary and main canvases before the render if needed
	 * @param {Function} shouldSkip - An optional boolean function for skipping those layers which are not needed to be rendered
	 */
	render_objects(ctx, tempCanvas, layers, prepare, shouldSkip) {
		const tempCtx = tempCanvas.getContext("2d");
		// Prepare the temporary canvas if needed
		prepare && prepare();
		
		for (var i = layers.length - 1; i >= 0; i--) {
			var layer = layers[i];
			const nextLayer = layers[i - 1];

			// If the previous layer has clip masking effect and the current one is not the other end of the pair,
			// then render the temporary canvas for clip masking on top of the current.
			
			// Skip the layer if not needed to be rendered
			if (shouldSkip && shouldSkip(layer)) {
				continue;
			}

			// If the layer or next layer has clip masking effect (source-atop).
			// If there are such layers, this will make sure that layers will be rendered
			// in an isolated temporary canvas
			if (
				layer.composition === "source-atop" ||
				(nextLayer && nextLayer.composition === "source-atop")
			) {
				// Apply the effect in a isolated temporary canvas
				tempCtx.globalAlpha = layer.opacity / 100;
				tempCtx.globalCompositeOperation = layer.composition;

				// If the next layer has the clip masking effect then
				// isolated the shadow filter from temporary canvas and keep that in the original canvas
				if (nextLayer?.composition === "source-atop") {
					// Render the layer
					this.render_object(ctx, layer);
					// Then remove the shadow (if it exists) from the render process in the temporary canvas
					const filters = layer.filters.filter((filter) => {
						return filter.name !== "shadow";
					});
					this.render_object(tempCtx, {
						...layer,
						filters,
					});
				} else {
					// If we are in this condition, then it means this is the last layer of clipped layers pair.
					// Render clipped layers on the temporary canvas
					this.render_object(tempCtx, layer);
					
					// Render the clipped layers on top of the current canvas
					ctx.restore();
					ctx.drawImage(tempCanvas, 0, 0);

					
					// Prepare canvas to since we called restore
					prepare && prepare();
					// Clear temporary canvas 
					tempCtx.globalCompositeOperation = null;
					tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
				}
			} else {
				ctx.globalAlpha = layer.opacity / 100;
				ctx.globalCompositeOperation = layer.composition;
				this.render_object(ctx, layer);
			}
		}

	}

	render_preview(layers) {
		this.Base_gui.GUI_preview.update_preview_size();
		var w = this.Base_gui.GUI_preview.PREVIEW_SIZE.w;
		var h = this.Base_gui.GUI_preview.PREVIEW_SIZE.h;

		this.ctx_preview.save();
		this.ctx_preview.clearRect(0, 0, w, h);

		const newCanvas = this.create_new_canvas(this.ctx_preview);
		newCanvas.getContext("2d").scale(w / config.WIDTH, h / config.HEIGHT);
		this.render_objects(this.ctx_preview, newCanvas, layers, () => {
			this.ctx_preview.save();
			//prepare scale
			this.ctx_preview.scale(w / config.WIDTH, h / config.HEIGHT);
		});

		this.ctx_preview.restore();
		this.Base_gui.GUI_preview.render_preview_active_zone();
	}

	/**
	 * export current layers to given canvas
	 *
	 * @param {canvas.context} ctx
	 * @param {object} object
	 * @param {boolean} is_preview
	 */
	render_object(ctx, object, is_preview) {
		if (object.visible == false || object.type == null) return;

		if (object.mask && object.mask_enabled !== false) {
			var mask_canvas = this.get_mask_canvas(object);
			if (mask_canvas) {
				this.render_masked_object(ctx, object, is_preview, mask_canvas);
				return;
			}
		}

		this.render_object_plain(ctx, object, is_preview);
	}

	/**
	 * Canvas holding the layer mask in its alpha channel (cached per stored mask)
	 *
	 * @param {object} object layer
	 * @returns {HTMLCanvasElement|null}
	 */
	get_mask_canvas(object) {
		if (!this.mask_canvases) {
			this.mask_canvases = new WeakMap();
		}
		var cached = this.mask_canvases.get(object.mask);
		if (cached !== undefined) {
			return cached;
		}
		var mask = deserialize_layer_mask(object.mask);
		var canvas = null;
		if (mask) {
			canvas = document.createElement("canvas");
			canvas.width = mask.width;
			canvas.height = mask.height;
			var ctx = canvas.getContext("2d");
			var image = ctx.createImageData(mask.width, mask.height);
			for (var p = 0, i = 3; p < mask.data.length; p++, i += 4) {
				image.data[i] = mask.data[p];
			}
			ctx.putImageData(image, 0, 0);
		}
		this.mask_canvases.set(object.mask, canvas);
		return canvas;
	}

	/**
	 * Renders a layer with a layer mask: the layer (with its filters) goes to a temporary canvas,
	 * the mask cuts it and the result is drawn with the current alpha and blend mode of the context
	 */
	render_masked_object(ctx, object, is_preview, mask_canvas) {
		var temp = document.createElement("canvas");
		temp.width = ctx.canvas.width;
		temp.height = ctx.canvas.height;
		var temp_ctx = temp.getContext("2d");
		temp_ctx.setTransform(ctx.getTransform());

		this.render_object_plain(temp_ctx, object, is_preview);

		temp_ctx.save();
		temp_ctx.globalCompositeOperation = "destination-in";
		temp_ctx.filter = "none";
		temp_ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
		temp_ctx.rotate(((object.rotate || 0) * Math.PI) / 180);
		temp_ctx.drawImage(mask_canvas, -object.width / 2, -object.height / 2, object.width, object.height);
		temp_ctx.restore();

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(temp, 0, 0);
		ctx.restore();

		temp.width = 1;
		temp.height = 1;
	}

	/**
	 * Renders a layer without its layer mask
	 */
	render_object_plain(ctx, object, is_preview) {
		this.pre_render_object(ctx, object);

		//example with canvas object - other types should overwrite this method
		if (object.type == "image") {
			//image - default behavior
			ctx.save();

			ctx.translate(object.x + object.width / 2, object.y + object.height / 2);
			ctx.rotate((object.rotate * Math.PI) / 180);
			// TODO - Not sure why the check should be with null,
			// if nothing will break, then better to check if it's just truthy
			ctx.drawImage(
				object.link_canvas != null ? object.link_canvas : object.link,
				-object.width / 2,
				-object.height / 2,
				object.width,
				object.height
			);

			ctx.restore();
		} else {
			//call render function from other module
			var render_class = object.render_function[0];
			var render_function = object.render_function[1];
			if (
				typeof this.Base_gui.GUI_tools.tools_modules[render_class] !=
				"undefined"
			) {
				this.Base_gui.GUI_tools.tools_modules[render_class].object[
					render_function
				](ctx, object, is_preview);
			} else {
				this.render_success = false;
				console.log("Error: unknown layer type: " + object.type);
			}
		}

		this.after_render_object(ctx, object);
	}

	/**
	 * Gets called before render_object starts it's job
	 * @param {canvas.context} ctx
	 * @param {object} object
	 */
	pre_render_object(ctx, object) {
		//apply pre-filters
		for (var i in object.filters) {
			var filter = object.filters[i];
			if (filter.id == this.disabled_filter_id) {
				continue;
			}

			filter.name = filter.name.replace("drop-shadow", "shadow");

			//find filter
			var found = false;
			for (var i in this.Base_gui.modules) {
				if (i.indexOf("effects") == -1 || i.indexOf("abstract") > -1) continue;

				var filter_class = this.Base_gui.modules[i];
				var module_name = i.split("/").pop();
				if (module_name == filter.name) {
					//found it
					found = true;
					filter_class.render_pre(ctx, filter, object);
				}
			}
			if (found == false) {
				this.render_success = false;
				console.log("Error: can not find filter: " + filter.name);
			}
		}
	}

	/**
	 * Gets called after when render_object finishes it's job
	 * @param {canvas.context} ctx
	 * @param {object} object
	 */
	after_render_object(ctx, object) {
		//apply post-filters
		for (var i in object.filters) {
			var filter = object.filters[i];
			if (filter.id == this.disabled_filter_id) {
				continue;
			}
			filter.name = filter.name.replace("drop-shadow", "shadow");

			//find filter
			var found = false;
			for (var i in this.Base_gui.modules) {
				if (i.indexOf("effects") == -1 || i.indexOf("abstract") > -1) continue;

				var filter_class = this.Base_gui.modules[i];
				var module_name = i.split("/").pop();
				if (module_name == filter.name) {
					//found it
					found = true;
					filter_class.render_post(ctx, filter, object);
				}
			}
			if (found == false) {
				this.render_success = false;
				console.log("Error: can not find filter: " + filter.name);
			}
		}
	}

	/**
	 * creates new layer
	 *
	 * @param {array} settings
	 * @param {boolean} can_automate
	 */
	async insert(settings, can_automate = true) {
		return app.State.do_action(
			new app.Actions.Insert_layer_action(settings, can_automate)
		);
	}

	/**
	 * autoresize layer, based on dimensions, up - always, if 1 layer - down.
	 *
	 * @param {int} width
	 * @param {int} height
	 * @param {int} layer_id
	 * @param {boolean} can_automate
	 */
	async autoresize(width, height, layer_id, can_automate = true) {
		return app.State.do_action(
			new app.Actions.Autoresize_canvas_action(
				width,
				height,
				layer_id,
				can_automate
			)
		);
	}

	/**
	 * returns layer
	 *
	 * @param {int} id
	 * @returns {object}
	 */
	get_layer(id) {
		if (id == undefined) {
			id = config.layer.id;
		}
		for (var i in config.layers) {
			if (config.layers[i].id == id) {
				return config.layers[i];
			}
		}
		alertify.error(t("Error: can not find layer with id:") + id);
		return null;
	}

	/**
	 * removes layer
	 *
	 * @param {int} id
	 * @param {boolean} force - Force to delete first layer?
	 */
	async delete(id, force) {
		return app.State.do_action(new app.Actions.Delete_layer_action(id, force));
	}

	/*
	 * removes all layers
	 */
	async reset_layers(auto_insert) {
		return app.State.do_action(
			new app.Actions.Reset_layers_action(auto_insert)
		);
	}

	/**
	 * toggle layer visibility
	 *
	 * @param {int} id
	 */
	async toggle_visibility(id) {
		return app.State.do_action(
			new app.Actions.Toggle_layer_visibility_action(id)
		);
	}

	/*
	 * renew layers HTML
	 */
	refresh_gui() {
		this.Base_gui.GUI_layers.render_layers();
	}

	/**
	 * marks layer as selected, active
	 *
	 * @param {int} id
	 */
	async select(id) {
		return app.State.do_action(new app.Actions.Select_layer_action(id));
	}

	/**
	 * change layer opacity
	 *
	 * @param {int} id
	 * @param {int} value 0-100
	 */
	async set_opacity(id, value) {
		value = parseInt(value);
		if (value < 0 || value > 100) {
			//reset
			value = 100;
		}
		return app.State.do_action(
			new app.Actions.Update_layer_action(id, {
				opacity: value,
			})
		);
	}

	/**
	 * clear layer data
	 *
	 * @param {int} id
	 */
	async layer_clear(id) {
		return app.State.do_action(new app.Actions.Clear_layer_action(id));
	}

	/**
	 * move layer up or down
	 *
	 * @param {int} id
	 * @param {int} direction
	 */
	async move(id, direction) {
		return app.State.do_action(
			new app.Actions.Reorder_layer_action(id, direction)
		);
	}

	/**
	 * clone and sort.
	 */
	get_sorted_layers() {
		return config.layers.concat().sort(
			//sort function
			(a, b) => b.order - a.order
		);
	}

	/**
	 * checks if layer empty
	 *
	 * @param {int} id
	 * @returns {Boolean}
	 */
	is_layer_empty(id) {
		var link = this.get_layer(id);

		if (
			(link.width == 0 || link.width === null) &&
			(link.height == 0 || link.height === null) &&
			link.data == null
		) {
			return true;
		}

		return false;
	}

	/**
	 * find next layer
	 *
	 * @param {int} id layer id
	 * @returns {layer|null}
	 */
	find_next(id) {
		id = parseInt(id);
		var link = this.get_layer(id);
		var layers_sorted = this.get_sorted_layers();

		var last = null;
		for (var i = layers_sorted.length - 1; i >= 0; i--) {
			var value = layers_sorted[i];

			if (last != null && last.id == link.id) {
				return value;
			}
			last = value;
		}

		return null;
	}

	/**
	 * find previous layer
	 *
	 * @param {int} id layer id
	 * @returns {layer|null}
	 */
	find_previous(id) {
		id = parseInt(id);
		var link = this.get_layer(id);
		var layers_sorted = this.get_sorted_layers();

		var last = null;
		for (var i in layers_sorted) {
			var value = layers_sorted[i];

			if (last != null && last.id == link.id) {
				return value;
			}
			last = value;
		}

		return null;
	}

	/**
	 * returns global position, for example if canvas is zoomed, it will convert relative mouse position to absolute
	 * at 100% zoom.
	 *
	 * @param {int} x
	 * @param {int} y
	 * @returns {object} keys: x, y
	 */
	get_world_coords(x, y) {
		return zoomView.toWorld(x, y);
	}

	/**
	 * register new live filter
	 *
	 * @param {int} layer_id
	 * @param {string} name
	 * @param {object} params
	 */
	add_filter(layer_id, name, params) {
		return app.State.do_action(
			new app.Actions.Add_layer_filter_action(layer_id, name, params)
		);
	}

	/**
	 * delete live filter
	 *
	 * @param {int} layer_id
	 * @param {string} filter_id
	 */
	delete_filter(layer_id, filter_id) {
		return app.State.do_action(
			new app.Actions.Delete_layer_filter_action(layer_id, filter_id)
		);
	}

	/**
	 * exports all layers to canvas for saving
	 *
	 * @param {canvas.context} ctx
	 * @param {int} layer_id Optional
	 * @param {boolean} is_preview Optional
	 */
	convert_layers_to_canvas(ctx, layer_id = null, is_preview = true) {
		const newCanvas = this.create_new_canvas(ctx);
		const layers_sorted = this.get_sorted_layers();
		this.render_objects(ctx, newCanvas, layers_sorted, ()=>{
			ctx.save();
		}, (value) => {
			if (value.visible == false || value.type == null) {
				return true;
			}
			if (layer_id != null && value.id != layer_id) {
				return true;
			}
		});
	}
	/**
	 * exports (active) layer to canvas for saving
	 *
	 * @param {int} layer_id or current layer by default
	 * @param {boolean} actual_area used for resized image. Default is false.
	 * @param {boolean} can_trim default is true
	 * @returns {canvas}
	 */
	convert_layer_to_canvas(layer_id, actual_area = false, can_trim) {
		if (actual_area == null) actual_area = false;
		if (layer_id == null) layer_id = config.layer.id;
		var link = this.get_layer(layer_id);
		var offset_x = 0;
		var offset_y = 0;

		//create tmp canvas
		var canvas = document.createElement("canvas");
		if (actual_area === true && link.type == "image") {
			canvas.width = link.width_original;
			canvas.height = link.height_original;
			can_trim = false;
		} else {
			canvas.width = Math.max(link.width, config.WIDTH);
			canvas.height = Math.max(link.height, config.HEIGHT);
		}

		//add data
		if (actual_area === true && link.type == "image") {
			canvas.getContext("2d").drawImage(link.link, 0, 0);
		} else {
			this.render_object(canvas.getContext("2d"), link);
		}

		//trim
		if ((can_trim == true || can_trim == undefined) && link.type != null) {
			var trim_info = this.Image_trim.get_trim_info(layer_id);
			if (
				trim_info.left > 0 ||
				trim_info.top > 0 ||
				trim_info.right > 0 ||
				trim_info.bottom > 0
			) {
				offset_x = trim_info.left;
				offset_y = trim_info.top;

				var w = canvas.width - trim_info.left - trim_info.right;
				var h = canvas.height - trim_info.top - trim_info.bottom;
				if (w > 1 && h > 1) {
					this.Helper.change_canvas_size(canvas, w, h, offset_x, offset_y);
				}
			}
		}

		canvas.dataset.x = offset_x;
		canvas.dataset.y = offset_y;

		return canvas;
	}

	/**
	 * updates layer image data
	 *
	 * @param {canvas} canvas
	 * @param {int} layer_id (optional)
	 */
	update_layer_image(canvas, layer_id) {
		return app.State.do_action(
			new app.Actions.Update_layer_image_action(canvas, layer_id)
		);
	}

	/**
	 * returns canvas dimensions.
	 *
	 * @returns {object}
	 */
	get_dimensions() {
		return {
			width: config.WIDTH,
			height: config.HEIGHT,
		};
	}

	/**
	 * returns all layers
	 *
	 * @returns {array}
	 */
	get_layers() {
		return config.layers;
	}

	/**
	 * disabled filter by id
	 *
	 * @param filter_id
	 */
	disable_filter(filter_id) {
		this.disabled_filter_id = filter_id;
	}

	/**
	 * finds layer filter by filter ID
	 *
	 * @param filter_id
	 * @param filter_name
	 * @param layer_id
	 * @returns {object}
	 */
	find_filter_by_id(filter_id, filter_name, layer_id) {
		if (typeof layer_id == "undefined") {
			var layer = config.layer;
		} else {
			var layer = this.get_layer(layer_id);
		}

		var filter = {};
		for (var i in layer.filters) {
			if (
				layer.filters[i].name == filter_name &&
				layer.filters[i].id == filter_id
			) {
				return layer.filters[i].params;
			}
		}

		return filter;
	}
}

export default Base_layers_class;
