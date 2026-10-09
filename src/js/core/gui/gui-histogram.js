import config from './../../config.js';
import Base_layers_class from './../base-layers.js';
import { histograms } from './../../libs/adjustments.js';
import { histogram_scale } from './../../libs/histogram-view.js';

/**
 * Histogram panel - brightness and color distribution of the active layer, updated after every change
 */
class GUI_histogram_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.canvas = null;
		this.pending = false;
	}

	render_main_histogram() {
		const container = document.getElementById('toggle_histogram');
		if (!container) {
			return;
		}
		this.canvas = document.createElement('canvas');
		this.canvas.width = 200;
		this.canvas.height = 70;
		this.canvas.className = 'histogram_canvas';
		this.canvas.setAttribute('role', 'img');
		this.canvas.setAttribute('aria-label', 'Histogram');
		container.appendChild(this.canvas);

		document.addEventListener('minipaint:history', () => this.schedule());
		this.render();
	}

	schedule() {
		if (this.pending) {
			return;
		}
		this.pending = true;
		setTimeout(() => {
			this.pending = false;
			this.render();
		}, 150);
	}

	render() {
		const block = document.getElementById('histogram_base');
		const container = document.getElementById('toggle_histogram');
		if (!this.canvas || !block || block.classList.contains('panel_hidden') || container.classList.contains('hidden')) {
			return;
		}
		const ctx = this.canvas.getContext('2d');
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		if (!config.layer) {
			return;
		}

		//a small copy is enough for the statistics
		let source;
		try {
			source = this.Base_layers.convert_layer_to_canvas();
		}
		catch {
			return;
		}
		if (!source || source.width < 1 || source.height < 1) {
			return;
		}
		const scale = Math.min(1, 256 / Math.max(source.width, source.height));
		const small = document.createElement('canvas');
		small.width = Math.max(1, Math.round(source.width * scale));
		small.height = Math.max(1, Math.round(source.height * scale));
		const small_ctx = small.getContext('2d', {willReadFrequently: true});
		small_ctx.drawImage(source, 0, 0, small.width, small.height);
		const result = histograms(small_ctx.getImageData(0, 0, small.width, small.height));

		const maximum = histogram_scale([result.red, result.green, result.blue, result.rgb]);
		if (maximum == 0) {
			return;
		}
		const width = this.canvas.width;
		const height = this.canvas.height;
		const draw = function (values, color, fill) {
			ctx.beginPath();
			ctx.moveTo(0, height);
			for (let x = 0; x < 256; x++) {
				const h = Math.min(1, values[x] / maximum) * (height - 2);
				ctx.lineTo(x * width / 255, height - h);
			}
			ctx.lineTo(width, height);
			ctx.closePath();
			if (fill) {
				ctx.fillStyle = color;
				ctx.fill();
			}
			else {
				ctx.strokeStyle = color;
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		};
		const muted = getComputedStyle(document.body).getPropertyValue('--text-color-muted').trim() || '#888';
		ctx.globalAlpha = 0.45;
		draw(result.rgb, muted, true);
		ctx.globalAlpha = 0.9;
		draw(result.red, '#ff453a', false);
		draw(result.green, '#30d158', false);
		draw(result.blue, '#0a84ff', false);
		ctx.globalAlpha = 1;
	}
}

export default GUI_histogram_class;
