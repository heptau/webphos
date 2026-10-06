import Edit_history_class from './../../modules/edit/history.js';

/**
 * History panel in the right sidebar: list of undo steps, click jumps to the step
 * (shares the logic with Edit > History dialog)
 */
class GUI_history_class {

	constructor() {
		this.History = new Edit_history_class();
		this.list = null;
		this.pending = false;
	}

	render_main_history() {
		var container = document.getElementById('toggle_history');
		if (!container) {
			return;
		}
		this.list = document.createElement('div');
		this.list.className = 'history_list history_panel_list';
		this.list.setAttribute('role', 'group');
		this.list.setAttribute('aria-label', 'History');
		container.appendChild(this.list);

		this.list.addEventListener('click', (event) => {
			var item = event.target.closest('[data-step]');
			if (item) {
				this.History.go_to(parseInt(item.dataset.step, 10), this.list);
			}
		});
		this.list.addEventListener('keydown', (event) => {
			if (event.key != 'ArrowDown' && event.key != 'ArrowUp') {
				return;
			}
			var items = Array.from(this.list.querySelectorAll('[data-step]'));
			var index = items.indexOf(document.activeElement);
			var next = items[index + (event.key == 'ArrowDown' ? 1 : -1)];
			if (next) {
				event.preventDefault();
				next.focus();
			}
		});

		//state changes are announced by base-state
		document.addEventListener('minipaint:history', () => this.schedule());
		this.render();
	}

	schedule() {
		if (this.pending) {
			return;
		}
		this.pending = true;
		requestAnimationFrame(() => {
			this.pending = false;
			this.render();
		});
	}

	render() {
		var block = document.getElementById('history_base');
		if (!this.list || !block || block.classList.contains('panel_hidden')) {
			return;
		}
		var container = document.getElementById('toggle_history');
		if (container.classList.contains('hidden')) {
			//collapsed - rendered when it is opened
			return;
		}
		this.History.render(this.list, false);
	}
}

export default GUI_history_class;
