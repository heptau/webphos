/**
 * Retouching helpers: defringe, background blur, edge sharpening, color noise reduction and
 * layout calculations for sprite sheets and print tiles. Pure functions on {data, width, height}.
 */
import { blur_rgba } from './effects2.js';
import { select_subject_mask, edges_mask, feather_mask } from './selection-mask.js';

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Defringe - the semi transparent edge of a cut out object often keeps the color of the old background.
 * Edge pixels get the color of the opaque pixels next to them.
 *
 * @param {number} radius 1 .. 10 how far from the opaque part the edge is repaired
 */
export function defringe(image, radius) {
	radius = Math.round(clamp(parseFloat(radius) || 1, 1, 10));
	const w = image.width;
	const h = image.height;
	const source = new Uint8ClampedArray(image.data);
	const data = image.data;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const alpha = source[i + 3];
			if (alpha == 0 || alpha == 255) {
				continue;
			}
			let r = 0, g = 0, b = 0, weight = 0;
			for (let dy = -radius; dy <= radius; dy++) {
				for (let dx = -radius; dx <= radius; dx++) {
					const xx = x + dx;
					const yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
						continue;
					}
					const j = (yy * w + xx) * 4;
					if (source[j + 3] < 250) {
						continue;
					}
					const near = 1 / (1 + dx * dx + dy * dy);
					r += source[j] * near;
					g += source[j + 1] * near;
					b += source[j + 2] * near;
					weight += near;
				}
			}
			if (weight > 0) {
				data[i] = Math.round(r / weight);
				data[i + 1] = Math.round(g / weight);
				data[i + 2] = Math.round(b / weight);
			}
		}
	}
	return image;
}

/**
 * Blur background - the object in front of a calm background stays sharp, the rest is blurred.
 *
 * @param {number} radius blur radius in pixels
 * @param {number} tolerance 1 .. 120 how different from the edge colors the object must be
 * @param {number} [soften] edge softness in pixels
 */
export function blur_background(image, radius, tolerance, soften) {
	const subject = select_subject_mask(image, tolerance == undefined ? 30 : tolerance, 2);
	const mask = soften > 0 ? feather_mask(subject, Math.round(soften)) : subject;
	const blurred = blur_rgba(image, radius == undefined ? 10 : radius);
	const data = image.data;
	for (let p = 0; p < mask.data.length; p++) {
		const keep = mask.data[p] / 255;
		const i = p * 4;
		for (let c = 0; c < 3; c++) {
			data[i + c] = data[i + c] * keep + blurred[i + c] * (1 - keep);
		}
	}
	return image;
}

/**
 * Sharpen edges - the sharpening is applied mostly where the picture has edges, flat areas and noise stay calm.
 *
 * @param {number} amount 0 .. 300 %
 * @param {number} sensitivity 1 .. 100 how weak edges are still sharpened
 */
export function sharpen_edges(image, amount, sensitivity) {
	amount = clamp(parseFloat(amount) || 0, 0, 300) / 100;
	const edges = edges_mask(image, sensitivity == undefined ? 40 : sensitivity);
	const blurred = blur_rgba(image, 3);
	const data = image.data;
	for (let p = 0; p < edges.data.length; p++) {
		const weight = edges.data[p] / 255 * amount;
		if (weight == 0) {
			continue;
		}
		const i = p * 4;
		for (let c = 0; c < 3; c++) {
			data[i + c] = clamp(data[i + c] + (data[i + c] - blurred[i + c]) * weight * 2, 0, 255);
		}
	}
	return image;
}

/**
 * Reduce color noise - colored speckles (typical for high ISO photos) are blurred, brightness details stay.
 *
 * @param {number} radius 1 .. 20
 * @param {number} strength 0 .. 100
 */
export function reduce_color_noise(image, radius, strength) {
	strength = clamp(parseFloat(strength == undefined ? 80 : strength), 0, 100) / 100;
	const w = image.width;
	const h = image.height;
	const data = image.data;
	const luma = new Uint8ClampedArray(data.length);
	const chroma = new Uint8ClampedArray(data.length);
	//split into brightness (gray picture) and the rest
	for (let i = 0; i < data.length; i += 4) {
		const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
		luma[i] = luma[i + 1] = luma[i + 2] = y;
		luma[i + 3] = 255;
		chroma[i] = clamp(data[i] - y + 128, 0, 255);
		chroma[i + 1] = clamp(data[i + 1] - y + 128, 0, 255);
		chroma[i + 2] = clamp(data[i + 2] - y + 128, 0, 255);
		chroma[i + 3] = 255;
	}
	const smooth = blur_rgba({data: chroma, width: w, height: h}, radius == undefined ? 4 : radius);
	for (let j = 0; j < data.length; j += 4) {
		const yy = luma[j];
		for (let c = 0; c < 3; c++) {
			const original = chroma[j + c] - 128;
			const mixed = original * (1 - strength) + (smooth[j + c] - 128) * strength;
			data[j + c] = clamp(yy + mixed, 0, 255);
		}
	}
	return image;
}

/**
 * Sprite sheet layout - the pictures are placed in a grid with equal cells.
 *
 * @param {{width: number, height: number}[]} sizes
 * @param {number} columns
 * @param {number} padding pixels around every cell
 * @returns {{width: number, height: number, cell: {width: number, height: number}, items: {x: number, y: number}[]}}
 */
export function sprite_layout(sizes, columns, padding) {
	columns = Math.max(1, Math.min(sizes.length || 1, Math.round(columns) || 1));
	padding = Math.max(0, Math.round(padding) || 0);
	let cell_w = 1;
	let cell_h = 1;
	sizes.forEach((size) => {
		cell_w = Math.max(cell_w, Math.round(size.width));
		cell_h = Math.max(cell_h, Math.round(size.height));
	});
	const rows = Math.ceil(sizes.length / columns) || 1;
	const items = sizes.map((size, index) => {
		const col = index % columns;
		const row = Math.floor(index / columns);
		return {
			x: padding + col * (cell_w + padding * 2) + Math.floor((cell_w - Math.round(size.width)) / 2),
			y: padding + row * (cell_h + padding * 2) + Math.floor((cell_h - Math.round(size.height)) / 2),
		};
	});
	return {
		width: columns * (cell_w + padding * 2),
		height: rows * (cell_h + padding * 2),
		cell: {width: cell_w, height: cell_h},
		items,
	};
}

/**
 * Print tiles - a big picture is cut into pages that can be printed and glued together.
 *
 * @param {number} width picture width in pixels
 * @param {number} height picture height in pixels
 * @param {number} page_width printable page width in pixels
 * @param {number} page_height printable page height in pixels
 * @param {number} overlap pixels that two neighbour pages share (to glue them)
 * @returns {{row: number, column: number, x: number, y: number, width: number, height: number}[]}
 */
export function print_tiles(width, height, page_width, page_height, overlap) {
	overlap = Math.max(0, Math.round(overlap) || 0);
	page_width = Math.max(overlap + 1, Math.round(page_width));
	page_height = Math.max(overlap + 1, Math.round(page_height));
	const step_x = Math.max(1, page_width - overlap);
	const step_y = Math.max(1, page_height - overlap);
	const tiles = [];
	for (let row = 0, y = 0; y < height; row++, y += step_y) {
		for (let column = 0, x = 0; x < width; column++, x += step_x) {
			tiles.push({
				row,
				column,
				x,
				y,
				width: Math.min(page_width, width - x),
				height: Math.min(page_height, height - y),
			});
			if (x + page_width >= width) {
				break;
			}
		}
		if (y + page_height >= height) {
			break;
		}
	}
	return tiles;
}
