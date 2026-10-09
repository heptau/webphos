import * as Adjustments from './../../libs/adjustments.js';

/**
 * Adds the curve graph to a dialog: click on the graph adds a point, dragging bends the curve, a double click
 * removes a point. The Channel list of the dialog (`channel` parameter) selects the curve that is shown and edited.
 * The points are changed in place in `curves` ({rgb, red, green, blue} -> [[x, y], ...]).
 *
 * @param {any} popup the Dialog_class instance
 * @param {Object<string, number[][]>} curves
 * @param {HTMLCanvasElement|null} [histogram_source] picture whose histogram is drawn behind the curve
 */
export function build_curve_editor(popup, curves, histogram_source) {
	const SIZE = 256;
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	canvas.className = 'curve_editor';
	canvas.style.cssText = 'display:block;margin:8px auto;border:1px solid #888;background:#fff;cursor:crosshair;touch-action:none;';
	popup.el.querySelector('.dialog_content').appendChild(canvas);
	const ctx = canvas.getContext('2d');
	let dragged = null;

	//histogram of the layer behind the curve (square root keeps small values visible)
	let histogram = null;
	try {
		histogram = histogram_source
			? Adjustments.histograms(histogram_source.getContext('2d').getImageData(0, 0, histogram_source.width, histogram_source.height))
			: null;
	}
	catch {
		histogram = null;
	}

	const colors = {rgb: '#444', red: '#d33', green: '#2a2', blue: '#33d'};
	const channel = () => (popup.get_params() || {}).channel || 'rgb';
	const points = () => curves[channel()];

	const to_canvas = (point) => [point[0], SIZE - 1 - point[1]];
	const from_event = (event) => {
		const rect = canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left) * SIZE / rect.width;
		const y = (event.clientY - rect.top) * SIZE / rect.height;
		return [Math.min(255, Math.max(0, Math.round(x))), Math.min(255, Math.max(0, Math.round(SIZE - 1 - y)))];
	};
	const nearest = (position) => {
		const list = points();
		for (let i = 0; i < list.length; i++) {
			const p = to_canvas(list[i]);
			const q = to_canvas(position);
			if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= 8) {
				return i;
			}
		}
		return -1;
	};

	const draw = () => {
		ctx.clearRect(0, 0, SIZE, SIZE);
		if (histogram) {
			const counts = histogram[channel()];
			const peak = Math.max.apply(null, counts) || 1;
			ctx.fillStyle = colors[channel()];
			ctx.globalAlpha = 0.25;
			for (let h = 0; h < 256; h++) {
				const bar = Math.sqrt(counts[h] / peak) * SIZE;
				ctx.fillRect(h, SIZE - bar, 1, bar);
			}
			ctx.globalAlpha = 1;
		}
		ctx.strokeStyle = '#ddd';
		ctx.lineWidth = 1;
		for (let g = 64; g < SIZE; g += 64) {
			ctx.beginPath();
			ctx.moveTo(g + 0.5, 0);
			ctx.lineTo(g + 0.5, SIZE);
			ctx.moveTo(0, g + 0.5);
			ctx.lineTo(SIZE, g + 0.5);
			ctx.stroke();
		}
		ctx.strokeStyle = '#bbb';
		ctx.beginPath();
		ctx.moveTo(0, SIZE - 1);
		ctx.lineTo(SIZE - 1, 0);
		ctx.stroke();

		const list = Adjustments.normalizeCurvePoints(points());
		const lookup = Adjustments.curveLookup(list);
		ctx.strokeStyle = colors[channel()];
		ctx.lineWidth = 2;
		ctx.beginPath();
		for (let v = 0; v < 256; v++) {
			ctx.lineTo(v + 0.5, SIZE - 1 - lookup[v] + 0.5);
		}
		ctx.stroke();

		ctx.fillStyle = '#fff';
		ctx.lineWidth = 1.5;
		points().forEach((point) => {
			const p = to_canvas(point);
			ctx.beginPath();
			ctx.arc(p[0] + 0.5, p[1] + 0.5, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		});
	};
	const changed = () => {
		draw();
		popup.onChangeEvent(); //refreshes the preview
	};

	canvas.addEventListener('pointerdown', (event) => {
		const position = from_event(event);
		const list = points();
		let index = nearest(position);
		if (index < 0) {
			list.push(position);
			list.sort((a, b) => a[0] - b[0]);
			index = list.indexOf(position);
		}
		dragged = list[index];
		canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
		changed();
		event.preventDefault();
	});
	canvas.addEventListener('pointermove', (event) => {
		if (dragged == null) {
			return;
		}
		const list = points();
		const position = from_event(event);
		const index = list.indexOf(dragged);
		const first = index == 0;
		const last = index == list.length - 1;
		//the input value stays between the neighbours (the end points keep their place)
		const min_x = first ? 0 : list[index - 1][0] + 1;
		const max_x = last ? 255 : list[index + 1][0] - 1;
		dragged[0] = first ? list[index][0] : (last ? list[index][0] : Math.min(max_x, Math.max(min_x, position[0])));
		dragged[1] = position[1];
		changed();
	});
	const release = () => {
		dragged = null;
	};
	canvas.addEventListener('pointerup', release);
	canvas.addEventListener('pointercancel', release);
	canvas.addEventListener('dblclick', (event) => {
		const list = points();
		const index = nearest(from_event(event));
		if (index > 0 && index < list.length - 1) {
			list.splice(index, 1);
			changed();
		}
	});

	//switching the channel redraws the graph
	popup.el.addEventListener('change', () => setTimeout(draw, 0));
	draw();
	return {canvas, draw};
}
