/**
 * Skew, Perspective and Distort of a picture: the rectangle of the picture is moved onto any four-cornered shape.
 * Pure functions, no DOM.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 * @typedef {number[][]} Quad four corners [x, y]: top left, top right, bottom right, bottom left
 */

export const DISTORT_CORNERS = ['tl', 'tr', 'br', 'bl'];

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

/**
 * The four corners of the picture after a skew, a perspective or a distort
 *
 * @param {'skew'|'perspective'|'distort'} mode
 * @param {object} params skew: horizontal, vertical (degrees, -80..80);
 *   perspective: horizontal, vertical (-100..100 %); distort: tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y (pixels)
 * @param {number} width of the picture
 * @param {number} height of the picture
 * @returns {Quad}
 */
export function quad_for(mode, params, width, height) {
	const w = width;
	const h = height;
	const number = function (name) {
		return parseFloat(params[name]) || 0;
	};
	const corners = [[0, 0], [w, 0], [w, h], [0, h]];

	if (mode == 'skew') {
		//turning the picture's edges: the lines that were horizontal lean by the first angle, the vertical ones by the second
		const tan_h = Math.tan(clamp(number('horizontal'), -80, 80) * Math.PI / 180);
		const tan_v = Math.tan(clamp(number('vertical'), -80, 80) * Math.PI / 180);
		return corners.map((corner) => {
			return [corner[0] + (corner[1] - h / 2) * tan_h, corner[1] + (corner[0] - w / 2) * tan_v];
		});
	}
	if (mode == 'perspective') {
		//a positive horizontal value makes the right edge shorter (it goes away), a positive vertical one the bottom edge narrower
		const p = clamp(number('horizontal'), -100, 100) / 400;
		const q = clamp(number('vertical'), -100, 100) / 400;
		const tl = [0, 0], tr = [w, 0], br = [w, h], bl = [0, h];
		if (p > 0) {
			tr[1] = h * p;
			br[1] = h - h * p;
		}
		else if (p < 0) {
			tl[1] = -h * p;
			bl[1] = h + h * p;
		}
		if (q > 0) {
			bl[0] = w * q;
			br[0] = w - w * q;
		}
		else if (q < 0) {
			tl[0] = -w * q;
			tr[0] = w + w * q;
		}
		return [tl, tr, br, bl];
	}
	if (mode == 'distort') {
		return corners.map((corner, i) => {
			const key = DISTORT_CORNERS[i];
			return [corner[0] + number(`${key  }_x`), corner[1] + number(`${key  }_y`)];
		});
	}
	return corners;
}

/**
 * @param {Quad} quad
 * @returns {{x: number, y: number, width: number, height: number}} the smallest whole-pixel rectangle around the shape
 */
export function quad_bounds(quad) {
	const xs = quad.map((c) => { return c[0]; });
	const ys = quad.map((c) => { return c[1]; });
	const x = Math.floor(Math.min.apply(null, xs));
	const y = Math.floor(Math.min.apply(null, ys));
	return {
		x,
		y,
		width: Math.max(1, Math.ceil(Math.max.apply(null, xs)) - x),
		height: Math.max(1, Math.ceil(Math.max.apply(null, ys)) - y),
	};
}

/**
 * @param {Quad} quad
 * @returns {boolean} the shape is a proper four-cornered shape: it does not fold over itself and has an area
 */
export function is_valid_quad(quad) {
	let sign = 0;
	for (let i = 0; i < 4; i++) {
		const a = quad[i];
		const b = quad[(i + 1) % 4];
		const c = quad[(i + 2) % 4];
		const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
		if (Math.abs(cross) < 1e-6) {
			return false;
		}
		if (sign == 0) {
			sign = cross > 0 ? 1 : -1;
		}
		else if ((cross > 0 ? 1 : -1) != sign) {
			return false;
		}
	}
	return true;
}

/**
 * The 3x3 matrix (a, b, c, d, e, f, g, h; the last element is 1) that moves four points onto four other points
 *
 * @param {number[][]} from four points
 * @param {number[][]} to four points
 * @returns {number[]|null} null when there is no such transformation (for example three points are on a line)
 */
export function solve_homography(from, to) {
	//8 equations: to_x = (a x + b y + c) / (g x + h y + 1), to_y = (d x + e y + f) / (g x + h y + 1)
	const m = [];
	for (let i = 0; i < 4; i++) {
		const x = from[i][0], y = from[i][1], u = to[i][0], v = to[i][1];
		m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
		m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
	}
	//Gaussian elimination with the pivot of the largest value
	for (let col = 0; col < 8; col++) {
		let pivot = col;
		for (let r = col + 1; r < 8; r++) {
			if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) {
				pivot = r;
			}
		}
		if (Math.abs(m[pivot][col]) < 1e-10) {
			return null;
		}
		const swap = m[col];
		m[col] = m[pivot];
		m[pivot] = swap;
		for (let row = 0; row < 8; row++) {
			if (row == col) {
				continue;
			}
			const factor = m[row][col] / m[col][col];
			for (let k = col; k < 9; k++) {
				m[row][k] -= factor * m[col][k];
			}
		}
	}
	return m.map((row, index) => { return row[8] / row[index]; });
}

/**
 * The picture moved onto the shape. Pixels of the result that are not covered by the shape are transparent.
 *
 * @param {Image_data} image
 * @param {Quad} quad where the corners of the picture go
 * @returns {{image: Image_data, x: number, y: number}|null} the new picture and where its top left corner is
 *   (in the coordinates of the quad); null when the shape is not valid
 */
