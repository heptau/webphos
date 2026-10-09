/**
 * Distort filters (twirl, wave) and the clouds render filter, working on ImageData-like objects
 * ({data, width, height}). Data is modified in place and the same object is returned.
 * Distort parameters are relative to the image size, so a small dialog preview looks like the real result.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 */

import { parseHex } from './adjustments.js';

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Bilinear sample; positions outside of the image use the nearest edge pixel.
 * Works in premultiplied alpha so transparent pixels do not bleed color into the edges.
 */
function sample(src, width, height, x, y, out) {
	x = clamp(x - 0.5, 0, width - 1);
	y = clamp(y - 0.5, 0, height - 1);
	const x0 = Math.floor(x), y0 = Math.floor(y);
	const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
	const fx = x - x0, fy = y - y0;
	const i00 = (y0 * width + x0) * 4, i10 = (y0 * width + x1) * 4;
	const i01 = (y1 * width + x0) * 4, i11 = (y1 * width + x1) * 4;
	const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;

	const a = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
	if (a <= 0) {
		out[0] = out[1] = out[2] = out[3] = 0;
		return;
	}
	for (let c = 0; c < 3; c++) {
		out[c] = (src[i00 + c] * src[i00 + 3] * w00 + src[i10 + c] * src[i10 + 3] * w10
			+ src[i01 + c] * src[i01 + 3] * w01 + src[i11 + c] * src[i11 + 3] * w11) / a;
	}
	out[3] = a;
}

/**
 * Generic remap: every output pixel takes its color from the position returned by the mapper.
 *
 * @param {Image_data} image
 * @param {function(number, number, number[]): void} mapper writes the source position [x, y] for the output pixel (x, y)
 * @returns {Image_data}
 */
export function remap(image, mapper) {
	const w = image.width;
	const h = image.height;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	const position = [0, 0];
	const color = [0, 0, 0, 0];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			position[0] = x + 0.5;
			position[1] = y + 0.5;
			mapper(position[0], position[1], position);
			sample(src, w, h, position[0], position[1], color);
			const i = (y * w + x) * 4;
			data[i] = color[0];
			data[i + 1] = color[1];
			data[i + 2] = color[2];
			data[i + 3] = color[3];
		}
	}
	return image;
}

/**
 * Twirl - rotates the image around its center, more in the middle than at the edge of the radius
 *
 * @param {Image_data} image
 * @param {object} params angle (-720..720 degrees), radius (1-100 % of the shorter side, default 50)
 * @returns {Image_data}
 */
export function twirl(image, params) {
	const angle = clamp(parseFloat(params.angle) || 0, -720, 720) * Math.PI / 180;
	const radius = clamp(parseFloat(params.radius ?? 50) || 50, 1, 100) / 100 * Math.min(image.width, image.height);
	if (angle == 0) {
		return image;
	}
	const cx = image.width / 2;
	const cy = image.height / 2;
	return remap(image, (x, y, position) => {
		const dx = x - cx;
		const dy = y - cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance >= radius) {
			return;
		}
		const factor = 1 - distance / radius;
		const theta = angle * factor * factor;
		const cos = Math.cos(theta);
		const sin = Math.sin(theta);
		position[0] = cx + dx * cos - dy * sin;
		position[1] = cy + dx * sin + dy * cos;
	});
}

/**
 * Wave - sine shaped displacement
 *
 * @param {Image_data} image
 * @param {object} params amplitude (0-30 % of the image size), wavelength (1-100 % of the image size),
 *   direction ('horizontal' moves rows sideways, 'vertical' moves columns up and down)
 * @returns {Image_data}
 */
export function wave(image, params) {
	const vertical = params.direction === 'vertical';
	const size = vertical ? image.width : image.height; //length along the wave
	const across = vertical ? image.height : image.width;
	const amplitude = clamp(parseFloat(params.amplitude) || 0, 0, 30) / 100 * across;
	const wavelength = Math.max(2, clamp(parseFloat(params.wavelength ?? 20) || 20, 1, 100) / 100 * size);
	if (amplitude == 0) {
		return image;
	}
	return remap(image, (x, y, position) => {
		if (vertical) {
			position[1] = y + amplitude * Math.sin(2 * Math.PI * x / wavelength);
		}
		else {
			position[0] = x + amplitude * Math.sin(2 * Math.PI * y / wavelength);
		}
	});
}

/**
 * Small seeded random generator (mulberry32), so the same seed always gives the same clouds
 */
