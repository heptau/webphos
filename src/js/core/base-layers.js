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
import { fill_alpha, split_halo_filters } from "./../libs/layer-fill.js";
import { effective_alpha, plan_groups } from "./../libs/layer-groups.js";
import { make_identity, stack_signature, split_for_cache, preview_scale } from "./../libs/layer-signature.js";
import { is_default as blend_if_is_default, apply_blend_if } from "./../libs/blend-if.js";
import { adjust_image, mix_adjusted } from "./../libs/adjustment-layers.js";

let instance = null;

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
 * - fill_opacity (0-100, default 100) opacity of the layer's own pixels, layer styles are not faded
 * - mask (object|null) layer mask, see libs/layer-mask.js
 * - mask_enabled (bool, default true)
 * - locked (bool), group (string|null), color_label (string|null), link_id (number|null), blend_if (object|null)
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

		const sel_config = {
			enable_background: false,
			enable_borders: true,
			enable_controls: false,
			enable_rotation: false,
			enable_move: false,
			data_function () {
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

			if (this.last_zoom != config.ZOOM) {
				//change zoom
				zoomView.scaleAt(
					this.Base_gui.GUI_preview.zoom_data.x,
					this.Base_gui.GUI_preview.zoom_data.y,
					config.ZOOM / this.last_zoom
				);
			} else if (this.Base_gui.GUI_preview.zoom_data.move_pos != null) {
				//move visible window
				const pos = this.Base_gui.GUI_preview.zoom_data.move_pos;
				const pos_global = zoomView.toScreen(pos);
				zoomView.move(-pos_global.x, -pos_global.y);
				this.Base_gui.GUI_preview.zoom_data.move_pos = null;
			}

			//prepare
			this.pre_render();

			//take data
			const layers_sorted = this.get_sorted_layers();

			zoomView.apply();

			const newCanvas = this.create_new_canvas(
				null,
				config.WIDTH,
				config.HEIGHT
			);

			this.render_objects_cached(this.ctx, newCanvas, layers_sorted, ()=>{
				this.ctx.save();
			});

			//before / after comparison (View > Split Compare)
			this.render_compare();

			//grid
			this.Base_gui.draw_grid(this.ctx);
			this.Base_gui.draw_pixel_grid(this.ctx);

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

		requestAnimationFrame(() => {
			this.render(force);
		});
	}

	/**
	 * the left part of the picture shows the original (config.compare = {before: canvas, x}), a line marks the border
	 */
	render_compare() {
		const compare = config.compare;
		if (!compare || !compare.before) {
			return;
		}
		const ctx = this.ctx;
		const x = Math.max(0, Math.min(config.WIDTH, compare.x));
		const unit = 1 / (config.ZOOM || 1);
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
		ctx.font = `${11 * unit  }px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('\u2194', x, config.HEIGHT / 2 + unit);
		ctx.restore();
	}

	render_overlay() {
		const render_class = config.TOOL.name;
		const render_function = "render_overlay";

		if (
			typeof this.Base_gui.GUI_tools.tools_modules[render_class].object[
				render_function
			] != "undefined"
		) {
			this.Base_gui.GUI_tools.tools_modules[render_class].object[
				render_function
			](this.ctx);
		}
		//an overlay of a command that is running (for example the handles of Edit > Distort)
		if (typeof config.view_overlay == "function") {
			config.view_overlay(this.ctx);
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
		//a group with its own opacity or blend mode is drawn on its own first
		const plan = plan_groups(layers);

		//Adjustment and Blend If layers work on everything below them. Drawing that again for every one of them is slow
		//(n layers cost n times n), so everything up to the top one of them is drawn once on a canvas of its own, that
		//already holds what is below the next one; the layers above it are drawn directly.
		const top = plan.findIndex((entry) => entry.kind !== "group" && this.needs_backdrop(entry));
		const clipped = plan.some((entry) => entry.composition === "source-atop");
		if (top < 0 || clipped) {
			this.render_objects_flat(ctx, tempCanvas, plan, prepare, shouldSkip);
			return;
		}
		const width = Math.max(1, config.WIDTH);
		const height = Math.max(1, config.HEIGHT);
		const make = () => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			return canvas;
		};
		const accumulated = make();
		const accumulated_ctx = accumulated.getContext("2d", {willReadFrequently: true});
		this.render_objects_flat(accumulated_ctx, make(), plan.slice(top), () => {
			accumulated_ctx.save();
		}, shouldSkip, true);
		prepare && prepare();
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		ctx.drawImage(accumulated, 0, 0);
		accumulated.width = accumulated.height = 1;
		this.render_objects_flat(ctx, tempCanvas, plan.slice(0, top), null, shouldSkip);
	}

	/**
	 * Like render_objects for the picture on the screen: the layers below the active one do not change while the active
	 * layer is painted on or moved, so they are drawn once and kept (see libs/layer-signature.js). Everything is drawn
	 * again when one of them changes.
	 */
	render_objects_cached(ctx, tempCanvas, layers, prepare, shouldSkip) {
		this.track_pointer();
		const split = config.layer ? split_for_cache(layers, config.layer.id, config.ZOOM || 1) : null;
		const pixels = Math.max(1, config.WIDTH) * Math.max(1, config.HEIGHT);
		if (split == null || pixels > 100 * 1000 * 1000) {
			this.free_backdrop_cache();
			this.render_objects(ctx, tempCanvas, layers, prepare, shouldSkip);
			return;
		}
		const backdrop = this.get_backdrop_cache(split.lower);
		const plan = plan_groups(split.upper);
		const width = Math.max(1, config.WIDTH);
		const height = Math.max(1, config.HEIGHT);
		const backdrop_dependent = plan.some((entry) => entry.kind !== "group" && this.needs_backdrop(entry));
		if (backdrop_dependent) {
			//an adjustment or Blend If layer above the active one works on the cached picture plus the layers above it.
			//The picture and its small copy in the Navigator are drawn one after the other with the same layers, so
			//the result is kept for the second one.
			//While something is dragged the work is done on a smaller copy (like the preview of Photoshop), the full size
			//follows when the mouse button is up.
			const scale = this.interactive_scale(width, height);
			const key = `${this.backdrop_cache.key  }|${stack_signature(split.upper, this.layer_identity, "")}|${  scale}`;
			let running = this.running_cache && this.running_cache.key === key ? this.running_cache.canvas : null;
			if (running == null) {
				if (this.running_cache) {
					this.running_cache.canvas.width = this.running_cache.canvas.height = 1;
				}
				running = document.createElement("canvas");
				running.width = Math.max(1, Math.round(width * scale));
				running.height = Math.max(1, Math.round(height * scale));
				const running_ctx = running.getContext("2d", {willReadFrequently: true});
				running_ctx.drawImage(backdrop, 0, 0, running.width, running.height);
				running_ctx.scale(running.width / width, running.height / height);
				const scratch = document.createElement("canvas");
				scratch.width = running.width;
				scratch.height = running.height;
				this.render_objects_flat(running_ctx, scratch, plan, () => {
					running_ctx.save();
				}, shouldSkip, true);
				scratch.width = scratch.height = 1;
				this.running_cache = {key, canvas: running};
				this.low_resolution_shown = scale < 1;
			}
			prepare && prepare();
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
			ctx.drawImage(running, 0, 0, width, height);
			return;
		}
		this.free_running_cache();
		prepare && prepare();
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		ctx.drawImage(backdrop, 0, 0);
		this.render_objects_flat(ctx, tempCanvas, plan, null, shouldSkip);
	}

	/**
	 * @param {number} width width of the document
	 * @param {number} height
	 * @returns {number} 1, or the share of the size that is used for the preview while the mouse button is down on a
	 *   document that is big enough to need it
	 */
	interactive_scale(width, height) {
		this.track_pointer();
		return this.pointer_down ? preview_scale(width, height) : 1;
	}

	/**
	 * Remembers if a mouse button (or a finger) is down; when it goes up and a smaller preview was shown, the picture is
	 * drawn again in full size
	 */
	track_pointer() {
		if (this.pointer_tracked || typeof document === "undefined") {
			return;
		}
		this.pointer_tracked = true;
		this.pointer_down = false;
		const down = () => {
			this.pointer_down = true;
		};
		const up = () => {
			if (!this.pointer_down) {
				return;
			}
			this.pointer_down = false;
			if (this.low_resolution_shown) {
				this.low_resolution_shown = false;
				config.need_render = true;
			}
		};
		document.addEventListener("mousedown", down, true);
		document.addEventListener("touchstart", down, true);
		document.addEventListener("mouseup", up, true);
		document.addEventListener("touchend", up, true);
		document.addEventListener("touchcancel", up, true);
		window.addEventListener("blur", up);
	}

	free_backdrop_cache() {
		if (this.backdrop_cache) {
			this.backdrop_cache.canvas.width = this.backdrop_cache.canvas.height = 1;
			this.backdrop_cache = null;
		}
		this.free_running_cache();
	}

	free_running_cache() {
		if (this.running_cache) {
			this.running_cache.canvas.width = this.running_cache.canvas.height = 1;
			this.running_cache = null;
		}
	}

	/**
	 * The layers below the active one drawn on a canvas of the size of the document (drawn again only when their
	 * signature changes)
	 *
	 * @param {object[]} lower top first
	 * @returns {HTMLCanvasElement}
	 */
	get_backdrop_cache(lower) {
		if (!this.layer_identity) {
			this.layer_identity = make_identity();
		}
		const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.size : 0;
		const key = stack_signature(lower, this.layer_identity, [config.WIDTH, config.HEIGHT, this.disabled_filter_id, fonts].join("x"));
		if (this.backdrop_cache && this.backdrop_cache.key === key) {
			return this.backdrop_cache.canvas;
		}
		if (this.backdrop_cache) {
			this.backdrop_cache.canvas.width = this.backdrop_cache.canvas.height = 1;
		}
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, config.WIDTH);
		canvas.height = Math.max(1, config.HEIGHT);
		//a canvas that is read often is drawn by the processor, like the one that render_objects uses for the layers
		//above, so the colors come out the same (the graphics card rounds blend modes differently)
		const canvas_ctx = canvas.getContext("2d", {willReadFrequently: true});
		const scratch = document.createElement("canvas");
		scratch.width = canvas.width;
		scratch.height = canvas.height;
		this.render_objects(canvas_ctx, scratch, lower, () => {
			canvas_ctx.save();
		});
		scratch.width = scratch.height = 1;
		this.backdrop_cache = {key, canvas};
		return canvas;
	}

	/**
	 * @param {object} layer
	 * @returns {boolean} the layer is drawn from what is below it (adjustment layer, Blend If)
	 */
	needs_backdrop(layer) {
		return layer.type === "adjustment" || Boolean(layer.blend_if && blend_if_is_default(layer.blend_if) == false);
	}

	/**
	 * Draws a group that has its own opacity / blend mode: its layers go to a canvas of their own (the size of the
	 * document), which is then put on the picture with the opacity and blend mode of the group.
	 *
	 * @param {CanvasRenderingContext2D} ctx where the group goes
	 * @param {{name: string, props: {opacity: number, composition: string, mask: object|null}, entries: object[]}} group
	 * @param {Function} [shouldSkip]
	 */
	render_group(ctx, group, shouldSkip) {
		const width = Math.max(1, config.WIDTH);
		const height = Math.max(1, config.HEIGHT);
		const make = () => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			return canvas;
		};
		const own = make();
		const own_ctx = own.getContext("2d");
		this.render_objects_flat(own_ctx, make(), group.entries, () => {
			own_ctx.save();
		}, shouldSkip, true);
		//the mask of the group (in the pixels of the document) cuts what the layers made
		const mask_canvas = group.props.mask ? this.get_mask_canvas({mask: group.props.mask}) : null;
		if (mask_canvas) {
			own_ctx.globalCompositeOperation = "destination-in";
			own_ctx.drawImage(mask_canvas, 0, 0, width, height);
			own_ctx.globalCompositeOperation = "source-over";
		}
		ctx.globalAlpha = group.props.opacity / 100;
		ctx.globalCompositeOperation = group.props.composition;
		ctx.drawImage(own, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		own.width = own.height = 1;
	}

	/**
	 * Like render_objects, but the layers are used as they are (groups are already planned or not wanted)
	 */
	render_objects_flat(ctx, tempCanvas, layers, prepare, shouldSkip, inline_backdrop) {
		const tempCtx = tempCanvas.getContext("2d");
		// Prepare the temporary canvas if needed
		prepare && prepare();

		for (let i = layers.length - 1; i >= 0; i--) {
			const layer = layers[i];
			const nextLayer = layers[i - 1];

			// If the previous layer has clip masking effect and the current one is not the other end of the pair,
			// then render the temporary canvas for clip masking on top of the current.

			// A group drawn on its own (its layers are skipped inside of it if they are not needed)
			if (layer.kind === "group") {
				this.render_group(ctx, layer, shouldSkip);
				continue;
			}

			// Skip the layer if not needed to be rendered
			if (shouldSkip && shouldSkip(layer)) {
				continue;
			}

			// An adjustment layer changes the colors of everything below it
			if (layer.type === "adjustment") {
				if (layer.visible !== false) {
					this.render_adjustment(ctx, layer, layers.slice(i + 1), shouldSkip, inline_backdrop === true ? ctx : null);
				}
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
				tempCtx.globalAlpha = effective_alpha(layer);
				tempCtx.globalCompositeOperation = layer.composition;

				// If the next layer has the clip masking effect then
				// isolated the shadow filter from temporary canvas and keep that in the original canvas
				if (nextLayer?.composition === "source-atop") {
					// Render the base layer (a clipped layer in the middle of a stack is drawn only through the temporary canvas)
					if (layer.composition !== "source-atop") {
						ctx.globalAlpha = effective_alpha(layer);
						ctx.globalCompositeOperation = layer.composition;
						this.render_object(ctx, layer);
					}
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
			} else if (layer.blend_if && blend_if_is_default(layer.blend_if) == false) {
				//Blend If - the layer is limited by its own brightness and by what is below it
				ctx.globalAlpha = effective_alpha(layer);
				ctx.globalCompositeOperation = layer.composition;
				this.render_blend_if(ctx, layer, layers.slice(i + 1), shouldSkip, inline_backdrop === true ? ctx : null);
			} else {
				ctx.globalAlpha = effective_alpha(layer);
				ctx.globalCompositeOperation = layer.composition;
				this.render_object(ctx, layer);
			}
		}

	}

	/**
	 * Draws an adjustment layer: everything below it is drawn on its own canvas (the size of the document), the colors
	 * are changed there (only as much as the opacity and the layer mask say) and the result replaces the picture.
	 *
	 * @param {CanvasRenderingContext2D} ctx the picture with the layers below already drawn
	 * @param {object} layer adjustment layer, params = {adjustment: key, settings: {...}}
	 * @param {object[]} below the layers below this one (top first)
	 * @param {Function} [shouldSkip]
	 */
	render_adjustment(ctx, layer, below, shouldSkip, current) {
		const params = layer.params || {};
		//with `current` the work is done at the size of that canvas (it can be a smaller copy of the document while
		//something is being dragged, then its transform scales the layers to it)
		const width = current ? current.canvas.width : Math.max(1, config.WIDTH);
		const height = current ? current.canvas.height : Math.max(1, config.HEIGHT);
		const make = () => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			return canvas;
		};

		//`current` is a canvas of the size of the document that already holds everything below the layer
		const backdrop = current ? null : make();
		const backdrop_ctx = current || backdrop.getContext("2d", {willReadFrequently: true});
		if (!current && below.length > 0) {
			this.render_objects_flat(backdrop_ctx, make(), below, () => {
				backdrop_ctx.save();
			}, shouldSkip);
		}
		const original = backdrop_ctx.getImageData(0, 0, width, height);
		const adjusted = adjust_image(original, params.adjustment, params.settings);

		//the layer mask limits the change to a part of the picture
		let weights = null;
		const mask_canvas = layer.mask && layer.mask_enabled !== false ? this.get_mask_canvas(layer) : null;
		if (mask_canvas) {
			const mask_layer = make();
			const mask_ctx = mask_layer.getContext("2d", {willReadFrequently: true});
			if (current) {
				mask_ctx.setTransform(current.getTransform());
			}
			mask_ctx.drawImage(mask_canvas, layer.x, layer.y, layer.width, layer.height);
			const mask_data = mask_ctx.getImageData(0, 0, width, height).data;
			weights = new Uint8ClampedArray(width * height);
			for (let p = 0; p < weights.length; p++) {
				weights[p] = mask_data[p * 4 + 3];
			}
			mask_layer.width = mask_layer.height = 1;
		}
		mix_adjusted(original, adjusted, layer.opacity / 100, weights);
		backdrop_ctx.putImageData(new ImageData(adjusted.data, width, height), 0, 0);
		if (current) {
			return; //the adjusted picture is already where it belongs
		}

		//the adjusted picture takes the place of the one that was drawn
		ctx.save();
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "copy";
		ctx.drawImage(backdrop, 0, 0);
		ctx.restore();
		backdrop.width = backdrop.height = 1;
	}

	/**
	 * Draws a layer with Blend If: the layer and everything below it are drawn on their own canvases (the size of the
	 * document), the layer loses its pixels where the ranges say so and the rest goes to the picture.
	 *
	 * @param {CanvasRenderingContext2D} ctx where the layer goes (its alpha and blend mode are already set)
	 * @param {object} layer
	 * @param {object[]} below the layers below this one (top first)
	 * @param {Function} [shouldSkip]
	 */
	render_blend_if(ctx, layer, below, shouldSkip, current) {
		const width = current ? current.canvas.width : Math.max(1, config.WIDTH);
		const height = current ? current.canvas.height : Math.max(1, config.HEIGHT);
		const make = () => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			return canvas;
		};

		//`current` is a canvas of the size of the document that already holds everything below the layer
		const backdrop = current ? null : make();
		const backdrop_ctx = current || backdrop.getContext("2d", {willReadFrequently: true});
		if (!current && below.length > 0) {
			this.render_objects_flat(backdrop_ctx, make(), below, () => {
				backdrop_ctx.save();
			}, shouldSkip);
		}

		const own = make();
		const own_ctx = own.getContext("2d", {willReadFrequently: true});
		if (current) {
			own_ctx.setTransform(current.getTransform());
		}
		this.render_object(own_ctx, layer);

		const image = own_ctx.getImageData(0, 0, width, height);
		apply_blend_if(image, backdrop_ctx.getImageData(0, 0, width, height), layer.blend_if);
		own_ctx.putImageData(image, 0, 0);

		if (current) {
			//the canvas of the work has its own size and transform, `own` is already in its pixels
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.drawImage(own, 0, 0);
			ctx.restore();
		} else {
			ctx.drawImage(own, 0, 0);
		}
		if (backdrop) {
			backdrop.width = backdrop.height = 1;
		}
		own.width = own.height = 1;
	}

	render_preview(layers) {
		this.Base_gui.GUI_preview.update_preview_size();
		const w = this.Base_gui.GUI_preview.PREVIEW_SIZE.w;
		const h = this.Base_gui.GUI_preview.PREVIEW_SIZE.h;

		this.ctx_preview.save();
		this.ctx_preview.clearRect(0, 0, w, h);

		const newCanvas = this.create_new_canvas(this.ctx_preview);
		newCanvas.getContext("2d").scale(w / config.WIDTH, h / config.HEIGHT);
		this.render_objects_cached(this.ctx_preview, newCanvas, layers, () => {
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
			const mask_canvas = this.get_mask_canvas(object);
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
		const cached = this.mask_canvases.get(object.mask);
		if (cached !== undefined) {
			return cached;
		}
		const mask = deserialize_layer_mask(object.mask);
		let canvas = null;
		if (mask) {
			canvas = document.createElement("canvas");
			canvas.width = mask.width;
			canvas.height = mask.height;
			const ctx = canvas.getContext("2d");
			const image = ctx.createImageData(mask.width, mask.height);
			for (let p = 0, i = 3; p < mask.data.length; p++, i += 4) {
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
		const temp = document.createElement("canvas");
		temp.width = ctx.canvas.width;
		temp.height = ctx.canvas.height;
		const temp_ctx = temp.getContext("2d");
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
		if (fill_alpha(object) < 1 && split_halo_filters(object.filters).halo.length > 0) {
			this.render_object_with_halo(ctx, object, is_preview);
			return;
		}
		this.pre_render_object(ctx, object);

		//fill opacity fades the pixels of the layer, but not its styles (drawn in the pre/post render)
		const alpha_before_fill = ctx.globalAlpha;
		ctx.globalAlpha = alpha_before_fill * fill_alpha(object);

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
			const render_class = object.render_function[0];
			const render_function = object.render_function[1];
			if (
				typeof this.Base_gui.GUI_tools.tools_modules[render_class] !=
				"undefined"
			) {
				this.Base_gui.GUI_tools.tools_modules[render_class].object[
					render_function
				](ctx, object, is_preview);
			} else {
				this.render_success = false;
				console.error(`Error: unknown layer type: ${  object.type}`);
			}
		}

		ctx.globalAlpha = alpha_before_fill;
		this.after_render_object(ctx, object);
	}

	/**
	 * A layer with a fill opacity below 100 and a shadow or glow: the pixels fade, the shadow / glow stays as strong
	 * as it is. The halo is what the shadow and glow add to the bare pixels, so it is drawn on its own first.
	 */
	render_object_with_halo(ctx, object, is_preview) {
		const parts = split_halo_filters(object.filters);
		const make = () => {
			const temp = document.createElement("canvas");
			temp.width = ctx.canvas.width;
			temp.height = ctx.canvas.height;
			const temp_ctx = temp.getContext("2d");
			temp_ctx.setTransform(ctx.getTransform());
			return temp;
		};
		const full = {fill_opacity: 100};

		//the bare pixels and the pixels with the halos, both at full strength
		const bare = make();
		this.render_object_plain(bare.getContext("2d"), Object.assign({}, object, full, {filters: []}), is_preview);
		const halo = make();
		this.render_object_plain(halo.getContext("2d"), Object.assign({}, object, full, {filters: parts.halo}), is_preview);
		const halo_ctx = halo.getContext("2d");
		halo_ctx.save();
		halo_ctx.setTransform(1, 0, 0, 1, 0, 0);
		halo_ctx.globalCompositeOperation = "destination-out";
		halo_ctx.drawImage(bare, 0, 0);
		halo_ctx.restore();

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(halo, 0, 0);
		ctx.restore();

		//the pixels (and the other styles) with the usual fade
		this.render_object_plain(ctx, Object.assign({}, object, {filters: parts.rest}), is_preview);

		bare.width = 1;
		bare.height = 1;
		halo.width = 1;
		halo.height = 1;
	}

	/**
	 * Gets called before render_object starts it's job
	 * @param {canvas.context} ctx
	 * @param {object} object
	 */
	pre_render_object(ctx, object) {
		//apply pre-filters
		for (let i in object.filters) {
			const filter = object.filters[i];
			if (filter.id == this.disabled_filter_id) {
				continue;
			}

			filter.name = filter.name.replace("drop-shadow", "shadow");

			//find filter
			let found = false;
			for (i in this.Base_gui.modules) {
				if (i.indexOf("effects") == -1 || i.indexOf("abstract") > -1) continue;

				const filter_class = this.Base_gui.modules[i];
				const module_name = i.split("/").pop();
				if (module_name == filter.name) {
					//found it
					found = true;
					filter_class.render_pre(ctx, filter, object);
				}
			}
			if (found == false) {
				this.render_success = false;
				console.error(`Error: can not find filter: ${  filter.name}`);
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
		for (let i in object.filters) {
			const filter = object.filters[i];
			if (filter.id == this.disabled_filter_id) {
				continue;
			}
			filter.name = filter.name.replace("drop-shadow", "shadow");

			//find filter
			let found = false;
			for (i in this.Base_gui.modules) {
				if (i.indexOf("effects") == -1 || i.indexOf("abstract") > -1) continue;

				const filter_class = this.Base_gui.modules[i];
				const module_name = i.split("/").pop();
				if (module_name == filter.name) {
					//found it
					found = true;
					filter_class.render_post(ctx, filter, object);
				}
			}
			if (found == false) {
				this.render_success = false;
				console.error(`Error: can not find filter: ${  filter.name}`);
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
		for (const i in config.layers) {
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
		const link = this.get_layer(id);

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
		const link = this.get_layer(id);
		const layers_sorted = this.get_sorted_layers();

		let last = null;
		for (let i = layers_sorted.length - 1; i >= 0; i--) {
			const value = layers_sorted[i];

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
		const link = this.get_layer(id);
		const layers_sorted = this.get_sorted_layers();

		let last = null;
		for (const i in layers_sorted) {
			const value = layers_sorted[i];

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
	 */
	convert_layers_to_canvas(ctx, layer_id = null) {
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
		const link = this.get_layer(layer_id);
		let offset_x = 0;
		let offset_y = 0;

		//create tmp canvas
		const canvas = document.createElement("canvas");
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
			const trim_info = this.Image_trim.get_trim_info(layer_id);
			if (
				trim_info.left > 0 ||
				trim_info.top > 0 ||
				trim_info.right > 0 ||
				trim_info.bottom > 0
			) {
				offset_x = trim_info.left;
				offset_y = trim_info.top;

				const w = canvas.width - trim_info.left - trim_info.right;
				const h = canvas.height - trim_info.top - trim_info.bottom;
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
		let layer;
		if (typeof layer_id == "undefined") {
			layer = config.layer;
		} else {
			layer = this.get_layer(layer_id);
		}

		const filter = {};
		for (const i in layer.filters) {
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
