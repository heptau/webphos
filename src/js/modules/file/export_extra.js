import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import Edit_selection_class from './../edit/selection.js';
import Tools_settings_class from './../tools/settings.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { build_zip } from './../../libs/zip.js';
import { sprite_layout, print_tiles } from './../../libs/effects3.js';
import Base_layers_class from './../../core/base-layers.js';
import { save_blob } from './../../libs/file-save.js';
import { layer_file_names } from './../../libs/export-names.js';
import { build_psd, content_bounds } from './../../libs/psd-write.js';
import { effective_alpha, group_props_of, is_isolated, nest_layers } from './../../libs/layer-groups.js';
import { t } from '../tools/translate.js';

//sizes of an app icon set (iOS, Android, web, PWA)
export const ICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];

//positions of a watermark
export const WATERMARK_POSITIONS = ['Bottom right', 'Bottom left', 'Top right', 'Top left', 'Center', 'Tiled'];

function canvas_to_bytes(canvas) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(async (blob) => {
			if (!blob) {
				reject(new Error('Canvas is empty'));
				return;
			}
			resolve(new Uint8Array(await blob.arrayBuffer()));
		}, 'image/png');
	});
}

/**
 * Extra exports: several sizes in one ZIP, app icon set, selection only, with watermark,
 * copy as data URL and document information. Everything stays in the browser.
 */
class File_export_extra_class {

	constructor() {
		this.POP = new Dialog_class();
		this.Edit_selection = new Edit_selection_class();
		this.Tools_settings = new Tools_settings_class();
		this.Base_layers = new Base_layers_class();
	}

	/**
	 * @returns {string} document name without extension and with dashes instead of spaces
	 */
	base_name() {
		var parts = String(config.layers[0].name).split('.');
		if (parts.length > 1) {
			parts.pop();
		}
		return parts.join('.').replace(/[^\w\-. ]+/g, '').replace(/ /g, '-') || 'image';
	}

	use_picker() {
		return Boolean(this.Tools_settings.get_setting('use_file_picker'));
	}

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {number} width
	 * @param {number} height
	 * @param {boolean} [contain] keep the proportions and center the picture (for square icons)
	 * @returns {HTMLCanvasElement}
	 */
	scaled(canvas, width, height, contain) {
		var out = document.createElement('canvas');
		out.width = Math.max(1, Math.round(width));
		out.height = Math.max(1, Math.round(height));
		var ctx = out.getContext('2d');
		ctx.imageSmoothingQuality = 'high';
		if (contain) {
			var scale = Math.min(out.width / canvas.width, out.height / canvas.height);
			var w = canvas.width * scale;
			var h = canvas.height * scale;
			ctx.drawImage(canvas, (out.width - w) / 2, (out.height - h) / 2, w, h);
		}
		else {
			ctx.drawImage(canvas, 0, 0, out.width, out.height);
		}
		return out;
	}

	/**
	 * File > Export Sizes - the image in several scales (1x, 2x, 3x...) in one ZIP file
	 */
	export_scales() {
		this.POP.show({
			title: 'Export Sizes',
			params: [
				{name: "x1", title: "1x:", value: true},
				{name: "x2", title: "2x:", value: true},
				{name: "x3", title: "3x:", value: false},
				{name: "x4", title: "4x:", value: false},
				{name: "half", title: "0.5x:", value: false},
			],
			on_finish: async (params) => {
				var scales = [[0.5, 'half', '@0.5x'], [1, 'x1', ''], [2, 'x2', '@2x'], [3, 'x3', '@3x'], [4, 'x4', '@4x']]
					.filter((item) => params[item[1]]);
				if (scales.length == 0) {
					return;
				}
				try {
					var source = this.Edit_selection.get_merged_canvas();
					var name = this.base_name();
					var files = [];
					for (var i = 0; i < scales.length; i++) {
						var canvas = this.scaled(source, source.width * scales[i][0], source.height * scales[i][0]);
						files.push({name: name + scales[i][2] + '.png', data: await canvas_to_bytes(canvas)});
					}
					await save_blob(new Blob([build_zip(files)], {type: 'application/zip'}), name + '-sizes.zip', this.use_picker());
				}
				catch (error) {
					alertify.error(t('Export failed.'));
				}
			},
		});
	}