function seeded_random(seed) {
	let state = (parseInt(seed) || 0) >>> 0;
	return function () {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Fractal noise in the range 0..1 for every pixel (value noise, 6 octaves, smooth interpolation)
 *
 * @param {number} width
 * @param {number} height
 * @param {number} scale size of the largest clouds in pixels
 * @param {number} seed
 * @returns {Float32Array} width * height values
 */
export function cloud_noise(width, height, scale, seed) {
	const OCTAVES = 6;
	const random = seeded_random(seed);
	const result = new Float32Array(width * height);
	let total = 0;
	let amplitude = 1;
	for (let o = 0; o < OCTAVES; o++) {
		const cell = Math.max(1, scale / Math.pow(2, o));
		const cols = Math.ceil(width / cell) + 2;
		const rows = Math.ceil(height / cell) + 2;
		const lattice = new Float32Array(cols * rows);
		for (let i = 0; i < lattice.length; i++) {
			lattice[i] = random();
		}
		for (let y = 0; y < height; y++) {
			const gy = y / cell;
			const y0 = Math.floor(gy);
			let ty = gy - y0;
			ty = ty * ty * (3 - 2 * ty);
			for (let x = 0; x < width; x++) {
				const gx = x / cell;
				const x0 = Math.floor(gx);
				let tx = gx - x0;
				tx = tx * tx * (3 - 2 * tx);
				const a = lattice[y0 * cols + x0] * (1 - tx) + lattice[y0 * cols + x0 + 1] * tx;
				const b = lattice[(y0 + 1) * cols + x0] * (1 - tx) + lattice[(y0 + 1) * cols + x0 + 1] * tx;
				result[y * width + x] += (a * (1 - ty) + b * ty) * amplitude;
			}
		}
		total += amplitude;
		amplitude /= 2;
	}
	for (let k = 0; k < result.length; k++) {
		result[k] /= total;
	}
	return result;
}

/**
 * Clouds - fills the image with clouds between two colors and blends it with the original by opacity
 *
 * @param {Image_data} image
 * @param {object} params scale (2-100 % of the longer side), seed, color1, color2 (hex), opacity (0-100),
 *   contrast (0-100, stretches the noise)
 * @returns {Image_data}
 */
export function clouds(image, params) {
	const scale = clamp(parseFloat(params.scale ?? 30) || 30, 2, 100) / 100 * Math.max(image.width, image.height);
	const opacity = clamp(parseFloat(params.opacity ?? 100), 0, 100) / 100;
	const contrast = clamp(parseFloat(params.contrast) || 0, 0, 100) / 100;
	const c1 = parseHex(params.color1 || '#000000');
	const c2 = parseHex(params.color2 || '#ffffff');
	if (opacity == 0 || isNaN(opacity)) {
		return image;
	}
	const noise = cloud_noise(image.width, image.height, scale, params.seed);

	//stretch the noise around its mean so contrast actually changes something
	let min = Infinity, max = -Infinity;
	for (let n = 0; n < noise.length; n++) {
		if (noise[n] < min) min = noise[n];
		if (noise[n] > max) max = noise[n];
	}
	const range = max - min || 1;

	const data = image.data;
	for (let p = 0, i = 0; p < noise.length; p++, i += 4) {
		let t = (noise[p] - min) / range;
		t = clamp((t - 0.5) * (1 + contrast * 3) + 0.5, 0, 1);
		const a0 = data[i + 3] / 255;
		const a = a0 + (1 - a0) * opacity; //result alpha
		for (let c = 0; c < 3; c++) {
			const cloud = c1[c] + (c2[c] - c1[c]) * t;
			//premultiplied mix of the original (weight a0 * (1 - opacity)) and the cloud (weight opacity)
			data[i + c] = (data[i + c] * a0 * (1 - opacity) + cloud * opacity) / a;
		}
		data[i + 3] = a * 255;
	}
	return image;
}

/**
 * Lens Flare - adds a bright glow and a few soft rings ("ghosts") along the line through the image center,
 * like light reflected in camera lenses. The effect is added to the image (additive blending).
 *
 * @param {Image_data} image
 * @param {object} params x, y (0-100 % position of the light), brightness (0-300 %, default 100)
 * @returns {Image_data}
 */
export function lensFlare(image, params) {
	let value;
	const w = image.width;
	const h = image.height;
	const brightness = clamp(parseFloat(params.brightness ?? 100), 0, 300) / 100;
	if (brightness == 0 || isNaN(brightness) || w == 0 || h == 0) {
		return image;
	}
	const size = Math.min(w, h);
	const lx = clamp(parseFloat(params.x ?? 30), 0, 100) / 100 * w;
	const ly = clamp(parseFloat(params.y ?? 30), 0, 100) / 100 * h;
	const cx = w / 2;
	const cy = h / 2;

	//light sources: [x, y, radius, intensity, color, ring] - ring sources are thin circles, others are glows
	const sources = [
		{x: lx, y: ly, radius: size * 0.35, intensity: 0.9, color: [255, 245, 220], ring: false},
		{x: lx, y: ly, radius: size * 0.06, intensity: 1.0, color: [255, 255, 255], ring: false},
	];
	[[-0.35, 0.10, 0.5, [255, 160, 90]], [0.45, 0.07, 0.45, [140, 200, 255]], [0.8, 0.14, 0.4, [150, 255, 160]], [1.25, 0.20, 0.35, [255, 120, 200]]]
		.forEach((ghost) => {
			sources.push({
				x: lx + (cx - lx) * (1 + ghost[0]),
				y: ly + (cy - ly) * (1 + ghost[0]),
				radius: size * ghost[1],
				intensity: ghost[2],
				color: ghost[3],
				ring: true,
			});
		});

	const data = image.data;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let r = 0, g = 0, b = 0;
			for (let s = 0; s < sources.length; s++) {
				const source = sources[s];
				const d = Math.sqrt((x - source.x) * (x - source.x) + (y - source.y) * (y - source.y)) / source.radius;
				if (source.ring) {
					//soft ring at the edge of the circle with a faint fill
					const edge = d - 1;
					value = Math.exp(-edge * edge * 18) * 0.8 + (d < 1 ? 0.12 * (1 - d) : 0);
				}
				else {
					value = Math.exp(-d * d * 3);
				}
				value *= source.intensity * brightness;
				r += source.color[0] * value;
				g += source.color[1] * value;
				b += source.color[2] * value;
			}
			const i = (y * w + x) * 4;
			data[i] = Math.min(255, data[i] + r);
			data[i + 1] = Math.min(255, data[i + 1] + g);
			data[i + 2] = Math.min(255, data[i + 2] + b);
		}
	}
	return image;
}

