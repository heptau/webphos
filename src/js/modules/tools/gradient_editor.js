import app from './../../app.js';
import config from './../../config.js';
import Dialog_class from './../../libs/popup.js';
import { t } from './translate.js';
import {
	normalize_stops, simple_stops, layer_stops, color_at, stop_css, reverse_stops,
	GRADIENT_PRESETS, preset_stops, MAX_STOPS,
} from './../../libs/gradient.js';

let instance = null;

const BAR_WIDTH = 360;
const BAR_HEIGHT = 28;
const MARKER_HEIGHT = 20;

/**
 * Tools > Gradient Editor - color stops of the gradient: click under the bar to add a stop, drag it to move,
 * double-click to remove. It edits the gradient layer that is active, otherwise the gradient of the Gradient tool.
 */
class Tools_gradient_editor_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;
		this.POP = new Dialog_class();
	}

	/**
	 * stops the tool uses now (editor gradient, or its two toolbar colors)
	 */
	tool_stops() {
		if (Array.isArray(config.gradient_stops)) {
			return normalize_stops(config.gradient_stops);
		}
		const tool = config.TOOLS.find((item) => item.name == 'gradient');
		const attributes = tool ? tool.attributes : {};
		const value = (item) => (item && item.value !== undefined ? item.value : item);
		return simple_stops(value(attributes.color_1), value(attributes.color_2), parseFloat(value(attributes.alpha)));
	}

	gradient_editor() {
		const layer = config.layer && config.layer.type == 'gradient' ? config.layer : null;
		const stops = layer ? layer_stops(layer.params) : this.tool_stops();
		this.POP.show({
			title: layer ? 'Gradient Editor (layer)' : 'Gradient Editor',
			params: [],
			on_load: (params, popup) => {
				this.build(popup, stops);
			},
			on_finish: () => {
				this.apply(layer, this.stops);
			},
		});
	}

	apply(layer, stops) {
		stops = normalize_stops(stops);
		if (layer) {
			return app.State.do_action(
				new app.Actions.Bundle_action('gradient_editor', 'Gradient Editor', [
					new app.Actions.Update_layer_action(layer.id, {params: Object.assign({}, layer.params, {stops})}),
				])
			);
		}
		config.gradient_stops = stops;
	}

	build(popup, initial) {
		this.stops = normalize_stops(initial);
		this.selected = 0;

		const box = document.createElement('div');
		box.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:center;margin:8px auto;';
		popup.el.querySelector('.dialog_content').appendChild(box);

		//presets
		const preset_row = document.createElement('div');
		const preset = document.createElement('select');
		preset.setAttribute('aria-label', t('Preset:'));
		const placeholder = document.createElement('option');
		placeholder.textContent = t('Preset:');
		placeholder.value = '';
		preset.appendChild(placeholder);
		GRADIENT_PRESETS.forEach((item, index) => {
			const option = document.createElement('option');
			option.value = String(index);
			option.textContent = t(item.name);
			preset.appendChild(option);
		});
		const reverse = document.createElement('button');
		reverse.type = 'button';
		reverse.textContent = t('Reverse');
		reverse.style.marginLeft = '8px';
		preset_row.appendChild(preset);
		preset_row.appendChild(reverse);
		box.appendChild(preset_row);

		//gradient bar with the markers of the stops
		const canvas = document.createElement('canvas');
		canvas.width = BAR_WIDTH;
		canvas.height = BAR_HEIGHT + MARKER_HEIGHT;
		canvas.style.cssText = `display:block;width:${BAR_WIDTH}px;max-width:100%;cursor:pointer;touch-action:none;`;
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', t('Gradient'));
		box.appendChild(canvas);
		const ctx = canvas.getContext('2d');

		//the selected stop
		const row = document.createElement('div');
		row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;';
		const color = document.createElement('input');
		color.type = 'color';
		color.setAttribute('aria-label', t('Color:'));
		const make_number = (label, min, max) => {
			const wrap = document.createElement('label');
			wrap.textContent = `${t(label)  } `;
			const input = document.createElement('input');
			input.type = 'number';
			input.min = String(min);
			input.max = String(max);
			input.style.width = '64px';
			wrap.appendChild(input);
			row.appendChild(wrap);
			return input;
		};
		row.appendChild(color);
		const opacity = make_number('Opacity:', 0, 100);
		const position = make_number('Position:', 0, 100);
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = t('Delete');
		row.appendChild(remove);
		box.appendChild(row);

		const current = () => this.stops[this.selected];
		const sync_fields = () => {
			const stop = current();
			color.value = stop.color;
			opacity.value = String(Math.round(stop.alpha / 255 * 100));
			position.value = String(Math.round(stop.pos * 100));
			remove.disabled = this.stops.length <= 2;
		};
		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			//checkerboard shows the transparency
			for (let y = 0; y < BAR_HEIGHT; y += 7) {
				for (let x = 0; x < BAR_WIDTH; x += 7) {
					ctx.fillStyle = ((x + y) / 7) % 2 == 0 ? '#ffffff' : '#cccccc';
					ctx.fillRect(x, y, 7, 7);
				}
			}
			const gradient = ctx.createLinearGradient(0, 0, BAR_WIDTH, 0);
			this.stops.forEach((stop) => gradient.addColorStop(stop.pos, stop_css(stop)));
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, BAR_WIDTH, BAR_HEIGHT);
			ctx.strokeStyle = '#888';
			ctx.strokeRect(0.5, 0.5, BAR_WIDTH - 1, BAR_HEIGHT - 1);

			this.stops.forEach((stop, index) => {
				const x = Math.round(stop.pos * (BAR_WIDTH - 1)) + 0.5;
				ctx.beginPath();
				ctx.moveTo(x, BAR_HEIGHT + 2);
				ctx.lineTo(x - 6, BAR_HEIGHT + MARKER_HEIGHT - 2);
				ctx.lineTo(x + 6, BAR_HEIGHT + MARKER_HEIGHT - 2);
				ctx.closePath();
				ctx.fillStyle = stop.color;
				ctx.fill();
				ctx.lineWidth = index == this.selected ? 2.5 : 1;
				ctx.strokeStyle = index == this.selected ? '#0a84ff' : '#666';
				ctx.stroke();
				ctx.lineWidth = 1;
			});
		};
		const changed = () => {
			sync_fields();
			draw();
		};

		const position_of = (event) => {
			const rect = canvas.getBoundingClientRect();
			return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		};
		const nearest = (pos) => {
			let best = -1;
			let best_distance = 9 / BAR_WIDTH; //a marker is about 12 px wide
			this.stops.forEach((stop, index) => {
				const distance = Math.abs(stop.pos - pos);
				if (distance <= best_distance) {
					best = index;
					best_distance = distance;
				}
			});
			return best;
		};
		let dragging = false;
		canvas.addEventListener('pointerdown', (event) => {
			const pos = position_of(event);
			let index = nearest(pos);
			if (index < 0) {
				if (this.stops.length >= MAX_STOPS) {
					return;
				}
				//a new stop gets the color the gradient has there
				const c = color_at(this.stops, pos);
				this.stops.push({pos, color: `#${  c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`, alpha: c[3]});
				this.stops.sort((a, b) => a.pos - b.pos);
				index = this.stops.findIndex((stop) => stop.pos == pos);
			}
			this.selected = index;
			dragging = true;
			canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
			changed();
			event.preventDefault();
		});
		canvas.addEventListener('pointermove', (event) => {
			if (!dragging) {
				return;
			}
			const stop = current();
			stop.pos = position_of(event);
			//the order of the stops stays, so the selection stays on the same stop
			this.stops.sort((a, b) => a.pos - b.pos);
			this.selected = this.stops.indexOf(stop);
			changed();
		});
		const release = () => {
			dragging = false;
		};
		canvas.addEventListener('pointerup', release);
		canvas.addEventListener('pointercancel', release);
		canvas.addEventListener('dblclick', (event) => {
			const index = nearest(position_of(event));
			if (index >= 0 && this.stops.length > 2) {
				this.stops.splice(index, 1);
				this.selected = Math.min(this.selected, this.stops.length - 1);
				changed();
			}
		});

		color.addEventListener('input', () => {
			current().color = color.value;
			changed();
		});
		opacity.addEventListener('input', () => {
			const value = parseFloat(opacity.value);
			if (!isNaN(value)) {
				current().alpha = Math.round(Math.min(100, Math.max(0, value)) / 100 * 255);
				draw();
			}
		});
		position.addEventListener('input', () => {
			const value = parseFloat(position.value);
			if (!isNaN(value)) {
				const stop = current();
				stop.pos = Math.min(100, Math.max(0, value)) / 100;
				this.stops.sort((a, b) => a.pos - b.pos);
				this.selected = this.stops.indexOf(stop);
				draw();
			}
		});
		remove.addEventListener('click', () => {
			if (this.stops.length > 2) {
				this.stops.splice(this.selected, 1);
				this.selected = Math.min(this.selected, this.stops.length - 1);
				changed();
			}
		});
		reverse.addEventListener('click', () => {
			this.stops = reverse_stops(this.stops);
			this.selected = this.stops.length - 1 - this.selected;
			changed();
		});
		preset.addEventListener('change', () => {
			const item = GRADIENT_PRESETS[parseInt(preset.value, 10)];
			if (item) {
				this.stops = preset_stops(item, config.COLOR, config.COLOR_BG || '#ffffff');
				this.selected = 0;
				changed();
			}
			preset.value = '';
		});

		this.editor = {canvas, draw};
		changed();
	}
}

export default Tools_gradient_editor_class;
