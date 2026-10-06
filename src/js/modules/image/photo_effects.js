import config from './../../config.js';
import Image_adjustments_class from './adjustments.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import * as Effects2 from './../../libs/effects2.js';
import * as Effects3 from './../../libs/effects3.js';
import * as Effects4 from './../../libs/effects4.js';
import * as Adjustments from './../../libs/adjustments.js';
import * as Filters from './../../libs/filters.js';
import { save_blob } from './../../libs/file-save.js';
import { parse_cube, apply_lut } from './../../libs/lut.js';
import { t } from '../tools/translate.js';

/**
 * Photo effects with live preview: vignette, dehaze, tilt-shift, split toning, film grain, halftone,
 * chromatic aberration, dust & scratches and color lookup tables (.cube). They work on the active
 * layer and the selection (through Image_adjustments_class).
 */
class Image_photo_effects_class {

	constructor() {
		this.Adjustments = new Image_adjustments_class();
	}

	vignette() {
		this.Adjustments.show_dialog('Vignette', [
			{name: "amount", title: "Amount:", value: -50, range: [-100, 100]},
			{name: "size", title: "Size:", value: 45, range: [5, 100]},
			{name: "softness", title: "Softness:", value: 60, range: [1, 100]},
		], (img, p) => Effects2.vignette(img, -p.amount, p.size, p.softness));
	}

	dehaze() {
		this.Adjustments.show_dialog('Dehaze', [
			{name: "strength", title: "Strength:", value: 40, range: [0, 100]},
		], (img, p) => Effects2.dehaze(img, p.strength));
	}

	tilt_shift() {
		this.Adjustments.show_dialog('Tilt-Shift', [
			{name: "focus", title: "Focus position:", value: 50, range: [0, 100]},
			{name: "band", title: "Sharp band:", value: 20, range: [0, 100]},
			{name: "blur", title: "Blur:", value: 8, range: [1, 40]},
		], (img, p) => Effects2.tilt_shift(img, p.focus, p.band, p.blur));
	}

	split_toning() {
		this.Adjustments.show_dialog('Split Toning', [
			{name: "shadows", title: "Shadows:", value: "#2a4d8f", type: 'color'},
			{name: "highlights", title: "Highlights:", value: "#f2b36b", type: 'color'},
			{name: "balance", title: "Balance:", value: 0, range: [-100, 100]},
			{name: "strength", title: "Strength:", value: 50, range: [0, 100]},
		], (img, p) => Effects2.split_toning(img, p.shadows, p.highlights, p.balance, p.strength));
	}

	film_grain() {
		//the same grain is used in the preview and in the result, so the preview is what you get
		var seed = 12345;
		var random = () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		this.Adjustments.show_dialog('Film Grain', [
			{name: "amount", title: "Amount:", value: 30, range: [0, 100]},
			{name: "size", title: "Grain size:", value: 1, range: [1, 6]},
		], (img, p) => {
			seed = 12345;
			return Effects2.film_grain(img, p.amount, p.size, random);
		});
	}

	halftone() {
		this.Adjustments.show_dialog('Halftone', [
			{name: "cell", title: "Dot size:", value: 8, range: [3, 40]},
			{name: "color", title: "Keep colors:", value: false},
		], (img, p) => Effects2.halftone(img, p.cell, p.color));
	}

	chromatic_aberration() {
		this.Adjustments.show_dialog('Chromatic Aberration', [
			{name: "amount", title: "Shift:", value: 3, range: [-30, 30]},
		], (img, p) => Effects2.chromatic_aberration(img, p.amount));
	}

	dust_scratches() {
		this.Adjustments.show_dialog('Dust & Scratches', [
			{name: "radius", title: "Radius:", value: 1, range: [1, 4]},
			{name: "threshold", title: "Threshold:", value: 30, range: [0, 120]},
		], (img, p) => Effects2.dust_scratches(img, p.radius, p.threshold));
	}

	defringe() {
		this.Adjustments.show_dialog('Defringe', [
			{name: "radius", title: "Radius:", value: 2, range: [1, 10]},
		], (img, p) => Effects3.defringe(img, p.radius));
	}

	blur_background() {
		this.Adjustments.show_dialog('Blur Background', [
			{name: "radius", title: "Blur:", value: 10, range: [1, 50]},
			{name: "tolerance", title: "Tolerance:", value: 30, range: [1, 120]},
			{name: "soften", title: "Soften:", value: 3, range: [0, 20]},
		], (img, p) => Effects3.blur_background(img, p.radius, p.tolerance, p.soften));
	}

	sharpen_edges() {
		this.Adjustments.show_dialog('Sharpen Edges', [
			{name: "amount", title: "Amount:", value: 100, range: [0, 300]},
			{name: "sensitivity", title: "Sensitivity:", value: 40, range: [1, 100]},
		], (img, p) => Effects3.sharpen_edges(img, p.amount, p.sensitivity));
	}

