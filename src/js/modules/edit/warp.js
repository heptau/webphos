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
		const layer = config.layer;
		if (layer == null || layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}
		const width = Math.max(1, Math.round(layer.width_original));
		const height = Math.max(1, Math.round(layer.height_original));

		//the picture of the layer in its own size
		const full = document.createElement('canvas');
		full.width = width;
		full.height = height;
		full.getContext('2d').drawImage(layer.link, 0, 0, width, height);

		this.mesh = identity_mesh(4, 4);
		new Dialog_class().show({
			title: 'Warp',
			params: [
				{name: "grid", title: "Grid:", values: GRIDS, value: '4 x 4'},
			],
			on_load: (params, popup) => {
				this.build_editor(popup, full);
			},
			on_finish: () => {
				return this.apply(layer, full);
			},
		});
	}

	/**
	 * @param {HTMLCanvasElement} full the picture in its own size
	 */
	build_editor(popup, full) {
		const scale = Math.min(1, MAX_W / full.width, MAX_H / full.height);
		const cw = Math.max(1, Math.round(full.width * scale));
		const ch = Math.max(1, Math.round(full.height * scale));

		//a smaller copy of the picture, so the preview is quick
		const small = document.createElement('canvas');
		small.width = cw;
		small.height = ch;
		const small_ctx = small.getContext('2d', {willReadFrequently: true});
		small_ctx.drawImage(full, 0, 0, cw, ch);
		const small_image = small_ctx.getImageData(0, 0, cw, ch);
		const shown = document.createElement('canvas');
		shown.width = cw;
		shown.height = ch;

		const box = document.createElement('div');
		box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin:8px auto;';
		const canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		canvas.style.cssText = 'display:block;max-width:100%;border:1px solid #888;background:#ccc;cursor:crosshair;touch-action:none;';
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', t('Warp'));
		const hint = document.createElement('small');
		hint.textContent = t('Drag the points of the grid. Double-click a point to put it back.');
		const reset = document.createElement('button');
		reset.type = 'button';
		reset.textContent = t('Reset');
		box.appendChild(canvas);
		box.appendChild(hint);
		box.appendChild(reset);
		popup.el.querySelector('.dialog_content').appendChild(box);
		const ctx = canvas.getContext('2d');

		const base = (index) => ({x: (index % this.mesh.cols) / (this.mesh.cols - 1) * cw, y: Math.floor(index / this.mesh.cols) / (this.mesh.rows - 1) * ch});
		const position = (index) => {
			const b = base(index);
			return {x: b.x + this.mesh.dx[index] * cw, y: b.y + this.mesh.dy[index] * ch};
		};

		const draw = () => {
			ctx.clearRect(0, 0, cw, ch);
			const warped = warp_mesh(small_image, this.mesh);
			shown.getContext('2d').putImageData(new ImageData(warped.data, cw, ch), 0, 0);
			ctx.drawImage(shown, 0, 0);

			//the grid
			const line = (from, to) => {
				ctx.moveTo(from.x, from.y);
				ctx.lineTo(to.x, to.y);
			};
			ctx.beginPath();
			for (let row = 0; row < this.mesh.rows; row++) {
				for (let col = 0; col < this.mesh.cols; col++) {
					const index = row * this.mesh.cols + col;
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
			for (let k = 0; k < this.mesh.dx.length; k++) {
				const p = position(k);
				ctx.beginPath();
				ctx.arc(p.x, p.y, HANDLE, 0, Math.PI * 2);
				ctx.fillStyle = (Math.abs(this.mesh.dx[k]) > 1e-6 || Math.abs(this.mesh.dy[k]) > 1e-6) ? '#0a84ff' : '#ffffff';
				ctx.fill();
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = '#222';
				ctx.stroke();
			}
		};

		let scheduled = false;
		const redraw = () => {
			if (scheduled) {
				return;
			}
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				draw();
			});
		};

		const from_event = (event) => {
			const rect = canvas.getBoundingClientRect();
			return {x: (event.clientX - rect.left) * cw / rect.width, y: (event.clientY - rect.top) * ch / rect.height};
		};
		const nearest = (point) => {
			let best = -1;
			let best_distance = HANDLE * 2;
			for (let k = 0; k < this.mesh.dx.length; k++) {
				const p = position(k);
				const distance = Math.hypot(p.x - point.x, p.y - point.y);
				if (distance <= best_distance) {
					best = k;
					best_distance = distance;
				}
			}
			return best;
		};

		let dragged = -1;
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
			const point = from_event(event);
			const b = base(dragged);
			this.mesh.dx[dragged] = (point.x - b.x) / cw;
			this.mesh.dy[dragged] = (point.y - b.y) / ch;
			redraw();
		});
		const release = () => {
			dragged = -1;
		};
		canvas.addEventListener('pointerup', release);
		canvas.addEventListener('pointercancel', release);
		canvas.addEventListener('dblclick', (event) => {
			const k = nearest(from_event(event));
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
		let current_grid = '4 x 4';
		popup.el.addEventListener('change', () => setTimeout(() => {
			const grid = (popup.get_params() || {}).grid;
			if (grid && grid != current_grid && GRIDS.includes(grid)) {
				current_grid = grid;
				const size = parseInt(grid, 10);
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
		const source = full.getContext('2d').getImageData(0, 0, full.width, full.height);
		const result = warp_mesh(source, this.mesh);
		const canvas = document.createElement('canvas');
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