/**
 * Spherize - the middle of the image bulges like on a ball (positive amount) or is pinched (negative)
 *
 * @param {Image_data} image
 * @param {object} params amount (-100..100 %), radius (10-100 % of the shorter side, default 100)
 * @returns {Image_data}
 */
export function spherize(image, params) {
	const amount = clamp(parseFloat(params.amount) || 0, -100, 100) / 100 * 0.95;
	const radius = clamp(parseFloat(params.radius ?? 100) || 100, 10, 100) / 100 * Math.min(image.width, image.height) / 2;
	if (amount == 0) {
		return image;
	}
	const cx = image.width / 2;
	const cy = image.height / 2;
	return remap(image, (x, y, position) => {
		const dx = x - cx;
		const dy = y - cy;
		const r = Math.sqrt(dx * dx + dy * dy) / radius;
		if (r >= 1) {
			return;
		}
		//a smooth lens: the source is closer to the center (bulge) or farther from it (pinch)
		const k = 1 - amount * (1 - r * r);
		position[0] = cx + dx * k;
		position[1] = cy + dy * k;
	});
}

/**
 * Ripple - circles spreading from the center, like a stone dropped in water
 *
 * @param {Image_data} image
 * @param {object} params amplitude (0-10 % of the shorter side), wavelength (1-100 % of the shorter side)
 * @returns {Image_data}
 */
export function ripple(image, params) {
	const size = Math.min(image.width, image.height);
	const amplitude = clamp(parseFloat(params.amplitude) || 0, 0, 10) / 100 * size;
	const wavelength = Math.max(2, clamp(parseFloat(params.wavelength ?? 10) || 10, 1, 100) / 100 * size);
	if (amplitude == 0) {
		return image;
	}
	const cx = image.width / 2;
	const cy = image.height / 2;
	return remap(image, (x, y, position) => {
		const dx = x - cx;
		const dy = y - cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance == 0) {
			return;
		}
		const shift = amplitude * Math.sin(2 * Math.PI * distance / wavelength);
		position[0] = x + dx / distance * shift;
		position[1] = y + dy / distance * shift;
	});
}

/**
 * Kaleidoscope - one wedge of the image is mirrored around the center
 *
 * @param {Image_data} image
 * @param {object} params segments (2-24), angle (0-360 degrees, turns the wedge)
 * @returns {Image_data}
 */
export function kaleidoscope(image, params) {
	const segments = clamp(Math.round(parseFloat(params.segments ?? 6)) || 6, 2, 24);
	const offset = (parseFloat(params.angle) || 0) * Math.PI / 180;
	const cx = image.width / 2;
	const cy = image.height / 2;
	const wedge = 2 * Math.PI / segments;
	return remap(image, (x, y, position) => {
		const dx = x - cx;
		const dy = y - cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		let theta = Math.atan2(dy, dx) - offset;
		theta = ((theta % wedge) + wedge) % wedge;
		if (theta > wedge / 2) {
			theta = wedge - theta; //the second half of the wedge is the mirror image
		}
		theta += offset;
		position[0] = cx + distance * Math.cos(theta);
		position[1] = cy + distance * Math.sin(theta);
	});
}

