import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { identity_mesh, is_identity_mesh, warp_mesh } from './../../libs/mesh-warp.js';
import { t } from '../tools/translate.js';

const GRIDS = ['3 x 3', '4 x 4', '5 x 5', '6 x 6'];
const MAX_W = 520;
const MAX_H = 400;
const HANDLE = 6;

/**
 * Edit > Warp - a grid of points lies over the picture of the active layer; drag a point and the picture follows
 * (smoothly, without creases). The result shows in the dialog while the points are dragged; OK makes it in the full size.
 */
class Edit_warp_class {

	warp() {
		var layer = config.layer;
		if (layer == null || layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		var width = Math.max(1, Math.round(layer.width_original));
		var height = Math.max(1, Math.round(layer.height_original));

		//the picture of the layer in its own size
		var full = document.createElement('canvas');
		full.width = width;
		full.height = height;
		full.getContext('2d').drawImage(layer.link, 0, 0, width, height);

		this.mesh = identity_mesh(4, 4);
		var _this = this;
		new Dialog_class().show({
			title: 'Warp',
			params: [
				{name: "grid", title: "Grid:", values: GRIDS, value: '4 x 4'},
			],
			on_load: function (params, popup) {
				_this.build_editor(popup, full);
			},
			on_finish: function () {
				return _this.apply(layer, full);
			},
		});
	}

	/**
	 * @param {HTMLCanvasElement} full the picture in its own size
	 */
	build_editor(popup, full) {
		var scale = Math.min(1, MAX_W / full.width, MAX_H / full.height);
		var cw = Math.max(1, Math.round(full.width * scale));
		var ch = Math.max(1, Math.round(full.height * scale));

		//a smaller copy of the picture, so the preview is quick
		var small = document.createElement('canvas');
		small.width = cw;
		small.height = ch;
		var small_ctx = small.getContext('2d', {willReadFrequently: true});
		small_ctx.drawImage(full, 0, 0, cw, ch);
		var small_image = small_ctx.getImageData(0, 0, cw, ch);
		var shown = document.createElement('canvas');
		shown.width = cw;
		shown.height = ch;

		var box = document.createElement('div');
		box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin:8px auto;';
		var canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		canvas.style.cssText = 'display:block;max-width:100%;border:1px solid #888;background:#ccc;cursor:crosshair;touch-action:none;';
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', t('Warp'));
		var hint = document.createElement('small');
		hint.textContent = t('Drag the points of the grid. Double-click a point to put it back.');
		var reset = document.createElement('button');
		reset.type = 'button';
		reset.textContent = t('Reset');
		box.appendChild(canvas);
		box.appendChild(hint);
		box.appendChild(reset);
		popup.el.querySelector('.dialog_content').appendChild(box);
		var ctx = canvas.getContext('2d');

		var base = (index) => ({x: (index % this.mesh.cols) / (this.mesh.cols - 1) * cw, y: Math.floor(index / this.mesh.cols) / (this.mesh.rows - 1) * ch});
		var position = (index) => {
			var b = base(index);
			return {x: b.x + this.mesh.dx[index] * cw, y: b.y + this.mesh.dy[index] * ch};
		};

		var draw = () => {
			ctx.clearRect(0, 0, cw, ch);
			var warped = warp_mesh(small_image, this.mesh);
			shown.getContext('2d').putImageData(new ImageData(warped.data, cw, ch), 0, 0);
			ctx.drawImage(shown, 0, 0);

			//the grid
			var line = (from, to) => {
				ctx.moveTo(from.x, from.y);
				ctx.lineTo(to.x, to.y);
			};
			ctx.beginPath();
			for (var row = 0; row < this.mesh.rows; row++) {
				for (var col = 0; col < this.mesh.cols; col++) {
					var index = row * this.mesh.cols + col;
					if (col + 1 < this.mesh.cols) {
						line(position(index), position(index + 1));
					}
					if (row + 1 < this.mesh.rows) {
						line(position(index), position(index + this.mesh.cols));
					}
				}
			}
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
			ctx.stroke();
			ctx.lineWidth = 1;
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
			ctx.stroke();
			for (var k = 0; k < this.mesh.dx.length; k++) {
				var p = position(k);
				ctx.beginPath();
				ctx.arc(p.x, p.y, HANDLE, 0, Math.PI * 2);
				ctx.fillStyle = (Math.abs(this.mesh.dx[k]) > 1e-6 || Math.abs(this.mesh.dy[k]) > 1e-6) ? '#0a84ff' : '#ffffff';
				ctx.fill();
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = '#222';
				ctx.stroke();
			}
		};

		var scheduled = false;
		var redraw = () => {
			if (scheduled) {
				return;
			}
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				draw();
			});
		};

		var from_event = (event) => {
			var rect = canvas.getBoundingClientRect();
			return {x: (event.clientX - rect.left) * cw / rect.width, y: (event.clientY - rect.top) * ch / rect.height};
		};
		var nearest = (point) => {
			var best = -1;
			var best_distance = HANDLE * 2;
			for (var k = 0; k < this.mesh.dx.length; k++) {
				var p = position(k);
				var distance = Math.hypot(p.x - point.x, p.y - point.y);
				if (distance <= best_distance) {
					best = k;
					best_distance = distance;
				}
			}
			return best;
		};

		var dragged = -1;
		canvas.addEventListener('pointerdown', (event) => {
			dragged = nearest(from_event(event));
			if (dragged >= 0) {
				canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
				event.preventDefault();
			}
		});
		canvas.addEventListener('pointermove', (event) => {
			if (dragged < 0) {
				return;
			}
			var point = from_event(event);
			var b = base(dragged);
			this.mesh.dx[dragged] = (point.x - b.x) / cw;
			this.mesh.dy[dragged] = (point.y - b.y) / ch;
			redraw();
		});
		var release = () => {
			dragged = -1;
		};
		canvas.addEventListener('pointerup', release);
		canvas.addEventListener('pointercancel', release);
		canvas.addEventListener('dblclick', (event) => {
			var k = nearest(from_event(event));
			if (k >= 0) {
				this.mesh.dx[k] = 0;
				this.mesh.dy[k] = 0;
				redraw();
			}
		});
		reset.addEventListener('click', () => {
			this.mesh = identity_mesh(this.mesh.cols, this.mesh.rows);
			redraw();
		});

		//another grid starts again from the untouched picture
		var current_grid = '4 x 4';
		popup.el.addEventListener('change', () => setTimeout(() => {
			var grid = (popup.get_params() || {}).grid;
			if (grid && grid != current_grid && GRIDS.includes(grid)) {
				current_grid = grid;
				var size = parseInt(grid, 10);
				this.mesh = identity_mesh(size, size);
			}
			redraw();
		}, 0));
		draw();
	}

	apply(layer, full) {
		if (is_identity_mesh(this.mesh)) {
			return;
		}
		var source = full.getContext('2d').getImageData(0, 0, full.width, full.height);
		var result = warp_mesh(source, this.mesh);
		var canvas = document.createElement('canvas');
		canvas.width = full.width;
		canvas.height = full.height;
		canvas.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
		return app.State.do_action(
			new app.Actions.Bundle_action('warp_layer', 'Warp', [
				new app.Actions.Update_layer_image_action(canvas, layer.id),
			])
		);
	}
}

export default Edit_warp_class;