export function warp_to_quad(image, quad) {
	if (!is_valid_quad(quad)) {
		return null;
	}
	const bounds = quad_bounds(quad);
	const local = quad.map((c) => { return [c[0] - bounds.x, c[1] - bounds.y]; });
	const w = image.width;
	const h = image.height;
	//from the result back to the picture
	const H = solve_homography(local, [[0, 0], [w, 0], [w, h], [0, h]]);
	if (H == null) {
		return null;
	}
	const out = new Uint8ClampedArray(bounds.width * bounds.height * 4);
	const src = image.data;
	for (let y = 0; y < bounds.height; y++) {
		for (let x = 0; x < bounds.width; x++) {
			const px = x + 0.5;
			const py = y + 0.5;
			const d = H[6] * px + H[7] * py + 1;
			if (Math.abs(d) < 1e-12) {
				continue;
			}
			const u = (H[0] * px + H[1] * py + H[2]) / d;
			const v = (H[3] * px + H[4] * py + H[5]) / d;
			//half a pixel of soft edge
			const coverage = clamp(Math.min(u, w - u, v, h - v) + 0.5, 0, 1);
			if (coverage <= 0) {
				continue;
			}
			const fx = clamp(u - 0.5, 0, w - 1);
			const fy = clamp(v - 0.5, 0, h - 1);
			const x0 = Math.floor(fx), y0 = Math.floor(fy);
			const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
			const tx = fx - x0, ty = fy - y0;
			const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
			const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
			//colors are mixed in premultiplied alpha, so transparent pixels do not bleed color into the edge
			const a = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
			if (a <= 0) {
				continue;
			}
			const o = (y * bounds.width + x) * 4;
			for (let c = 0; c < 3; c++) {
				out[o + c] = (src[i00 + c] * src[i00 + 3] * w00 + src[i10 + c] * src[i10 + 3] * w10
					+ src[i01 + c] * src[i01 + 3] * w01 + src[i11 + c] * src[i11 + 3] * w11) / a;
			}
			out[o + 3] = a * coverage;
		}
	}
	return {image: {data: out, width: bounds.width, height: bounds.height}, x: bounds.x, y: bounds.y};
}

export const DISTORT_MODES = ['distort', 'perspective', 'skew'];

//the handles: the corners and the middles of the edges
export const CORNER_HANDLES = ['tl', 'tr', 'br', 'bl'];
export const EDGE_HANDLES = ['top', 'right', 'bottom', 'left'];

/**
 * Handles that can be dragged in a mode: the corners for Distort and Perspective, the edges for Skew
 *
 * @param {string} mode
 * @returns {string[]}
 */
export function handles_for(mode) {
	return mode == 'skew' ? EDGE_HANDLES : CORNER_HANDLES;
}

/**
 * @param {Quad} quad
 * @param {string} handle one of CORNER_HANDLES or EDGE_HANDLES
 * @returns {{x: number, y: number}} where the handle is
 */
export function handle_position(quad, handle) {
	const corner = CORNER_HANDLES.indexOf(handle);
	if (corner >= 0) {
		return {x: quad[corner][0], y: quad[corner][1]};
	}
	const edge = EDGE_HANDLES.indexOf(handle); //top: tl-tr, right: tr-br, bottom: br-bl, left: bl-tl
	const a = quad[edge];
	const b = quad[(edge + 1) % 4];
	return {x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2};
}

/**
 * The handle that is near a point
 *
 * @param {Quad} quad
 * @param {string} mode
 * @param {{x: number, y: number}} point
 * @param {number} reach how far from a handle the point can be
 * @returns {string|null} the nearest handle of the mode within reach
 */
export function find_handle(quad, mode, point, reach) {
	let best = null;
	let best_distance = reach;
	handles_for(mode).forEach((handle) => {
		const p = handle_position(quad, handle);
		const distance = Math.hypot(p.x - point.x, p.y - point.y);
		if (distance <= best_distance) {
			best = handle;
			best_distance = distance;
		}
	});
	return best;
}

/**
 * The shape after a handle was dragged
 *
 * - Distort: a corner goes where it is dragged.
 * - Perspective: the corner goes where it is dragged, the neighbor on the same horizontal edge moves the opposite way
 *   sideways and the neighbor on the same vertical edge the opposite way up or down, so the shape stays symmetrical.
 * - Skew: an edge slides along itself (the top and bottom ones sideways, the left and right ones up and down).
 *
 * @param {Quad} start the shape when the drag began
 * @param {string} mode
 * @param {string} handle
 * @param {number} dx how far the handle was dragged sideways
 * @param {number} dy and up or down
 * @returns {Quad} a new shape
 */
export function drag_handle(start, mode, handle, dx, dy) {
	const quad = start.map((c) => { return [c[0], c[1]]; });
	const move = function (index, x, y) {
		quad[index][0] += x;
		quad[index][1] += y;
	};
	const corner = CORNER_HANDLES.indexOf(handle);
	if (mode == 'skew') {
		const edge = EDGE_HANDLES.indexOf(handle);
		if (edge >= 0) {
			const horizontal = edge == 0 || edge == 2; //the top and the bottom edge slide sideways
			move(edge, horizontal ? dx : 0, horizontal ? 0 : dy);
			move((edge + 1) % 4, horizontal ? dx : 0, horizontal ? 0 : dy);
		}
		return quad;
	}
	if (corner < 0) {
		return quad;
	}
	move(corner, dx, dy);
	if (mode == 'perspective') {
		//corners are in the order tl, tr, br, bl: the horizontal neighbor of 0 is 1, of 2 is 3, the vertical one of 0 is 3, of 1 is 2
		const horizontal_neighbor = [1, 0, 3, 2][corner];
		const vertical_neighbor = [3, 2, 1, 0][corner];
		move(horizontal_neighbor, -dx, 0);
		move(vertical_neighbor, 0, -dy);
	}
	return quad;
}