	/**
	 * File > Export App Icons - square icons of all usual sizes in one ZIP file
	 */
	async export_icons() {
		try {
			var source = this.Edit_selection.get_merged_canvas();
			var files = [];
			for (var i = 0; i < ICON_SIZES.length; i++) {
				var size = ICON_SIZES[i];
				files.push({name: 'icon-' + size + '.png', data: await canvas_to_bytes(this.scaled(source, size, size, true))});
			}
			await save_blob(new Blob([build_zip(files)], {type: 'application/zip'}), this.base_name() + '-icons.zip', this.use_picker());
		}
		catch (error) {
			alertify.error(t('Export failed.'));
		}
	}

	/**
	 * File > Export Layers - every visible layer as its own PNG (cut to its content, with its layer style) in one ZIP
	 */
	export_layers() {
		var layers = config.layers.filter((layer) => layer.type != null && layer.visible !== false).sort((a, b) => a.order - b.order);
		if (layers.length == 0) {
			alertify.error(t('There are no visible layers to export.'));
			return;
		}
		this.POP.show({
			title: 'Export Layers',
			params: [
				{name: "full_size", title: "Size of the document:", value: false},
			],
			on_finish: async (params) => {
				try {
					var names = layer_file_names(layers);
					var files = [];
					for (var i = 0; i < layers.length; i++) {
						var canvas = this.Base_layers.convert_layer_to_canvas(layers[i].id, false, params.full_size !== true);
						files.push({name: names[i], data: await canvas_to_bytes(canvas)});
					}
					await save_blob(new Blob([build_zip(files)], {type: 'application/zip'}), this.base_name() + '-layers.zip', this.use_picker());
				}
				catch (error) {
					alertify.error(t('Export failed.'));
				}
			},
		});
	}

	/**
	 * File > Export as PSD - a Photoshop file with the layers (pixels, place, opacity, visibility, blend mode, name) and
	 * the flattened picture. Adjustment layers, masks and clipping are not written as such; every layer is drawn the way it
	 * looks (with its effects and mask) and trimmed to its visible part.
	 */
	async export_psd() {
		var layers = config.layers.filter((layer) => layer.type != null && layer.type != 'adjustment').sort((a, b) => a.order - b.order);
		if (layers.length == 0) {
			alertify.error(t('There are no layers to export.'));
			return;
		}
		try {
			var width = config.WIDTH;
			var height = config.HEIGHT;
			var work = document.createElement('canvas');
			work.width = width;
			work.height = height;
			var ctx = work.getContext('2d', {willReadFrequently: true});
			var out = [];
			var records = new Map();
			for (var layer of layers) {
				ctx.clearRect(0, 0, width, height);
				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = 'source-over';
				this.Base_layers.render_object(ctx, layer);
				var image = ctx.getImageData(0, 0, width, height);
				var box = content_bounds(image.data, width, height);
				if (box == null) {
					continue;
				}
				var part = ctx.getImageData(box.x, box.y, box.width, box.height);
				records.set(layer, {
					name: String(layer.name), x: box.x, y: box.y, width: box.width, height: box.height,
					opacity: Math.round(effective_alpha(layer) * 100), visible: layer.visible !== false,
					composition: layer.composition, data: part.data,
				});
			}
			if (records.size == 0) {
				alertify.error(t('There are no layers to export.'));
				return;
			}
			//the groups with their settings, from the bottom to the top (the divider that starts a group comes first)
			var write = (items) => {
				for (var i = items.length - 1; i >= 0; i--) {
					var item = items[i];
					if (item.kind == 'layer') {
						if (records.has(item.layer)) {
							out.push(records.get(item.layer));
						}
						continue;
					}
					var first = layers.find((member) => member.group === item.name || (member.group || '').indexOf(item.name + '/') === 0);
					var props = group_props_of(first, item.name);
					out.push({section: 'end'});
					write(item.items);
					out.push({section: 'start', name: item.label, opacity: props.opacity, visible: true, composition: props.composition, pass: !is_isolated(props)});
				}
			};
			write(nest_layers(layers.slice().reverse()));
			if (out.length == 0) {
				alertify.error(t('There are no layers to export.'));
				return;
			}
			ctx.clearRect(0, 0, width, height);
			this.Base_layers.convert_layers_to_canvas(ctx);
			var composite = ctx.getImageData(0, 0, width, height).data;
			var bytes = build_psd(width, height, out, composite);
			await save_blob(new Blob([bytes], {type: 'image/vnd.adobe.photoshop'}), this.base_name() + '.psd', this.use_picker());
		}
		catch (error) {
			alertify.error(t('Export failed.'));
		}
	}