/**
 * Radial Blur - Spin blurs along circles around the center, Zoom along lines from the center
 *
 * @param {Image_data} image
 * @param {object} params mode ('spin'|'zoom'), amount (0-100), center_x, center_y (0-100 % of the size, default 50)
 * @returns {Image_data}
 */
export function radialBlur(image, params) {
	let px, py;
	const amount = clamp(parseFloat(params.amount) || 0, 0, 100) / 100;
	if (amount == 0) {
		return image;
	}
	const zoom = params.mode === 'zoom';
	const w = image.width;
	const h = image.height;
	const cx = clamp(parseFloat(params.center_x ?? 50), 0, 100) / 100 * w;
	const cy = clamp(parseFloat(params.center_y ?? 50), 0, 100) / 100 * h;
	const src = new Uint8ClampedArray(image.data);
	const data = image.data;
	const STEPS = 16;
	const color = [0, 0, 0, 0];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const dx = x + 0.5 - cx;
			const dy = y + 0.5 - cy;
			let r = 0, g = 0, b = 0, a = 0;
			for (let s = 0; s < STEPS; s++) {
				const t = s / (STEPS - 1) - 0.5; //-0.5 .. 0.5 around the pixel
				if (zoom) {
					const scale = 1 + t * amount * 0.5;
					px = cx + dx * scale;
					py = cy + dy * scale;
				}
				else {
					const angle = t * amount * 0.5; //radians, up to about 28 degrees at most
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);
					px = cx + dx * cos - dy * sin;
					py = cy + dx * sin + dy * cos;
				}
				sample(src, w, h, px, py, color);
				//premultiplied sums, so transparent pixels do not darken the result
				r += color[0] * color[3];
				g += color[1] * color[3];
				b += color[2] * color[3];
				a += color[3];
			}
			const i = (y * w + x) * 4;
			if (a > 0) {
				data[i] = r / a;
				data[i + 1] = g / a;
				data[i + 2] = b / a;
			}
			data[i + 3] = a / STEPS;
		}
	}
	return image;
}

/**
 * Crystallize - the image breaks into irregular cells of one color each
 *
 * @param {Image_data} image
 * @param {object} params size (1-30 % of the shorter side, the average cell size), seed (any number)
 * @returns {Image_data}
 */
export function crystallize(image, params) {
	const size = Math.max(3, clamp(parseFloat(params.size ?? 4) || 4, 1, 30) / 100 * Math.min(image.width, image.height));
	const w = image.width;
	const h = image.height;
	const cols = Math.max(1, Math.ceil(w / size));
	const rows = Math.max(1, Math.ceil(h / size));
	const cell_w = w / cols;
	const cell_h = h / rows;
	const random = seeded_random(params.seed);

	//one point in every cell of a grid, moved randomly inside its cell
	const points = new Float32Array(cols * rows * 2);
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const p = (row * cols + col) * 2;
			points[p] = (col + 0.15 + random() * 0.7) * cell_w;
			points[p + 1] = (row + 0.15 + random() * 0.7) * cell_h;
		}
	}

	const owner = new Int32Array(w * h);
	const sums = new Float64Array(cols * rows * 5);
	const data = image.data;
	for (let y = 0; y < h; y++) {
		const cell_row = Math.min(rows - 1, Math.floor(y / cell_h));
		for (let x = 0; x < w; x++) {
			const cell_col = Math.min(cols - 1, Math.floor(x / cell_w));
			//the nearest point is in the cell of the pixel or in one of its neighbors
			let best = -1;
			let best_distance = Infinity;
			for (let r = Math.max(0, cell_row - 1); r <= Math.min(rows - 1, cell_row + 1); r++) {
				for (let c = Math.max(0, cell_col - 1); c <= Math.min(cols - 1, cell_col + 1); c++) {
					const q = (r * cols + c) * 2;
					const ddx = points[q] - x - 0.5;
					const ddy = points[q + 1] - y - 0.5;
					const d = ddx * ddx + ddy * ddy;
					if (d < best_distance) {
						best_distance = d;
						best = r * cols + c;
					}
				}
			}
			const index = y * w + x;
			owner[index] = best;
			const alpha = data[index * 4 + 3];
			sums[best * 5] += data[index * 4] * alpha;
			sums[best * 5 + 1] += data[index * 4 + 1] * alpha;
			sums[best * 5 + 2] += data[index * 4 + 2] * alpha;
			sums[best * 5 + 3] += alpha;
			sums[best * 5 + 4] += 1;
		}
	}
	for (let k = 0; k < w * h; k++) {
		const o = owner[k] * 5;
		const weight = sums[o + 3];
		if (weight > 0) {
			data[k * 4] = sums[o] / weight;
			data[k * 4 + 1] = sums[o + 1] / weight;
			data[k * 4 + 2] = sums[o + 2] / weight;
		}
		data[k * 4 + 3] = sums[o + 3] / sums[o + 4];
	}
	return image;
}
