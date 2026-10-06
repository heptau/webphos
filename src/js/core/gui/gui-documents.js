import app from './../../app.js';
import config from './../../config.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import Dialog_class from './../../libs/popup.js';
import Tools_translate_class, { t } from './../../modules/tools/translate.js';
import { export_as_json } from './../../modules/file/save-helpers.js';
import { next_document_name, remove_document_index, move_active_index } from './../../libs/documents.js';
import { save_session, load_session, clear_session } from './../../libs/autosave.js';

/**
 * Document tabs above the canvas. Only the active document lives in the app; the others are kept as
 * project JSON (the same data as "Save as JSON") and loaded back when their tab is selected.
 * Undo history belongs to the active document, so it is cleared when documents are switched.
 */
class GUI_documents_class {

	constructor() {
		this.documents = [{name: next_document_name([]), json: null, dirty: false}];
		this.autosave_timer = null;
		this.active = 0;
		this.busy = false;
		this.bar = null;
		this.Tools_translate = new Tools_translate_class();
		this.POP = new Dialog_class();
	}

	render_main_documents() {
		this.bar = document.getElementById('documents_bar');
		if (!this.bar) {
			return;
		}
		this.bar.addEventListener('click', (event) => this.on_click(event));
		this.bar.addEventListener('dblclick', (event) => {
			var tab = event.target.closest('.doc_tab');
			if (tab) {
				this.rename(parseInt(tab.dataset.index, 10));
			}
		});
		this.bar.addEventListener('keydown', (event) => this.on_key(event));
		this.bar.addEventListener('contextmenu', (event) => {
			var tab = event.target.closest ? event.target.closest('.doc_tab') : null;
			if (!tab) {
				return;
			}
			var index = parseInt(tab.dataset.index, 10);
			var many = this.documents.length > 1;
			var items = [
				{name: 'Rename', target: 'view/documents.rename_tab', parameter: index},
				{name: 'Duplicate Document', target: 'view/documents.duplicate_tab', parameter: index},
				{divider: true},
			];
			if (many) {
				items.push({name: 'Close', target: 'view/documents.close_tab', parameter: index});
				items.push({name: 'Close Others', target: 'view/documents.close_others', parameter: index});
			}
			if (index < this.documents.length - 1) {
				items.push({name: 'Close to the Right', target: 'view/documents.close_right', parameter: index});
			}
			app.GUI.GUI_context_menu.show(event, items, (target, parameter) => app.GUI.run_target(target, parameter));
		});
		this.set_drag_events();
		this.render();

		//changes mark the document and are saved a little later
		document.addEventListener('minipaint:history', () => this.on_history_change());
		setTimeout(() => this.offer_restore(), 1500);
	}