	/**
	 * File > Export Selection - only the selected part (all visible layers) as PNG
	 */
	async export_selection() {
		var part = this.Edit_selection.get_selection_canvas(null, true);
		if (part == null) {
			alertify.error(t('Empty selection'));
			return;
		}
		part.canvas.toBlob((blob) => {
			save_blob(blob, this.base_name() + '-selection.png', this.use_picker());
		}, 'image/png');
	}

	/**
	 * File > Export with Watermark - the picture with a text watermark as PNG
	 */
	export_watermark() {
		this.POP.show({
			title: 'Export with Watermark',
			params: [
				{name: "text", title: "Text:", value: "© " + new Date().getFullYear()},
				{name: "position", title: "Position:", type: 'select', values: WATERMARK_POSITIONS, value: 'Bottom right'},
				{name: "size", title: "Size:", value: 5, range: [1, 30]},
				{name: "opacity", title: "Opacity:", value: 60, range: [5, 100]},
				{name: "color", title: "Color:", value: "#ffffff", type: 'color'},
			],
			on_finish: (params) => {
				var canvas = this.render_watermark(this.Edit_selection.get_merged_canvas(), params);
				canvas.toBlob((blob) => {
					save_blob(blob, this.base_name() + '-watermark.png', this.use_picker());
				}, 'image/png');
			},
		});
	}

	/**
	 * @param {HTMLCanvasElement} source picture
	 * @param {{text: string, position: string, size: number, opacity: number, color: string}} params size is the text height in percent of the picture height
	 * @returns {HTMLCanvasElement} new canvas with the watermark
	 */
	render_watermark(source, params) {
		var canvas = document.createElement('canvas');
		canvas.width = source.width;
		canvas.height = source.height;
		var ctx = canvas.getContext('2d');
		ctx.drawImage(source, 0, 0);

		var text = String(params.text || '');
		if (text == '') {
			return canvas;
		}
		var font = Math.max(8, Math.round(source.height * (parseFloat(params.size) || 5) / 100));
		var color = /^#[0-9a-f]{6}$/i.test(params.color) ? params.color : '#ffffff';
		ctx.font = '600 ' + font + 'px -apple-system, "Helvetica Neue", Arial, sans-serif';
		ctx.globalAlpha = Math.min(1, Math.max(0.05, (parseFloat(params.opacity) || 60) / 100));
		ctx.textBaseline = 'alphabetic';
		var width = ctx.measureText(text).width;
		var margin = font * 0.6;

		var draw = (x, y) => {
			//a dark outline keeps the text readable on light pictures
			ctx.lineWidth = Math.max(1, font / 12);
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
			ctx.strokeText(text, x, y);
			ctx.fillStyle = color;
			ctx.fillText(text, x, y);
		};
		var position = params.position;
		if (position == 'Tiled') {
			ctx.save();
			ctx.rotate(-Math.PI / 8);
			var step_x = width + font * 3;
			var step_y = font * 4;
			for (var y = -source.width; y < source.height + source.width; y += step_y) {
				for (var x = -source.width; x < source.width * 2; x += step_x) {
					draw(x, y);
				}
			}
			ctx.restore();
		}
		else if (position == 'Center') {
			draw((source.width - width) / 2, (source.height + font * 0.7) / 2);
		}
		else {
			var left = position.indexOf('left') >= 0;
			var top = position.indexOf('Top') >= 0;
			draw(left ? margin : source.width - width - margin, top ? margin + font : source.height - margin);
		}
		return canvas;
	}

