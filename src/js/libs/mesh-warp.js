/**
 * Warp (Photoshop): a grid of control points lies over the picture; moving a point drags the picture with it.
 * The displacement of the points is smoothed between them (Catmull-Rom), so the picture bends without creases.
 * Pure functions, no DOM.
 *
 * @typedef {{data: Uint8ClampedArray, width: number, height: number}} Image_data
 * @typedef {{cols: number, rows: number, dx: Float32Array, dy: Float32Array}} Mesh
 *   cols x rows points, row by row; dx, dy = how far every point moved, as a share of the width / height of the picture
 */

export const MIN_POINTS = 2;
export const MAX_POINTS = 12;
const INVERSE_STEPS = 4;

/**
 * @param {number} cols points in a row (2-12)
 * @param {number} rows points in a column (2-12)
 * @returns {Mesh} a mesh where nothing is moved
 */
export function identity_mesh(cols, rows) {
	cols = Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(cols) || MIN_POINTS));
	rows = Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(rows) || MIN_POINTS));
	return {cols: cols, rows: rows, dx: new Float32Array(cols * rows), dy: new Float32Array(cols * rows)};
}

/**
 * @param {Mesh} mesh
 * @returns {boolean} no point is moved
 */
export function is_identity_mesh(mesh) {
	for (var i = 0; i < mesh.dx.length; i++) {
		if (Math.abs(mesh.dx[i]) > 1e-6 || Math.abs(mesh.dy[i]) > 1e-6) {
			return false;
		}
	}
	return true;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

//weights of the four neighbors of a Catmull-Rom curve
function weights(t) {
	var t2 = t * t;
	var t3 = t2 * t;
	return [
		0.5 * (-t3 + 2 * t2 - t),
		0.5 * (3 * t3 - 5 * t2 + 2),
		0.5 * (-3 * t3 + 4 * t2 + t),
		0.5 * (t3 - t2),
	];
}

/**
 * How far the picture is moved at a place
 *
 * @param {Mesh} mesh
 * @param {number} u 0-1 across the picture
 * @param {number} v 0-1 down the picture
 * @param {number[]} [out] result [dx, dy] (a new array when missing)
 * @returns {number[]}
 */
export function displacement_at(mesh, u, v, out) {
	out = out || [0, 0];
	var gx = clamp(u, 0, 1) * (mesh.cols - 1);
	var gy = clamp(v, 0, 1) * (mesh.rows - 1);
	var i = Math.min(mesh.cols - 2, Math.floor(gx));
	var j = Math.min(mesh.rows - 2, Math.floor(gy));
	var wx = weights(gx - i);
	var wy = weights(gy - j);
	var sx = 0, sy = 0;
	for (var b = 0; b < 4; b++) {
		var row = clamp(j - 1 + b, 0, mesh.rows - 1);
		var rx = 0, ry = 0;
		for (var a = 0; a < 4; a++) {
			var col = clamp(i - 1 + a, 0, mesh.cols - 1);
			rx += mesh.dx[row * mesh.cols + col] * wx[a];
			ry += mesh.dy[row * mesh.cols + col] * wx[a];
		}
		sx += rx * wy[b];
		sy += ry * wy[b];
	}
	out[0] = sx;
	out[1] = sy;
	return out;
}

/**
 * The picture warped by the mesh. A new picture of the same size; places that nothing moves into are transparent.
 *
 * @param {Image_data} image
 * @param {Mesh} mesh
 * @returns {Image_data}
 */
export function warp_mesh(image, mesh) {
	var w = image.width;
	var h = image.height;
	var src = image.data;
	var out = new Uint8ClampedArray(src.length);
	var d = [0, 0];
	for (var y = 0; y < h; y++) {
		for (var x = 0; x < w; x++) {
			//the pixel shows what was at the place the picture was moved from: a point q went to q + displacement(q),
			//so the place is found by a few steps of q = p - displacement(q) (one step is enough for small moves only)
			var qx = x + 0.5;
			var qy = y + 0.5;
			for (var step = 0; step < INVERSE_STEPS; step++) {
				displacement_at(mesh, qx / w, qy / h, d);
				qx = x + 0.5 - d[0] * w;
				qy = y + 0.5 - d[1] * h;
			}
			var sx = qx - 0.5;
			var sy = qy - 0.5;
			var x0 = Math.floor(sx), y0 = Math.floor(sy);
			var tx = sx - x0, ty = sy - y0;
			var a = 0, r = 0, g = 0, b = 0;
			for (var j = 0; j < 2; j++) {
				var yy = y0 + j;
				if (yy < 0 || yy >= h) {
					continue;
				}
				for (var i = 0; i < 2; i++) {
					var xx = x0 + i;
					if (xx < 0 || xx >= w) {
						continue;
					}
					var weight = (i ? tx : 1 - tx) * (j ? ty : 1 - ty);
					var p = (yy * w + xx) * 4;
					//premultiplied alpha, so transparent pixels do not bleed color into the edge
					var pa = src[p + 3] * weight;
					a += pa;
					r += src[p] * pa;
					g += src[p + 1] * pa;
					b += src[p + 2] * pa;
				}
			}
			if (a > 0) {
				var o = (y * w + x) * 4;
				out[o] = r / a;
				out[o + 1] = g / a;
				out[o + 2] = b / a;
				out[o + 3] = a;
			}
		}
	}
	return {data: out, width: w, height: h};
}