	reduce_color_noise() {
		this.Adjustments.show_dialog('Reduce Color Noise', [
			{name: "radius", title: "Radius:", value: 4, range: [1, 20]},
			{name: "strength", title: "Strength:", value: 80, range: [0, 100]},
		], (img, p) => Effects3.reduce_color_noise(img, p.radius, p.strength));
	}

	surface_blur() {
		this.Adjustments.show_dialog('Soften Skin', [
			{name: "radius", title: "Radius:", value: 8, range: [1, 40]},
			{name: "threshold", title: "Threshold:", value: 25, range: [1, 100]},
		], (img, p) => Effects4.surface_blur(img, p.radius, p.threshold));
	}

	hdr_toning() {
		this.Adjustments.show_dialog('HDR Toning', [
			{name: "radius", title: "Radius:", value: 30, range: [5, 100]},
			{name: "strength", title: "Strength:", value: 50, range: [0, 100]},
			{name: "saturation", title: "Saturation:", value: 10, range: [-100, 100]},
		], (img, p) => Effects4.hdr_toning(img, p.radius, p.strength, p.saturation));
	}

	white_balance() {
		this.Adjustments.show_dialog('White Balance', [
			{name: "neutral", title: "Gray point:", value: "#c8c8c8", type: 'color'},
			{name: "strength", title: "Strength:", value: 100, range: [0, 100]},
			{html: '<span class="field_comment">' + t('Pick a color that should be gray (for example a white wall).').replace(/</g, '&lt;') + '</span>'},
		], (img, p) => Effects4.white_balance(img, p.neutral, p.strength));
	}

	reduce_to_palette() {
		this.Adjustments.show_dialog('Reduce to Palette', [
			{name: "colors", title: "Colors:", value: 16, range: [2, 64]},
			{name: "dither", title: "Dithering:", value: true},
		], (img, p) => {
			Effects4.reduce_to_palette(img, p.colors, p.dither);
			return img;
		});
	}

	pixel_art() {
		this.Adjustments.show_dialog('Pixel Art', [
			{name: "cell", title: "Pixel size:", value: 6, range: [2, 40]},
			{name: "colors", title: "Colors:", value: 12, range: [2, 32]},
		], (img, p) => {
			Filters.pixelate(img, p.cell);
			Effects4.reduce_to_palette(img, p.colors, false);
			return img;
		});
	}

	duotone() {
		var presets = {
			'Blue and Orange': ['#0b1d51', '#ffb347'],
			'Black and Gold': ['#000000', '#f5c542'],
			'Purple and Pink': ['#2d1b69', '#ff8fb1'],
			'Green and Cream': ['#0d3b2e', '#f4efd3'],
			'Red and White': ['#7a0c1e', '#ffffff'],
		};
		this.Adjustments.show_dialog('Duotone', [
			{name: "preset", title: "Colors:", type: 'select', values: Object.keys(presets), value: 'Blue and Orange'},
		], (img, p) => {
			var pair = presets[p.preset] || presets['Blue and Orange'];
			return Adjustments.gradientMap(img, {shadows: pair[0], highlights: pair[1]});
		});
	}

	/**
	 * Image > Adjustments > Save Last Adjustment as LUT - turns the last color adjustment into a .cube file
	 */
	save_adjustment_lut() {
		var last = this.Adjustments.last_change;
		if (!last) {
			alertify.warning(t('There is no adjustment to save.'));
			return;
		}
		var text = Effects4.adjustment_to_cube(last, 33, 'WebPhos look');
		save_blob(new Blob([text], {type: 'text/plain'}), 'WebPhos-look.cube', false);
		alertify.message(t('Only color adjustments can be saved as a LUT (not blur or sharpening).'), 5);
	}

	/**
	 * Image > Adjustments > Color Lookup - applies a .cube file
	 */
	color_lookup() {
		var lut = null;
		this.Adjustments.show_dialog('Color Lookup', [
			{html: '<input type="file" id="lut_file" accept=".cube,text/plain" aria-label="' + t('Choose a .cube file') + '" />'},
			{name: "strength", title: "Strength:", value: 100, range: [0, 100]},
		], (img, p) => (lut ? apply_lut(img, lut, p.strength) : img));

		var input = document.getElementById('lut_file');
		if (!input) {
			return;
		}
		input.addEventListener('change', () => {
			var file = input.files && input.files[0];
			if (!file) {
				return;
			}
			if (file.size > 40 * 1024 * 1024) {
				alertify.error(t('The file is too large.'));
				return;
			}
			var reader = new FileReader();
			reader.onload = () => {
				var parsed = parse_cube(String(reader.result));
				if (!parsed) {
					alertify.error(t('This is not a valid 3D .cube file.'));
					lut = null;
					return;
				}
				lut = parsed;
				if (window.POP) {
					window.POP.onChangeEvent();
				}
			};
			reader.readAsText(file);
		});
	}
}

export default Image_photo_effects_class;