	//drag a tab to change the order of documents
	set_drag_events() {
		var from = null;
		this.bar.addEventListener('dragstart', (event) => {
			var tab = event.target.closest ? event.target.closest('.doc_tab') : null;
			if (!tab) {
				return;
			}
			from = parseInt(tab.dataset.index, 10);
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(from));
		});
		this.bar.addEventListener('dragover', (event) => {
			if (from !== null) {
				event.preventDefault();
			}
		});
		this.bar.addEventListener('drop', (event) => {
			if (from === null) {
				return;
			}
			event.preventDefault();
			var tab = event.target.closest('.doc_tab');
			var to = tab ? parseInt(tab.dataset.index, 10) : this.documents.length - 1;
			if (to != from) {
				this.active = move_active_index(this.active, from, to);
				this.documents.splice(to, 0, this.documents.splice(from, 1)[0]);
				this.render();
			}
			from = null;
		});
		this.bar.addEventListener('dragend', () => {
			from = null;
		});
	}

	/**
	 * @returns {boolean} the project has something worth saving
	 */
	has_content() {
		if (this.documents.length > 1) {
			return true;
		}
		return config.layers.length > 1 || (Boolean(config.layer) && app.Layers.is_layer_empty(config.layer.id) == false);
	}

	on_history_change() {
		var doc = this.documents[this.active];
		if (app.State.action_history_index > 0 && doc.dirty !== true) {
			doc.dirty = true;
			this.render();
		}
		clearTimeout(this.autosave_timer);
		this.autosave_timer = setTimeout(() => this.autosave(), 8000);
	}

	async autosave() {
		if (this.busy) {
			return;
		}
		if (this.has_content() == false) {
			//the project was cleared - an old session must not be offered again
			clear_session();
			return;
		}
		try {
			this.documents[this.active].json = export_as_json();
			var size = this.documents.reduce((sum, doc) => sum + (doc.json ? doc.json.length : 0), 0);
			if (size > 300 * 1024 * 1024) {
				return;
			}
			await save_session({
				documents: this.documents.map((doc) => ({name: doc.name, json: doc.json})),
				active: this.active,
				time: Date.now(),
			});
			document.dispatchEvent(new CustomEvent('minipaint:autosaved', {detail: Date.now()}));
		}
		catch (error) {
			//autosave is a convenience, it must never break the editor
		}
	}

	async offer_restore() {
		var session = await load_session();
		if (!session || this.has_content()) {
			return;
		}
		alertify.confirm(t('Restore previous session?'),
			t('Your work from the last session was found. Restore it?'),
			async () => {
				this.busy = true;
				try {
					var restored = session.documents.map((doc) => ({name: doc.name, json: doc.json, dirty: true}));
					await this.load(restored[session.active].json);
					this.documents = restored;
					this.active = session.active;
					this.render();
				}
				catch (error) {
					alertify.error(t('Document could not be opened.'));
				}
				finally {
					this.busy = false;
				}
			},
			() => clear_session()
		);
	}

	/**
	 * opens a new empty document tab in the size of the current one (used when a file is opened)
	 */
	async new_blank() {
		var File_new_class = (await import('./../../modules/file/new.js')).default;
		await new File_new_class().create_document(config.WIDTH, config.HEIGHT, config.TRANSPARENCY, {dpi: config.RESOLUTION, units: config.UNITS});
	}

	render() {
		if (!this.bar) {
			return;
		}
		var many = this.documents.length > 1;
		var html = '';
		this.documents.forEach((doc, index) => {
			var active = index == this.active;
			//the cross is on the left and shows when the pointer is over the tab (always on touch screens);
			//with a single document it stays (invisible) so the tab keeps its size
			html += '<div class="doc_tab' + (active ? ' active' : '') + '" role="tab" draggable="true" data-index="' + index + '"'
				+ ' aria-selected="' + active + '" tabindex="' + (active ? '0' : '-1') + '">'
				+ '<button type="button" class="doc_close' + (many ? '' : ' idle') + '" data-index="' + index + '" aria-label="' + t('Close') + '" tabindex="-1"'
				+ (many ? '' : ' aria-hidden="true" disabled') + '>&times;</button>'
				+ '<span class="doc_name"></span>'
				//the dot after the name has its place reserved, so the tab does not change its width
				+ '<span class="doc_dirty' + (doc.dirty ? ' on' : '') + '"' + (doc.dirty ? ' role="img" title="' + t('Unsaved changes') + '" aria-label="' + t('Unsaved changes') + '"' : ' aria-hidden="true"') + '></span>'
				+ '</div>';
		});
		html += '<button type="button" class="doc_new" aria-label="' + t('New file') + '" title="' + t('New file') + '">+</button>';
		this.bar.innerHTML = html;
		//names are set as text, they can contain anything
		this.bar.querySelectorAll('.doc_tab').forEach((tab) => {
			var doc = this.documents[parseInt(tab.dataset.index, 10)];
			tab.querySelector('.doc_name').textContent = doc.name;
		});
	}

	on_click(event) {
		var close = event.target.closest('.doc_close');
		if (close) {
			this.close(parseInt(close.dataset.index, 10));
			return;
		}
		if (event.target.closest('.doc_new')) {
			app.GUI.run_target('file/new.new');
			return;
		}
		var tab = event.target.closest('.doc_tab');
		if (tab) {
			this.switch_to(parseInt(tab.dataset.index, 10));
		}
	}

	on_key(event) {
		var tab = event.target.closest ? event.target.closest('.doc_tab') : null;
		if (!tab) {
			return;
		}
		var index = parseInt(tab.dataset.index, 10);
		if (event.key == 'Enter' || event.key == ' ') {
			event.preventDefault();
			this.switch_to(index);
		}
		else if (event.key == 'ArrowRight' || event.key == 'ArrowLeft') {
			event.preventDefault();
			var next = (index + (event.key == 'ArrowRight' ? 1 : -1) + this.documents.length) % this.documents.length;
			this.switch_to(next).then(() => {
				var focus = this.bar.querySelector('.doc_tab[data-index="' + next + '"]');
				if (focus) {
					focus.focus();
				}
			});
		}
		else if (event.key == 'Delete' || event.key == 'Backspace') {
			if (this.documents.length > 1) {
				event.preventDefault();
				this.close(index);
			}
		}
	}

	/**
	 * called by File > New just before the current project is replaced:
	 * the current project stays in its tab and the new one gets a new tab
	 */
	before_new() {
		var previous = this.active;
		var doc = {name: next_document_name(this.documents.map((item) => item.name)), json: null, dirty: false};
		this.documents[this.active].json = export_as_json();
		this.documents.splice(this.active + 1, 0, doc);
		this.active = this.active + 1;
		this.render();
		//undo of this step (when creating the project fails)
		return () => {
			var index = this.documents.indexOf(doc);
			if (index >= 0) {
				this.documents.splice(index, 1);
			}
			this.active = Math.min(previous, this.documents.length - 1);
			this.render();
		};
	}

	/**
	 * opens a project (JSON) in a new tab
	 *
	 * @param {string} name
	 * @param {string} json
	 */
	async open_json_as_new(name, json) {
		if (this.busy) {
			return;
		}
		this.busy = true;
		var previous = this.active;
		try {
			this.documents[previous].json = export_as_json();
			this.documents.splice(previous + 1, 0, {name: name, json: json, dirty: false});
			this.active = previous + 1;
			this.render();
			await this.load(json);
		}
		catch (error) {
			alertify.error(t('Document could not be opened.'));
			//back to the document that is really on the canvas
			this.documents.splice(previous + 1, 1);
			this.active = previous;
			this.render();
			try {
				await this.load(this.documents[previous].json);
			}
			catch (second_error) {
				//nothing more can be done
			}
		}
		finally {
			this.busy = false;
		}
	}

	/**
	 * adds a layer of the active document to another (not active) document, which is kept as JSON
	 *
	 * @param {number} index target document
	 * @returns {boolean} true when the layer was added
	 */
	copy_layer_to(index) {
		var target = this.documents[index];
		var layer = config.layer;
		if (!target || index == this.active || !target.json || !layer) {
			return false;
		}
		try {
			var project = JSON.parse(target.json);
			var next_id = project.layers.reduce((max, item) => Math.max(max, parseInt(item.id, 10) || 0), 0) + 1;
			var next_order = project.layers.reduce((max, item) => Math.max(max, parseInt(item.order, 10) || 0), 0) + 1;
			var copy = {};
			for (var key in layer) {
				if (key[0] != '_' && key != 'link_canvas' && key != 'link') {
					copy[key] = JSON.parse(JSON.stringify(layer[key]));
				}
			}
			copy.id = next_id;
			copy.order = next_order;
			copy.name = layer.name + ' ' + t('copy');
			project.layers.push(copy);
			if (layer.type == 'image') {
				var canvas = document.createElement('canvas');
				canvas.width = parseInt(layer.width_original, 10) || layer.link.naturalWidth || layer.link.width || 1;
				canvas.height = parseInt(layer.height_original, 10) || layer.link.naturalHeight || layer.link.height || 1;
				canvas.getContext('2d').drawImage(layer.link, 0, 0, canvas.width, canvas.height);
				project.data = project.data || [];
				project.data.push({id: next_id, data: canvas.toDataURL('image/png')});
			}
			target.json = JSON.stringify(project, null, '\t');
			target.dirty = true;
			this.render();
			return true;
		}
		catch (error) {
			return false;
		}
	}

	/**
	 * a copy of the document in a new tab (its current state)
	 *
	 * @param {number} index
	 */
	async duplicate(index) {
		var doc = this.documents[index];
		if (!doc || this.busy) {
			return;
		}
		if (index == this.active) {
			doc.json = export_as_json();
		}
		if (!doc.json) {
			return;
		}
		var copy = {name: next_document_name(this.documents.map((item) => item.name)).replace('Untitled', doc.name.replace(/-\d+$/, '')), json: doc.json, dirty: true};
		this.documents.splice(index + 1, 0, copy);
		this.render();
		await this.switch_to(index + 1);
	}

	/**
	 * called after the new project was created - undo must not bring the previous document back
	 */
	async clear_history() {
		var state = app.State;
		var actions = state.action_history;
		state.action_history = [];
		state.action_history_index = 0;
		state.original_canvas = null;
		for (var i = 0; i < actions.length; i++) {
			try {
				await actions[i].free();
			}
			catch (error) {
				//nothing to free
			}
		}
		state.notify_history();
	}

	async load(json) {
		//loading puts steps into the history, which must not mark the document as changed
		var target = this.documents[this.active];
		var was_dirty = target ? target.dirty : false;
		var File_open_class = (await import('./../../modules/file/open.js')).default;
		var open = new File_open_class();
		await open.json_ops.load_json(json);
		await this.clear_history();
		if (target) {
			target.dirty = was_dirty;
			this.render();
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
		app.GUI.GUI_preview.zoom_auto(true);
		config.need_render = true;
	}

	async switch_to(index) {
		if (this.busy || index == this.active || index < 0 || index >= this.documents.length) {
			return;
		}
		this.busy = true;
		var previous = this.active;
		var current_json;
		try {
			current_json = export_as_json();
		}
		catch (error) {
			//the open document can not be saved (e.g. an image that can not be read) - leave it untouched on the canvas
			alertify.error(t('Document could not be opened.'));
			this.busy = false;
			return;
		}
		try {
			this.documents[previous].json = current_json;
			this.active = index;
			this.render();
			await this.load(this.documents[index].json);
		}
		catch (error) {
			alertify.error(t('Document could not be opened.'));
			//show the tab of the project that is really on the canvas
			this.active = previous;
			this.render();
			try {
				await this.load(this.documents[previous].json);
			}
			catch (second_error) {
				//nothing more can be done
			}
		}
		finally {
			this.busy = false;
		}
	}

	close(index) {
		if (this.documents.length < 2 || this.busy) {
			return;
		}
		var doc = this.documents[index];
		if (!doc) {
			return;
		}
		var do_close = async () => {
			//the list can change while the confirmation is open
			var current = this.documents.indexOf(doc);
			if (current < 0 || this.busy || this.documents.length < 2) {
				return;
			}
			var was_active = current == this.active;
			var result = remove_document_index(this.documents.length, this.active, current);
			if (was_active) {
				//load the neighbour first, the document is removed only when it worked
				this.busy = true;
				try {
					var neighbour = this.documents[result.active + (result.active >= current ? 1 : 0)];
					await this.load(neighbour.json);
				}
				catch (error) {
					alertify.error(t('Document could not be opened.'));
					this.busy = false;
					return;
				}
				this.busy = false;
			}
			this.documents.splice(current, 1);
			this.active = result.active;
			this.render();
		};
		if (doc.dirty) {
			alertify.confirm(t('Close') + ': ' + doc.name, t('Unsaved changes will be lost.'), do_close, function () {});
		}
		else {
			do_close();
		}
	}

	rename(index) {
		var doc = this.documents[index];
		if (!doc) {
			return;
		}
		this.POP.show({
			title: 'Rename',
			params: [{name: 'name', title: 'Name:', value: doc.name}],
			on_finish: (params) => {
				var name = String(params.name).trim().slice(0, 60);
				if (name != '') {
					doc.name = name;
					this.render();
				}
			},
		});
	}
}

export default GUI_documents_class;