	/**
	 * File > Export Sprite Sheet - every layer is a frame; one PNG with all frames and a JSON with their positions
	 */
	export_sprite_sheet() {
		var layers = config.layers.filter((layer) => layer.type == 'image' && layer.visible).sort((a, b) => a.order - b.order);
		if (layers.length == 0) {
			alertify.warning(t('There are no visible image layers.'));
			return;
		}
		this.POP.show({
			title: 'Export Sprite Sheet',
			params: [
				{name: "columns", title: "Columns:", value: Math.min(layers.length, 4), range: [1, Math.max(1, layers.length)]},
				{name: "padding", title: "Padding:", value: 2, range: [0, 32]},
			],
			on_finish: async (params) => {
				try {
					var frames = layers.map((layer) => ({layer: layer, canvas: this.Base_layers.convert_layer_to_canvas(layer.id, true, false)}));
					var layout = sprite_layout(frames.map((frame) => ({width: frame.canvas.width, height: frame.canvas.height})), params.columns, params.padding);
					var sheet = document.createElement('canvas');
					sheet.width = layout.width;
					sheet.height = layout.height;
					var ctx = sheet.getContext('2d');
					var atlas = {width: layout.width, height: layout.height, frames: []};
					frames.forEach((frame, index) => {
						ctx.drawImage(frame.canvas, layout.items[index].x, layout.items[index].y);
						atlas.frames.push({name: frame.layer.name, x: layout.items[index].x, y: layout.items[index].y, width: frame.canvas.width, height: frame.canvas.height});
					});
					var name = this.base_name();
					var files = [
						{name: name + '-sprites.png', data: await canvas_to_bytes(sheet)},
						{name: name + '-sprites.json', data: new TextEncoder().encode(JSON.stringify(atlas, null, 2))},
					];
					await save_blob(new Blob([build_zip(files)], {type: 'application/zip'}), name + '-sprites.zip', this.use_picker());
				}
				catch (error) {
					alertify.error(t('Export failed.'));
				}
			},
		});
	}

	/**
	 * File > Export Print Tiles - a big picture cut into pages (A4 or Letter) with an overlap for gluing
	 */
	export_print_tiles() {
		this.POP.show({
			title: 'Export Print Tiles',
			params: [
				{name: "paper", title: "Paper:", type: 'select', values: ['A4', 'A3', 'Letter'], value: 'A4'},
				{name: "dpi", title: "Resolution (dpi):", value: 150, range: [72, 600]},
				{name: "margin", title: "Overlap (mm):", value: 8, range: [0, 30]},
			],
			on_finish: async (params) => {
				var sizes = {A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4]};
				var paper = sizes[params.paper] || sizes.A4;
				var px = (mm) => Math.round(mm / 25.4 * params.dpi);
				var source = this.Edit_selection.get_merged_canvas();
				var tiles = print_tiles(source.width, source.height, px(paper[0]), px(paper[1]), px(params.margin));
				if (tiles.length > 200) {
					alertify.error(t('Too many pages - lower the resolution.'));
					return;
				}
				try {
					var name = this.base_name();
					var files = [];
					for (var i = 0; i < tiles.length; i++) {
						var tile = tiles[i];
						var canvas = document.createElement('canvas');
						canvas.width = tile.width;
						canvas.height = tile.height;
						canvas.getContext('2d').drawImage(source, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
						files.push({name: name + '-page-r' + (tile.row + 1) + 'c' + (tile.column + 1) + '.png', data: await canvas_to_bytes(canvas)});
					}
					await save_blob(new Blob([build_zip(files)], {type: 'application/zip'}), name + '-pages.zip', this.use_picker());
				}
				catch (error) {
					alertify.error(t('Export failed.'));
				}
			},
		});
	}

	/**
	 * Edit > Copy as Data URL - the whole picture as text that can be pasted into code or e-mail
	 */
	async copy_data_url() {
		var url = this.Edit_selection.get_merged_canvas().toDataURL('image/png');
		try {
			await navigator.clipboard.writeText(url);
			alertify.success(t('Copied to the clipboard.'));
		}
		catch (error) {
			alertify.error(t('The clipboard could not be written.'));
		}
	}

	/**
	 * File > Export Document Info - size, layers and used effects as a JSON file (for documentation)
	 */
	export_info() {
		var info = {
			name: this.base_name(),
			width: config.WIDTH,
			height: config.HEIGHT,
			layers: config.layers.slice().sort((a, b) => b.order - a.order).map((layer) => ({
				name: layer.name,
				type: layer.type,
				visible: layer.visible,
				opacity: layer.opacity,
				blend: layer.composition || 'source-over',
				x: layer.x,
				y: layer.y,
				width: layer.width,
				height: layer.height,
				filters: (layer.filters || []).map((filter) => filter.name),
				mask: Boolean(layer.mask),
			})),
		};
		var blob = new Blob([JSON.stringify(info, null, 2)], {type: 'application/json'});
		save_blob(blob, this.base_name() + '-info.json', this.use_picker());
	}
}

export default File_export_extra_class;
