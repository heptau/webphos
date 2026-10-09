import config from './../../config.js';
import Base_tools_class from './../../core/base-tools.js';
import Dialog_class from './../../libs/popup.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../tools/translate.js';

class Effects_browser_class extends Base_tools_class {

	constructor() {
		super();
		this.POP = new Dialog_class();
		this.preview_width = 150;
		this.preview_height = 120;
	}

	async browser() {
		let i;
		let html = '';

		if (config.layer.type != 'image') {
			alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'));
			return;
		}

		const data = this.get_effects_list();

		for (i in data) {
			const title = data[i].title;

			html += '<div class="item">';
			html += `	<canvas id="c_${data[i].key}" width="${this.preview_width}" height="${this.preview_height}" class="effectsPreview" data-key="${data[i].key}"></canvas>`;
			html += `<div class="preview-item-title">${title}</div>`;
			html += '</div>';
		}
		for (i = 0; i < 4; i++) {
			html += '<div class="item"></div>';
		}

		const settings = {
			title: 'Effects browser',
			className: 'wide',
			on_load: (params, popup) => {
				const node = document.createElement("div");
				node.classList.add('flex-container');
				node.innerHTML = html;
				popup.el.querySelector('.dialog_content').appendChild(node);
				//events
				const targets = popup.el.querySelectorAll('.item canvas');
				for (let i = 0; i < targets.length; i++) {
					targets[i].addEventListener('click', (event) => {
						//we have click
						const key = event.currentTarget.dataset.key;
						for (const i in data) {
							if(data[i].key == key){
								const function_name = this.get_function_from_path(key);
								this.POP.hide();
								data[i].object[function_name]();
							}
						}
					});
				}
			},
		};
		this.POP.show(settings);

		//sleep, lets wait till DOM is finished
		await new Promise(r => setTimeout(r, 10));

		//generate thumb
		const active_image = this.Base_layers.convert_layer_to_canvas();

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext("2d");
		canvas.width = this.preview_width;
		canvas.height = this.preview_height;

		ctx.scale(this.preview_width / active_image.width, this.preview_height / active_image.height);
		ctx.drawImage(active_image, 0, 0);
		ctx.scale(1, 1);

		//draw demo thumbs
		for (i in data) {
			const function_name = 'demo';
			if(typeof data[i].object[function_name] == "undefined")
				continue;
			data[i].object[function_name](`c_${data[i].key}`, canvas);
		}
	}

	get_effects_list() {
		const list = [];

		for (const i in this.Base_gui.modules) {
			if (i.indexOf("effects") == -1 || i.indexOf("abstract") > -1 || i.indexOf("browser") > -1)
				continue;

			list.push({
				title: this.get_filter_title(i),
				key: i,
				object: this.Base_gui.modules[i],
			});
		}

		list.sort((a, b) => {
			const nameA = a.title.toUpperCase();
			const nameB = b.title.toUpperCase();
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
			return 0;
		});

		return list;
	}

	get_filter_title(key) {
		const parts = key.split("/");
		let title = parts[parts.length - 1];

		//exceptions
		if (title == 'negative')
			title = 'invert';

		title = title.replace(/_/g, ' ');
		title = title.charAt(0).toUpperCase() + title.slice(1); //make first letter uppercase

		return title;
	}

	get_function_from_path(path){
		const parts = path.split("/");
		let result = parts[parts.length - 1];
		result = result.replace(/-/, '_');

		return result;
	}
}

export default Effects_browser_class;
