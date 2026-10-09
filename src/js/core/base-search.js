/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import Dialog_class from './../libs/popup.js';
import fuzzysort from 'fuzzysort';
import Base_gui_class from './base-gui.js';
import menuDefinition from './../config-menu.js';
import { t } from './../modules/tools/translate.js';
import { format_shortcut_mac, is_mac_platform } from './../libs/shortcuts.js';

let instance = null;

class Base_search_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.POP = new Dialog_class();
		this.Base_gui = new Base_gui_class();
		this.db = null;

		this.events();
	}

	events() {

		//click on a result runs it
		document.addEventListener('click', (event) => {
			const result = event.target.closest ? event.target.closest('.search-result') : null;
			if (result && document.querySelector('#global_search_results')) {
				this.run(parseInt(result.dataset.index, 10));
			}
		}, false);

		document.addEventListener('input', (event) => {
			if(document.querySelector('#pop_data_search') == null){
				return;
			}

			const node = document.querySelector('#global_search_results');
			node.innerHTML = '';

			const query = event.target.value;
			if(query == ''){
				return;
			}

			const results = fuzzysort.go(query, this.db, {
				keys: ['title', 'english'],
				limit: 10,
				threshold: -50000,
			});

			//show
			for(let i = 0; i < results.length; i++) {
				const item = results[i];
				const entry = item.obj;

				let className = `search-result n${  i+1}`;
				if(i == 0){
					className += " active";
				}

				const label = item[0] ? fuzzysort.highlight(item[0]) : this.escape(entry.title);
				const shortcut = entry.shortcut ? ` <span class="search-shortcut">${this.escape(entry.shortcut)}</span>` : '';
				node.innerHTML += `<div class='${className}' data-index='${entry.index}'>${label}${entry.path ? ` <span class="search-path">${this.escape(entry.path)}</span>` : ''  }${shortcut  }</div>`;
			}
		}, false);

		//allow to select with arrow keys
		document.addEventListener('keydown', (e) => {
			let target, index, target2;
			if(document.querySelector('#global_search_results') == null
				|| document.querySelector('.search-result') == null){
				return;
			}
			const k = e.key;

			if (k == "ArrowUp") {
				target = document.querySelector('.search-result.active');
				index = Array.from(target.parentNode.children).indexOf(target);
				if(index > 0){
					index--;
				}
				target.classList.remove('active');
				target2 = document.querySelector('#global_search_results').childNodes[index];
				target2.classList.add('active');
				e.preventDefault();
			}
			else if (k == "ArrowDown") {
				target = document.querySelector('.search-result.active');
				index = Array.from(target.parentNode.children).indexOf(target);
				const total = target.parentNode.childElementCount;
				if(index < total - 1){
					index++;
				}
				target.classList.remove('active');
				target2 = document.querySelector('#global_search_results').childNodes[index];
				target2.classList.add('active');
				e.preventDefault();
			}

		}, false);
	}

	search() {

		//init DB: all commands of the menu
		if(this.db === null) {
			this.db = [];
			this.collect_commands(menuDefinition, []);
		}

		const settings = {
			title: 'Search',
			params: [
				{name: "search", title: "Search:", value: ""},
			],
			on_load (params, popup) {
				const node = document.createElement("div");
				node.id = 'global_search_results';
				node.innerHTML = '';
				popup.el.querySelector('.dialog_content').appendChild(node);
			},
			on_finish: () => {
				const target = document.querySelector('.search-result.active');
				if(target){
					this.run(parseInt(target.dataset.index, 10));
				}
			},
		};
		this.POP.show(settings);

		//on input change
		document.getElementById("pop_data_search").select();
	}

	/**
	 * flattens the menu to a list of commands (name in the current language and in English, path, shortcut)
	 */
	collect_commands(items, path) {
		for (const item of items) {
			if (item.divider) {
				continue;
			}
			if (item.children) {
				this.collect_commands(item.children, path.concat(item.name));
				continue;
			}
			if (!item.target) {
				continue;
			}
			let shortcut = item.shortcut || '';
			if (shortcut && is_mac_platform()) {
				shortcut = format_shortcut_mac(shortcut);
			}
			this.db.push({
				index: this.db.length,
				title: t(item.name),
				english: item.name,
				path: path.map((name) => t(name)).join(' › '),
				shortcut,
				target: item.target,
				parameter: item.parameter ?? null,
			});
		}
	}

	run(index) {
		const entry = this.db[index];
		if (!entry) {
			return;
		}
		this.POP.hide();
		this.Base_gui.run_target(entry.target, entry.parameter);
	}

	escape(text) {
		return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
	}

}

export default Base_search_class;
