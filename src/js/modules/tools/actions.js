import app from './../../app.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import {
	load_actions, save_actions, sanitize_action, make_id, describe_step, export_action, import_action,
	start_recording, stop_recording, cancel_recording, on_recording_change, begin_replay, end_replay,
	is_recording, collect_targets,
} from './../../libs/actions.js';
import menuDefinition from './../../config-menu.js';
import shortcutsDefinition from './../../config-shortcuts.js';
import { save_blob } from './../../libs/file-save.js';
import { t } from './translate.js';

let instance = null;

/**
 * Window > Actions - record menu commands with the settings of their dialogs and play them again, also as a file
 * for somebody else. The commands are kept in this browser (localStorage), nothing is sent anywhere.
 */
class Tools_actions_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;
		this.playing = false;
		this.panel = null;
		this.allowed = collect_targets(menuDefinition, shortcutsDefinition);
		on_recording_change((recording) => this.show_recorder(recording));
	}

	storage() {
		try {
			return window.localStorage;
		}
		catch {
			return null;
		}
	}

	list() {
		const storage = this.storage();
		return storage ? load_actions(storage, this.allowed) : [];
	}

	store(actions) {
		const storage = this.storage();
		if (!storage || save_actions(storage, actions) == false) {
			alertify.error(t('The actions could not be saved in this browser.'));
		}
	}

	/**
	 * Window > Actions - the list of the actions
	 */
	manage() {
		new Dialog_class().show({
			title: 'Actions',
			params: [],
			on_load: (params, popup) => this.build_list(popup),
		});
	}

	build_list(popup) {
		const box = document.createElement('div');
		box.style.cssText = 'min-width:360px;max-width:520px;margin:8px auto;display:flex;flex-direction:column;gap:10px;';
		popup.el.querySelector('.dialog_content').appendChild(box);
		const close = () => {
			const cancel = popup.el.querySelector('[data-id="popup_cancel"]');
			if (cancel) {
				cancel.click();
			}
		};

		const list = document.createElement('div');
		list.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;';
		box.appendChild(list);

		const button = (text, handler, title) => {
			const element = document.createElement('button');
			element.type = 'button';
			element.textContent = t(text);
			if (title) {
				element.title = t(title);
			}
			element.addEventListener('click', handler);
			return element;
		};

		const render = () => {
			list.innerHTML = '';
			const actions = this.list();
			if (actions.length == 0) {
				const empty = document.createElement('small');
				empty.textContent = t('There are no actions yet. Record one below.');
				list.appendChild(empty);
			}
			actions.forEach((action) => {
				const row = document.createElement('div');
				row.style.cssText = 'display:flex;gap:6px;align-items:center;';
				const name = document.createElement('span');
				name.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
				name.textContent = `${action.name  } (${action.steps.length})`;
				name.title = action.steps.map(describe_step).join(' > ');
				row.appendChild(name);
				row.appendChild(button('Play', () => {
					close();
					this.play(action);
				}));
				row.appendChild(button('Export', () => this.export(action)));
				row.appendChild(button('Delete', () => {
					this.store(this.list().filter((item) => item.id != action.id));
					render();
				}));
				list.appendChild(row);
			});
		};
		render();

		//a new action
		const record_row = document.createElement('div');
		record_row.style.cssText = 'display:flex;gap:6px;align-items:center;';
		const name_input = document.createElement('input');
		name_input.type = 'text';
		name_input.maxLength = 60;
		name_input.style.flex = '1';
		name_input.value = `${t('Action')  } ${  this.list().length + 1}`;
		name_input.setAttribute('aria-label', t('Name of the action'));
		record_row.appendChild(name_input);
		record_row.appendChild(button('Record', () => {
			close();
			this.record(name_input.value);
		}, 'Record the commands you use from now on'));
		box.appendChild(record_row);

		//from a file
		const file = document.createElement('input');
		file.type = 'file';
		file.accept = '.json,application/json';
		file.style.display = 'none';
		file.addEventListener('change', async () => {
			if (file.files.length > 0) {
				await this.import(file.files[0]);
				render();
			}
			file.value = '';
		});
		box.appendChild(file);
		box.appendChild(button('Import', () => file.click(), 'Open an action from a file'));

		const hint = document.createElement('small');
		hint.textContent = t('Menu commands are recorded with the settings of their dialogs. Strokes of the tools are not.');
		box.appendChild(hint);
	}

	record(name) {
		if (is_recording()) {
			return;
		}
		start_recording(name);
	}

	stop() {
		const action = stop_recording();
		if (action == null) {
			alertify.warning(t('Nothing was recorded.'));
			return;
		}
		this.store(this.list().concat([action]));
		alertify.success(`${t('Action saved:')  } ${  action.name}`);
	}

	cancel() {
		cancel_recording();
	}

	/**
	 * @param {object} action
	 */
	async play(action) {
		if (this.playing || is_recording()) {
			return;
		}
		this.playing = true;
		try {
			for (let i = 0; i < action.steps.length; i++) {
				const step = action.steps[i];
				begin_replay(step);
				try {
					await app.GUI.run_target(step.target, step.parameter);
				}
				catch {
					alertify.error(`${t('The action stopped at:')  } ${  describe_step(step)}`);
					return;
				}
				finally {
					end_replay();
				}
				//the change has to be done before the next command looks at the picture
				await new Promise((resolve) => setTimeout(resolve, 60));
			}
			alertify.success(`${t('Action played:')  } ${  action.name}`);
		}
		finally {
			end_replay();
			this.playing = false;
		}
	}

	async export(action) {
		const blob = new Blob([export_action(action)], {type: 'application/json'});
		const name = String(action.name).replace(/[^\w-]+/g, '-').slice(0, 40) || 'action';
		try {
			await save_blob(blob, `${name  }.lumifex-action.json`, false);
		}
		catch {
			alertify.error(t('Export failed.'));
		}
	}

	async import(file) {
		if (file.size > 500000) {
			alertify.error(t('The file is too big.'));
			return;
		}
		const action = import_action(await file.text(), this.allowed);
		if (action == null) {
			alertify.error(t('This is not an action file.'));
			return;
		}
		action.id = make_id();
		this.store(this.list().concat([sanitize_action(action, this.allowed)]));
		alertify.success(`${t('Action saved:')  } ${  action.name}`);
	}

	/**
	 * Small bar at the top while an action is recorded
	 */
	show_recorder(recording) {
		if (recording == null) {
			if (this.panel) {
				this.panel.remove();
				this.panel = null;
			}
			return;
		}
		if (this.panel == null) {
			const panel = document.createElement('div');
			panel.id = 'action_recorder';
			panel.className = 'action_recorder';
			panel.setAttribute('role', 'status');
			const label = document.createElement('span');
			label.className = 'action_recorder_label';
			const stop = document.createElement('button');
			stop.type = 'button';
			stop.textContent = t('Stop');
			stop.addEventListener('click', () => this.stop());
			const cancel = document.createElement('button');
			cancel.type = 'button';
			cancel.textContent = t('Cancel');
			cancel.addEventListener('click', () => this.cancel());
			panel.appendChild(label);
			panel.appendChild(stop);
			panel.appendChild(cancel);
			document.body.appendChild(panel);
			this.panel = panel;
		}
		this.panel.querySelector('.action_recorder_label').textContent = `● ${t('Recording')}: ${recording.name} (${recording.steps.length})`;
	}
}

export default Tools_actions_class;
