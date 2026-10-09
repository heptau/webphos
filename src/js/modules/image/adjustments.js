import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Base_layers_class from './../../core/base-layers.js';
import Edit_selection_class from './../edit/selection.js';
import { selection_to_layer_rect } from './../../libs/selection-area.js';
import { blend_with_mask } from './../../libs/selection-mask.js';
import * as Adjustments from './../../libs/adjustments.js';
import { match_color } from './../../libs/color-match.js';
import { smudgeBlend } from './../../libs/adjustments.js';
import * as Filters from './../../libs/filters.js';
import * as Distort from './../../libs/distort.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { build_curve_editor } from './curve_editor.js';
import { t } from '../tools/translate.js';

let instance = null;

/**
 * Photoshop-like Image > Adjustments: Levels, Brightness/Contrast, Hue/Saturation, Exposure, Auto Contrast, Invert, Desaturate, Threshold, Posterize, Add Noise
 */
class Image_adjustments_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.POP = new Dialog_class();
		this.Base_layers = new Base_layers_class();
		this.Edit_selection = new Edit_selection_class();
	}

	can_apply() {
		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return false;
		}
		return true;
	}

	/**
	 * Image > Adjustments > Match Color - takes the colors from another image layer of the document
	 */
	match_color() {
		if (this.can_apply() == false) {
			return;
		}
		const others = config.layers.filter((layer) => layer.type == 'image' && layer.id != config.layer.id);
		if (others.length == 0) {
			alertify.warning(t('Add another image layer first - its colors will be used.'));
			return;
		}
		const names = others.map((layer) => `${layer.name  } #${  layer.id}`);
		const cache = {};
		const reference_for = (value) => {
			if (cache[value]) {
				return cache[value];
			}
			const layer = others[names.indexOf(value)] || others[0];
			const canvas = this.Base_layers.convert_layer_to_canvas(layer.id, true);
			//statistics do not need full resolution
			const scale = Math.min(1, 256 / Math.max(canvas.width, canvas.height));
			const small = document.createElement('canvas');
			small.width = Math.max(1, Math.round(canvas.width * scale));
			small.height = Math.max(1, Math.round(canvas.height * scale));
			const ctx = small.getContext('2d', {willReadFrequently: true});
			ctx.drawImage(canvas, 0, 0, small.width, small.height);
			cache[value] = ctx.getImageData(0, 0, small.width, small.height);
			return cache[value];
		};
		this.show_dialog('Match Color', [
			{name: "reference", title: "Colors from:", type: 'select', values: names, value: names[0]},
			{name: "strength", title: "Strength:", value: 100, range: [0, 100]},
		], (img, params) => match_color(img, reference_for(params.reference), params.strength));
	}

	invert() {
		this.apply_direct((img) => Adjustments.invert(img));
	}

	desaturate() {
		this.apply_direct((img) => Adjustments.desaturate(img));
	}

	levels() {
		this.show_dialog('Levels', [
			{name: "channel", title: "Channel:", values: ['rgb', 'red', 'green', 'blue']},
			{name: "in_black", title: "Input black:", value: 0, range: [0, 254]},
			{name: "gamma", title: "Gamma:", value: 1, range: [0.1, 5], step: 0.01},
			{name: "in_white", title: "Input white:", value: 255, range: [1, 255]},
			{name: "out_black", title: "Output black:", value: 0, range: [0, 255]},
			{name: "out_white", title: "Output white:", value: 255, range: [0, 255]},
		], (img, params) => Adjustments.levels(img, params));
	}

	brightness_contrast() {
		this.show_dialog('Brightness/Contrast', [
			{name: "brightness", title: "Brightness:", value: 0, range: [-100, 100]},
			{name: "contrast", title: "Contrast:", value: 0, range: [-100, 100]},
		], (img, params) => Adjustments.brightnessContrast(img, params.brightness, params.contrast));
	}

	hue_saturation() {
		this.show_dialog('Hue/Saturation', [
			{name: "hue", title: "Hue:", value: 0, range: [-180, 180]},
			{name: "saturation", title: "Saturation:", value: 0, range: [-100, 100]},
			{name: "lightness", title: "Lightness:", value: 0, range: [-100, 100]},
			{name: "colorize", title: "Colorize:", value: false},
		], (img, params) => Adjustments.hueSaturation(img, params));
	}

	vibrance() {
		this.show_dialog('Vibrance', [
			{name: "vibrance", title: "Vibrance:", value: 0, range: [-100, 100]},
			{name: "saturation", title: "Saturation:", value: 0, range: [-100, 100]},
		], (img, params) => Adjustments.vibrance(img, params));
	}

	replace_color() {
		this.show_dialog('Replace Color', [
			{name: "color", title: "Color:", value: '#ff0000', type: 'color'},
			{name: "fuzziness", title: "Fuzziness:", value: 40, range: [0, 200]},
			{heading: 'Result'},
			{name: "hue", title: "Hue:", value: 0, range: [-180, 180]},
			{name: "saturation", title: "Saturation:", value: 0, range: [-100, 100]},
			{name: "lightness", title: "Lightness:", value: 0, range: [-100, 100]},
		], (img, params) => Adjustments.replaceColor(img, params));
	}

	black_white() {
		this.show_dialog('Black and White', [
			{name: "reds", title: "Reds:", value: 40, range: [-200, 300]},
			{name: "yellows", title: "Yellows:", value: 60, range: [-200, 300]},
			{name: "greens", title: "Greens:", value: 40, range: [-200, 300]},
			{name: "cyans", title: "Cyans:", value: 60, range: [-200, 300]},
			{name: "blues", title: "Blues:", value: 20, range: [-200, 300]},
			{name: "magentas", title: "Magentas:", value: 80, range: [-200, 300]},
			{name: "tint", title: "Tint:", value: false},
			{name: "tint_color", title: "Tint color:", value: '#e1c08c', type: 'color'},
		], (img, params) => Adjustments.blackWhite(img, params));
	}

	solarize() {
		this.show_dialog('Solarize', [
			{name: "threshold", title: "Threshold:", value: 128, range: [0, 255]},
		], (img, params) => Adjustments.solarize(img, params.threshold));
	}

	color_to_alpha() {
		this.show_dialog('Color to Alpha', [
			{name: "color", title: "Color:", value: '#ffffff', type: 'color'},
			{name: "threshold", title: "Threshold:", value: 0, range: [0, 99]},
		], (img, params) => Adjustments.colorToAlpha(img, params));
	}

	emboss() {
		this.show_dialog('Emboss', [
			{name: "angle", title: "Angle:", value: 135, range: [0, 360]},
			{name: "amount", title: "Amount:", value: 100, range: [1, 500]},
		], (img, params) => Filters.emboss(img, params));
	}

	find_edges() {
		this.apply_direct((img) => Filters.findEdges(img));
	}

	exposure() {
		this.show_dialog('Exposure', [
			{name: "exposure", title: "Exposure:", value: 0, range: [-5, 5], step: 0.05},
			{name: "offset", title: "Offset:", value: 0, range: [-0.5, 0.5], step: 0.01},
			{name: "gamma", title: "Gamma:", value: 1, range: [0.1, 5], step: 0.01},
		], (img, params) => Adjustments.exposure(img, params));
	}

	auto_contrast() {
		this.apply_direct((img) => Adjustments.autoContrast(img));
	}

	add_noise() {
		this.show_dialog('Add Noise', [
			{name: "amount", title: "Amount:", value: 10, range: [0, 100]},
			{name: "gaussian", title: "Gaussian:", value: false},
			{name: "monochrome", title: "Monochromatic:", value: false},
		], (img, params) => Adjustments.addNoise(img, params));
	}

	color_balance() {
		this.show_dialog('Color Balance', [
			{name: "range", title: "Tones:", values: ['midtones', 'shadows', 'highlights']},
			{name: "cyan_red", title: "Cyan - Red:", value: 0, range: [-100, 100]},
			{name: "magenta_green", title: "Magenta - Green:", value: 0, range: [-100, 100]},
			{name: "yellow_blue", title: "Yellow - Blue:", value: 0, range: [-100, 100]},
			{name: "preserve_luminosity", title: "Preserve luminosity:", value: true},
		], (img, params) => Adjustments.colorBalance(img, params));
	}

	photo_filter() {
		this.show_dialog('Photo Filter', [
			{name: "color", title: "Color:", value: '#ec8a00', type: 'color'},
			{name: "density", title: "Density:", value: 25, range: [0, 100]},
			{name: "preserve_luminosity", title: "Preserve luminosity:", value: true},
		], (img, params) => Adjustments.photoFilter(img, params));
	}

	gradient_map() {
		this.show_dialog('Gradient Map', [
			{name: "shadows", title: "Shadows:", value: '#000000', type: 'color'},
			{name: "highlights", title: "Highlights:", value: '#ffffff', type: 'color'},
			{name: "reverse", title: "Reverse:", value: false},
		], (img, params) => Adjustments.gradientMap(img, params));
	}

	pixelate() {
		this.show_dialog('Pixelate', [
			{name: "size", title: "Cell size:", value: 8, range: [2, 100]},
		], (img, params) => Filters.pixelate(img, params.size));
	}

	unsharp_mask() {
		this.show_dialog('Unsharp Mask', [
			{name: "amount", title: "Amount:", value: 100, range: [0, 500]},
			{name: "radius", title: "Radius:", value: 2, range: [1, 50]},
			{name: "threshold", title: "Threshold:", value: 0, range: [0, 255]},
		], (img, params) => Filters.unsharpMask(img, params));
	}

	high_pass() {
		this.show_dialog('High Pass', [
			{name: "radius", title: "Radius:", value: 5, range: [1, 100]},
		], (img, params) => Filters.highPass(img, params.radius));
	}

	median() {
		this.show_dialog('Median', [
			{name: "radius", title: "Radius:", value: 1, range: [1, 5]},
		], (img, params) => Filters.median(img, params.radius));
	}

	channel_mixer() {
		this.show_dialog('Channel Mixer', [
			{name: "r_r", title: "Red from red:", value: 100, range: [-200, 200]},
			{name: "r_g", title: "Red from green:", value: 0, range: [-200, 200]},
			{name: "r_b", title: "Red from blue:", value: 0, range: [-200, 200]},
			{name: "g_r", title: "Green from red:", value: 0, range: [-200, 200]},
			{name: "g_g", title: "Green from green:", value: 100, range: [-200, 200]},
			{name: "g_b", title: "Green from blue:", value: 0, range: [-200, 200]},
			{name: "b_r", title: "Blue from red:", value: 0, range: [-200, 200]},
			{name: "b_g", title: "Blue from green:", value: 0, range: [-200, 200]},
			{name: "b_b", title: "Blue from blue:", value: 100, range: [-200, 200]},
			{name: "monochrome", title: "Monochrome (red row):", value: false},
		], (img, params) => Adjustments.channelMixer(img, params));
	}

	shadows_highlights() {
		this.show_dialog('Shadows/Highlights', [
			{name: "shadows", title: "Shadows:", value: 35, range: [0, 100]},
			{name: "highlights", title: "Highlights:", value: 0, range: [0, 100]},
		], (img, params) => Adjustments.shadowsHighlights(img, params));
	}

	maximum() {
		this.show_dialog('Maximum', [
			{name: "radius", title: "Radius:", value: 1, range: [1, 10]},
		], (img, params) => Filters.maxMin(img, params.radius, 'maximum'));
	}

	minimum() {
		this.show_dialog('Minimum', [
			{name: "radius", title: "Radius:", value: 1, range: [1, 10]},
		], (img, params) => Filters.maxMin(img, params.radius, 'minimum'));
	}

	equalize() {
		this.apply_direct((img) => Adjustments.equalize(img));
	}

	auto_color() {
		this.apply_direct((img) => Adjustments.autoColor(img));
	}

	offset() {
		this.show_dialog('Offset', [
			{name: "dx", title: "Horizontal:", value: 0, range: [-500, 500]},
			{name: "dy", title: "Vertical:", value: 0, range: [-500, 500]},
		], (img, params) => Filters.offset(img, params.dx, params.dy));
	}

	motion_blur() {
		this.show_dialog('Motion Blur', [
			{name: "angle", title: "Angle:", value: 0, range: [-180, 180]},
			{name: "distance", title: "Distance:", value: 10, range: [1, 100]},
		], (img, params) => Filters.motionBlur(img, params));
	}

	temperature_tint() {
		this.show_dialog('Temperature/Tint', [
			{name: "temperature", title: "Temperature:", value: 0, range: [-100, 100]},
			{name: "tint", title: "Tint:", value: 0, range: [-100, 100]},
		], (img, params) => Adjustments.temperatureTint(img, params));
	}

	sepia() {
		this.show_dialog('Sepia Tone', [
			{name: "amount", title: "Amount:", value: 100, range: [0, 100]},
		], (img, params) => Adjustments.sepia(img, params.amount));
	}

	clarity() {
		this.show_dialog('Clarity', [
			{name: "amount", title: "Amount:", value: 30, range: [-100, 100]},
			{name: "radius", title: "Radius:", value: 20, range: [1, 100]},
		], (img, params) => Filters.clarity(img, params.amount, params.radius));
	}

	swap_channels() {
		this.show_dialog('Swap Channels', [
			{name: "order", title: "Channel order:", values: ['rgb', 'rbg', 'grb', 'gbr', 'brg', 'bgr']},
		], (img, params) => Adjustments.swapChannels(img, params.order));
	}

	extract_channel() {
		this.show_dialog('Extract Channel', [
			{name: "channel", title: "Channel:", values: ['red', 'green', 'blue']},
		], (img, params) => Adjustments.extractChannel(img, params.channel));
	}

	mirror() {
		this.show_dialog('Mirror', [
			{name: "source", title: "Keep half:", values: ['left', 'right', 'top', 'bottom']},
		], (img, params) => Filters.mirror(img, params.source));
	}

	selective_color() {
		this.show_dialog('Selective Color', [
			{name: "range", title: "Colors:", values: ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks']},
			{name: "cyan", title: "Cyan:", value: 0, range: [-100, 100]},
			{name: "magenta", title: "Magenta:", value: 0, range: [-100, 100]},
			{name: "yellow", title: "Yellow:", value: 0, range: [-100, 100]},
			{name: "black", title: "Black:", value: 0, range: [-100, 100]},
		], (img, params) => Adjustments.selectiveColor(img, params));
	}

	/**
	 * Curves with an interactive editor: click on the graph to add a point, drag a point to bend the curve,
	 * double-click a point to remove it. The channel list switches between the master curve and the red, green
	 * and blue curves; all four are applied together.
	 */
	curves() {
		const curves = {
			rgb: [[0, 0], [255, 255]],
			red: [[0, 0], [255, 255]],
			green: [[0, 0], [255, 255]],
			blue: [[0, 0], [255, 255]],
		};
		this.show_dialog('Curves', [
			{name: "channel", title: "Channel:", values: ['rgb', 'red', 'green', 'blue']},
		], (img) => Adjustments.curvesFromPoints(img, curves), {
			on_load: (params, popup) => {
				let layer_canvas;
				try {
					layer_canvas = this.Base_layers.convert_layer_to_canvas(null, true);
				}
				catch {
					layer_canvas = null;
				}
				this.curve_editor = build_curve_editor(popup, curves, layer_canvas);
			},
		});
	}

	smart_blur() {
		this.show_dialog('Smart Blur', [
			{name: "radius", title: "Radius:", value: 3, range: [1, 10]},
			{name: "threshold", title: "Threshold:", value: 25, range: [1, 255]},
		], (img, params) => Filters.smartBlur(img, params));
	}

	twirl() {
		this.show_dialog('Twirl', [
			{name: "angle", title: "Angle:", value: 180, range: [-720, 720]},
			{name: "radius", title: "Radius:", value: 60, range: [1, 100]},
		], (img, params) => Distort.twirl(img, params));
	}

	spherize() {
		this.show_dialog('Spherize', [
			{name: "amount", title: "Amount:", value: 50, range: [-100, 100]},
			{name: "radius", title: "Radius:", value: 100, range: [10, 100]},
		], (img, params) => Distort.spherize(img, params));
	}

	ripple() {
		this.show_dialog('Ripple', [
			{name: "amplitude", title: "Amplitude:", value: 2, range: [0, 10], step: 0.1},
			{name: "wavelength", title: "Wavelength:", value: 10, range: [1, 100]},
		], (img, params) => Distort.ripple(img, params));
	}

	kaleidoscope() {
		this.show_dialog('Kaleidoscope', [
			{name: "segments", title: "Segments:", value: 6, range: [2, 24]},
			{name: "angle", title: "Angle:", value: 0, range: [0, 360]},
		], (img, params) => Distort.kaleidoscope(img, params));
	}

	radial_blur() {
		this.show_dialog('Radial Blur', [
			{name: "mode", title: "Mode:", values: ['spin', 'zoom']},
			{name: "amount", title: "Amount:", value: 30, range: [0, 100]},
			{name: "center_x", title: "Center horizontal:", value: 50, range: [0, 100]},
			{name: "center_y", title: "Center vertical:", value: 50, range: [0, 100]},
		], (img, params) => Distort.radialBlur(img, params));
	}

	surface_blur() {
		this.show_dialog('Surface Blur', [
			{name: "radius", title: "Radius:", value: 3, range: [1, 10]},
			{name: "threshold", title: "Threshold:", value: 30, range: [1, 255]},
		], (img, params) => Filters.surfaceBlur(img, params));
	}

	crystallize() {
		this.show_dialog('Crystallize', [
			{name: "size", title: "Cell size:", value: 4, range: [1, 30]},
			{name: "seed", title: "Seed:", value: Math.floor(Math.random() * 1000), range: [0, 999]},
		], (img, params) => Distort.crystallize(img, params));
	}

	wave() {
		this.show_dialog('Wave', [
			{name: "amplitude", title: "Amplitude:", value: 3, range: [0, 30], step: 0.5},
			{name: "wavelength", title: "Wavelength:", value: 20, range: [1, 100]},
			{name: "direction", title: "Direction:", values: ['horizontal', 'vertical']},
		], (img, params) => Distort.wave(img, params));
	}

	lens_flare() {
		this.show_dialog('Lens Flare', [
			{name: "x", title: "Horizontal:", value: 30, range: [0, 100]},
			{name: "y", title: "Vertical:", value: 30, range: [0, 100]},
			{name: "brightness", title: "Brightness:", value: 100, range: [10, 300]},
		], (img, params) => Distort.lensFlare(img, params));
	}

	clouds() {
		this.show_dialog('Clouds', [
			{name: "scale", title: "Scale:", value: 30, range: [2, 100]},
			{name: "seed", title: "Seed:", value: Math.floor(Math.random() * 1000), range: [0, 999]},
			{name: "contrast", title: "Contrast:", value: 0, range: [0, 100]},
			{name: "opacity", title: "Opacity:", value: 100, range: [1, 100]},
			{name: "color1", title: "Color 1:", value: '#000000', type: 'color'},
			{name: "color2", title: "Color 2:", value: '#ffffff', type: 'color'},
		], (img, params) => Distort.clouds(img, params));
	}

	threshold() {
		this.show_dialog('Threshold', [
			{name: "level", title: "Level:", value: 128, range: [1, 255]},
		], (img, params) => Adjustments.threshold(img, params.level));
	}

	posterize() {
		this.show_dialog('Posterize', [
			{name: "levels", title: "Levels:", value: 4, range: [2, 32]},
		], (img, params) => Adjustments.posterize(img, params.levels));
	}

	show_dialog(title, params, change, extra) {
		if (this.can_apply() == false) {
			return;
		}
		//values used the last time (in this session) are offered again
		this.remembered = this.remembered || {};
		const last = this.remembered[title];
		if (last) {
			params.forEach((param) => {
				if (param.name != undefined && last[param.name] !== undefined && param.type != 'color'
					&& typeof last[param.name] == typeof param.value
					&& (param.values == undefined || param.values.map(String).includes(String(last[param.name])))) {
					param.value = last[param.name];
				}
			});
		}
		const settings = {
			title,
			preview: true,
			effects: true,
			params,
			on_change (params, canvas_preview, w, h) {
				const img = canvas_preview.getImageData(0, 0, w, h);
				canvas_preview.putImageData(change(img, params), 0, 0);
			},
			on_finish: (params) => {
				this.remembered[title] = Object.assign({}, params);
				this.apply_direct((img) => change(img, params));
			},
		};
		Object.assign(settings, extra || {});
		this.POP.show(settings);
	}

	/**
	 * Image > Repeat Last Adjustment - applies the last adjustment (with the same settings) again
	 */
	repeat_last() {
		if (!this.last_change) {
			alertify.warning(t('There is no adjustment to repeat.'));
			return;
		}
		return this.apply_direct(this.last_change);
	}

	apply_direct(change) {
		if (this.can_apply() == false) {
			return;
		}
		//Image > Repeat Last Adjustment
		this.last_change = change;

		//get canvas from layer
		const canvas = this.Base_layers.convert_layer_to_canvas(null, true);
		const ctx = canvas.getContext("2d");

		//keep the layer as it was, Edit > Fade can mix it back
		const before = document.createElement('canvas');
		before.width = canvas.width;
		before.height = canvas.height;
		before.getContext('2d').drawImage(canvas, 0, 0);

		//change data - only inside the selection (rectangle fast path, otherwise blended through the selection mask)
		const selection = this.Edit_selection.get_mask();
		if (selection == null) {
			const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
			ctx.putImageData(change(img), 0, 0);
		}
		else if (selection.kind == 'rect') {
			const rect = selection_to_layer_rect(selection.rect, config.layer);
			if (rect == null) {
				return; //selection does not touch this layer
			}
			const part = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
			ctx.putImageData(change(part), rect.x, rect.y);
		}
		else {
			const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const changed = change(ctx.getImageData(0, 0, canvas.width, canvas.height));
			ctx.putImageData(blend_with_mask(original, changed, selection.mask, config.layer), 0, 0);
		}

		//save
		const action = new app.Actions.Update_layer_image_action(canvas);
		this.last_adjustment = {layer_id: config.layer.id, before, action};
		return app.State.do_action(action);
	}

	/**
	 * The last adjustment, when it is still the last step of the undo history
	 *
	 * @returns {{layer_id: number, before: HTMLCanvasElement, action: object}|null}
	 */
	get_fadeable() {
		const last = this.last_adjustment;
		if (!last) {
			return null;
		}
		const state = app.State;
		if (state.action_history[state.action_history_index - 1] !== last.action
			|| !app.Layers.get_layer(last.layer_id)) {
			return null;
		}
		return last;
	}

	/**
	 * Edit > Fade (Shift+Ctrl+F) - weakens the last adjustment or filter by mixing the layer with how it was before
	 */
	fade() {
		const last = this.get_fadeable();
		if (last == null) {
			alertify.error(t('There is no adjustment to fade.'));
			return;
		}
		const layer_id = last.layer_id;
		const before = last.before;
		const mix = (current_canvas, opacity) => {
			const ctx = current_canvas.getContext('2d');
			const current = ctx.getImageData(0, 0, current_canvas.width, current_canvas.height);
			//the earlier state is scaled to the size of the picture it is mixed with (the dialog preview is small)
			const scaled = document.createElement('canvas');
			scaled.width = current_canvas.width;
			scaled.height = current_canvas.height;
			scaled.getContext('2d').drawImage(before, 0, 0, scaled.width, scaled.height);
			const earlier = scaled.getContext('2d').getImageData(0, 0, scaled.width, scaled.height);
			return smudgeBlend(current, earlier, 100 - opacity);
		};
		this.POP.show({
			title: 'Fade',
			preview: true,
			effects: true,
			params: [
				{name: "opacity", title: "Opacity:", value: 50, range: [0, 100]},
			],
			on_change (params, canvas_preview, w, h) {
				const img = canvas_preview.getImageData(0, 0, w, h);
				const small = document.createElement('canvas');
				small.width = w;
				small.height = h;
				small.getContext('2d').putImageData(img, 0, 0);
				canvas_preview.putImageData(mix(small, params.opacity), 0, 0);
			},
			on_finish: (params) => {
				const canvas = this.Base_layers.convert_layer_to_canvas(layer_id, true);
				canvas.getContext('2d').putImageData(mix(canvas, params.opacity), 0, 0);
				this.last_adjustment = null;
				app.State.do_action(new app.Actions.Update_layer_image_action(canvas, layer_id));
			},
		});
	}

}

export default Image_adjustments_class;
