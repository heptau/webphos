/**
 * user dialogs library
 * 
 * @author ViliusL
 * 
 * Usage:
 * 
 * import Dialog_class from './libs/popup.js';
 * var POP = new popup();
 * 
 * var settings = {
 *		title: 'Differences',
 *		comment: '',
 *		preview: true,
 *		className: '',
 *		params: [
 *			{name: "param1", title: "Parameter #1:", value: "111"},
 *			{name: "param2", title: "Parameter #2:", value: "222"},
 *		],
 *		on_load: function(params){...},
 *		live:		true - call on_change(params) also while a slider is dragged, even without preview
 *		on_change: function(params, canvas_preview, w, h){...},
 *		on_finish: function(params){...},
 *		on_cancel: function(params){...},
 * };
 * this.POP.show(settings);
 * 
 * Params types:
 * - name		type				example
 * - ---------------------------------------------------------------
 * - name		string				'parameter1'
 * - title		string				'enter value:'
 * - type		string				'select', 'textarea', 'color'
 * - value		string				'314'
 * - values		array fo strings	['one', 'two', 'three']
 * - range		numbers interval	[0, 255]
 * - step		int/float			1	
 * - placeholder	text			'enter number here'
 * - html		html text			'<b>bold</b>'
 * - function	function			'custom_function'
 */
import './../../css/popup.css';
import Base_layers_class from './../core/base-layers.js';
import Base_gui_class from './../core/base-gui.js';
import Tools_translate_class, { t } from './../modules/tools/translate.js';
import Helper_class from './../libs/helpers.js';

var template = `
	<button type="button" class="close" data-id="popup_close" title="Close">&times;</button>
	<div data-id="pretitle_area"></div>
	<span class="text_muted right" data-id="popup_comment"></span>
	<h2 class="trn" data-id="popup_title"></h2>
	<div class="dialog_content" data-id="dialog_content">
		<div data-id="preview_content"></div>
		<div data-id="params_content"></div>
	</div>
	<div class="buttons">
		<label class="preview_toggle" data-id="popup_preview_label" hidden>
			<input type="checkbox" data-id="popup_preview_toggle" checked />
			<span class="trn">Preview</span>
		</label>
		<button type="button" data-id="popup_cancel" class="button"><span class="label_cancel trn">Cancel</span><span class="label_reset trn">Reset</span></button>
		<button type="button" data-id="popup_ok" class="button default trn">OK</button>
	</div>
`;

class Dialog_class {

	constructor() {
		if (!window.POP) {
			window.POP = this;
		}

		this.previousPOP = null;
		this.el = null;
		this.eventHandles = [];
		this.active = false;
		this.title = null;
		this.onfinish = false;
		this.oncancel = false;
		this.preview = false;
		this.preview_padding = 0;
		this.onload = false;
		this.onchange = false;
		this.width_mini = 225;
		this.height_mini = 200;
		this.id = 0;
		this.parameters = [];
		this.Base_layers = new Base_layers_class();
		this.Base_gui = new Base_gui_class();
		this.Tools_translate = new Tools_translate_class();
		this.Helper = new Helper_class();
		this.last_params_hash = '';
		this.layer_active_small = document.createElement("canvas");
		this.layer_active_small_ctx = this.layer_active_small.getContext("2d");
		this.caller = null;
		this.resize_clicked = {x: null, y: null}
		this.element_offset = {x: null, y: null}
	}

	/**
	 * shows dialog
	 * 
	 * @param {array} config
	 */
	show(config) {
		if (this.active == true) {
			this.hide();
		}
		//(set after hide(), which restores window.POP)
		this.previousPOP = window.POP === this ? this.previousPOP : window.POP;
		window.POP = this;

		this.title = config.title || '';
		this.parameters = config.params || [];
		this.tabs = config.tabs === true;
		this.onfinish = config.on_finish || false;
		this.oncancel = config.on_cancel || false;
		this.preview = config.preview || false;
		this.preview_padding = config.preview_padding || 0;
		this.onchange = config.on_change || false;
		this.live_change = config.live || false;
		this.onload = config.on_load || false;
		this.className = config.className || '';
		this.comment = config.comment || '';

		//reset position
		this.el = document.createElement('div');
		this.el.classList = 'popup';
		this.el.role = 'dialog';
		this.el.setAttribute('aria-modal', 'true');
		this.opener = document.activeElement;
		document.querySelector('#popups').appendChild(this.el);
		this.el.style.top = null;
		this.el.style.left = null;

		this.show_action();
		this.set_events();
		this.set_accessibility();
	}

	/**
	 * keyboard / screen reader support: labelled dialog, focus moves into the dialog and stays there,
	 * focus returns to the previous element when the dialog closes
	 */
	set_accessibility() {
		var title = this.el.querySelector('[data-id="popup_title"]');
		if (title) {
			title.id = 'popup_title_' + this.id;
			this.el.setAttribute('aria-labelledby', title.id);
		}
		this.el.querySelector('.close').setAttribute('aria-label', 'Close');

		var focusable = () => Array.from(this.el.querySelectorAll(
			'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
		)).filter((element) => element.getClientRects().length > 0 && element.hidden !== true);

		//dialogs that focus their own field (e.g. Resize) keep it
		setTimeout(() => {
			if (this.el && this.el.contains(document.activeElement) == false) {
				var first = this.el.querySelector('.dialog_content input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), .dialog_content select, .dialog_content textarea');
				(first || this.el.querySelector('[data-id="popup_ok"]')).focus();
			}
		}, 0);

		//information dialogs (no fields, no OK action) close with a click outside of them
		var is_information = this.onfinish == false && this.parameters.every((parameter) => parameter.name == undefined);
		if (is_information) {
			var armed = false;
			setTimeout(() => {
				armed = true;
			}, 300);
			this.addEventListener(document, 'mousedown', (event) => {
				//the layer that holds the dialogs covers the page, so a click outside lands on it
				if (armed && event.target === document.getElementById('popups')) {
					this.hide(false);
				}
			}, true);
		}

		this.addEventListener(this.el, 'keydown', (event) => {
			if (event.key != 'Tab') {
				return;
			}
			var items = focusable();
			if (items.length == 0) {
				return;
			}
			var first = items[0];
			var last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			}
			else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		});
	}

	/**
	 * hides dialog
	 * 
	 * @param {boolean} success
	 * @returns {undefined}
	 */
	hide(success) {
		window.POP = this.previousPOP;
		var params = this.get_params();

		if (success === false && this.oncancel) {
			this.oncancel(params);
		}
		var opener = this.opener;
		this.opener = null;
		if (this.el && this.el.parentNode) {
			this.el.parentNode.removeChild(this.el);
		}
		this.parameters = [];
		this.active = false;
		this.preview = false;
		this.preview_padding = 0;
		this.onload = false;
		this.onchange = false;
		this.live_change = false;
		this.title = null;
		this.className = '';
		this.comment = '';
		this.onfinish = false;
		this.oncancel = false;

		this.remove_events();

		//give the focus back to what opened the dialog
		if (opener && opener.isConnected && typeof opener.focus == 'function' && opener !== document.body) {
			opener.focus({preventScroll: true});
		}
	}

	get_active_instances() {
		return document.getElementById('popups').children.length;
	}

	/* ----------------- private functions ---------------------------------- */

	addEventListener(target, type, listener, options) {
		target.addEventListener(type, listener, options);
		const handle = {
			target, type, listener,
			remove() {
				target.removeEventListener(type, listener);
			}
		};
		this.eventHandles.push(handle);
	}

	set_events() {
		this.addEventListener(document, 'keydown', (event) => {
			var code = event.code;

			if (code == "Escape") {
				//escape
				this.hide(false);
			}
		}, false);

		//register events
		this.addEventListener(document, 'mousedown', (event) => {
			if(event.target != this.el.querySelector('h2'))
				return;
			event.preventDefault();
			this.resize_clicked.x = event.pageX;
			this.resize_clicked.y = event.pageY;

			var target = this.el;
			this.element_offset.x = target.offsetLeft;
			this.element_offset.y = target.offsetTop;
		}, false);

		this.addEventListener(document, 'mousemove', (event) => {
			if(this.resize_clicked.x != null){
				var dx = this.resize_clicked.x - event.pageX;
				var dy = this.resize_clicked.y - event.pageY;

				var target = this.el;
				target.style.left = (this.element_offset.x - dx) + "px";
				target.style.top = (this.element_offset.y - dy) + "px";
			}
		}, false);

		this.addEventListener(document, 'mouseup', (event) => {
			if(event.target != this.el.querySelector('h2'))
				return;
			event.preventDefault();
			this.resize_clicked.x = null;
			this.resize_clicked.y = null;
		}, false);

		this.addEventListener(window, 'resize', (event) => {
			var target = this.el;
			target.style.top = null;
			target.style.left = null;
		}, false);
	}

	remove_events() {
		for (let handle of this.eventHandles) {
			handle.remove();
		}
		this.eventHandles = [];
	}

	onChangeEvent(e) {
		var params = this.get_params();

		var hash = JSON.stringify(params);
		if (this.last_params_hash == hash && this.onchange == false) {
			//nothing changed
			return;
		}
		this.last_params_hash = hash;

		if (this.onchange != false) {
			if (this.preview != false) {
				var canvas_right = this.el.querySelector('[data-id="pop_post"]');
				var ctx_right = canvas_right.getContext("2d");

				ctx_right.clearRect(0, 0, this.width_mini, this.height_mini);
				ctx_right.drawImage(this.layer_active_small,
					this.preview_padding, this.preview_padding,
					this.width_mini - this.preview_padding * 2, this.height_mini - this.preview_padding * 2
				);

				this.onchange(params, ctx_right, this.width_mini, this.height_mini, canvas_right);
			}
			else {
				this.onchange(params);
			}
		}
	}

	//renders preview. If input=range supported, is called on every param update - must be fast...
	preview_handler(e) {
		if (this.preview !== false || this.live_change === true) {
			this.onChangeEvent(e);
		}
	}

	//OK pressed - prepare data and call handlers
	save() {
		var params = this.get_params();

		if (this.onfinish) {
			this.onfinish(params);
		}

		this.hide(true);
	}
	
	//"Cancel" pressed
	cancel() {
		if (this.oncancel) {
			var params = this.get_params();
			this.oncancel(params);
		}
	}

	get_params() {
		var response = {};
		if(this.el == undefined){
			return null;
		}
		var inputs = this.el.querySelectorAll('input');
		for (var i = 0; i < inputs.length; i++) {
			if (inputs[i].id.substr(0, 9) == 'pop_data_') {
				var key = inputs[i].id.substr(9);
				if (this.strpos(key, "_poptmp") != false)
					key = key.substring(0, this.strpos(key, "_poptmp"));
				var value = inputs[i].value;
				if (inputs[i].type == 'radio') {
					if (inputs[i].checked == true)
						response[key] = value;
				}
				else if (inputs[i].type == 'number') {
					response[key] = parseFloat(value);
				}
				else if (inputs[i].type == 'checkbox') {
					if (inputs[i].checked == true)
						response[key] = true;
					else
						response[key] = false;
				}
				else if (inputs[i].type == 'range') {
					response[key] = parseFloat(value);
				}
				else {
					response[key] = value;
				}

			}
		}
		var selects = this.el.querySelectorAll('select');
		for (var i = 0; i < selects.length; i++) {
			if (selects[i].id.substr(0, 9) == 'pop_data_') {
				var key = selects[i].id.substr(9);
				response[key] = selects[i].value;
			}
		}
		var textareas = this.el.querySelectorAll('textarea');
		for (var i = 0; i < textareas.length; i++) {
			if (textareas[i].id.substr(0, 9) == 'pop_data_') {
				var key = textareas[i].id.substr(9);
				response[key] = textareas[i].value;
			}
		}

		return response;
	}

	/**
	 * show popup window.
	 * used strings: "OK", "Cancel", "Preview"
	 */
	show_action() {
		this.id = this.getRandomInt(0, 999999999);
		if (this.active == true) {
			this.hide();
			return false;
		}
		this.active = true;

		//build content
		var html_pretitle_area = '';
		var html_preview_content = '';
		var html_params = '';

		//preview area - keeps the aspect ratio of the image
		var preview_source = null;
		if (this.preview !== false) {
			preview_source = this.Base_layers.convert_layer_to_canvas();
			var fit = this.fit_preview_size(preview_source.width, preview_source.height);
			this.width_mini = fit.width;
			this.height_mini = fit.height;
			html_preview_content += '<div class="preview_container">';
			html_preview_content += '<canvas class="preview_canvas_left" width="' + this.width_mini + '" height="'
				+ this.height_mini + '" data-id="pop_pre"></canvas>';
			html_preview_content += '<div class="canvas_preview_container">';
			html_preview_content += '	<canvas class="preview_canvas_post_back" width="' + this.width_mini
				+ '" height="' + this.height_mini + '" data-id="pop_post_back"></canvas>';
			html_preview_content += '	<canvas class="preview_canvas_post" width="' + this.width_mini + '" height="'
				+ this.height_mini + '" data-id="pop_post"></canvas>';
			html_preview_content += '</div>';
			html_preview_content += '</div>';
		}

		//generate params
		html_params += this.generateParamsHtml();

		this.el.innerHTML = template;
		this.el.querySelector('[data-id="pretitle_area"]').innerHTML = html_pretitle_area;
		this.el.querySelector('[data-id="popup_title"]').innerHTML = this.Helper.escapeHtml(this.title);
		this.el.querySelector('[data-id="popup_comment"]').innerHTML = this.Helper.escapeHtml(this.comment);
		this.el.querySelector('[data-id="preview_content"]').innerHTML = html_preview_content;
		this.el.querySelector('[data-id="params_content"]').innerHTML = html_params;
		this.el.querySelectorAll('.tab_bar .tab_button').forEach((button) => {
			button.addEventListener('click', () => this.select_tab(button.getAttribute('data-tab')));
		});
		if (this.onfinish != false) {
			this.el.querySelector('[data-id="popup_cancel"]').style.display = '';
		}
		else {
			this.el.querySelector('[data-id="popup_cancel"]').style.display = 'none';
		}

		this.el.style.display = "flex";
		if (this.className) {
			this.el.classList.add(this.className);
		}
		if (this.preview !== false) {
			this.el.classList.add('has_preview');
			this.el.querySelector('[data-id="popup_preview_label"]').hidden = false;
		}
		this.initial_values = this.get_initial_values();
		this.set_comfort_events();

		//replace color inputs
		this.el.querySelectorAll('input[type="color"]').forEach((colorInput) => {
			const id = colorInput.getAttribute('id');
			colorInput.removeAttribute('id');
			$(colorInput)
				.uiColorInput({ inputId: id })
				.on('change', (e) => {
					this.onChangeEvent(e);
				});
		});

		//events
		this.el.querySelector('[data-id="popup_ok"]').addEventListener('click', (event) => {
			this.save();
		});
		this.el.querySelector('[data-id="popup_cancel"]').addEventListener('click', (event) => {
			if (event.altKey || this.el.classList.contains('alt_reset')) {
				this.reset_params();
				return;
			}
			this.hide(false);
		});
		this.el.querySelector('[data-id="popup_close"]').addEventListener('click', (event) => {
			this.hide(false);
		});
		var targets = this.el.querySelectorAll('input');
		for (var i = 0; i < targets.length; i++) {
			targets[i].addEventListener('keyup', (event) => {
				this.onkeyup(event);
			});
		}

		//onload
		if (this.onload) {
			var params = this.get_params();
			this.onload(params, this);
		}

		//load preview
		if (this.preview !== false) {
			//get canvas from layer
			var canvas = preview_source;

			//draw original image
			var canvas_left = this.el.querySelector('[data-id="pop_pre"]');
			var pop_pre = canvas_left.getContext("2d");
			pop_pre.clearRect(0, 0, this.width_mini, this.height_mini);
			pop_pre.rect(0, 0, this.width_mini, this.height_mini);
			pop_pre.fillStyle = "#ffffff";
			pop_pre.fill();
			this.draw_background(pop_pre, this.width_mini, this.height_mini, 10);

			pop_pre.scale(this.width_mini / canvas.width, this.height_mini / canvas.height);
			pop_pre.drawImage(canvas, 0, 0);
			pop_pre.scale(1, 1);

			//prepare temp canvas for faster repaint
			this.layer_active_small.width = window.POP.width_mini;
			this.layer_active_small.height = window.POP.height_mini;
			this.layer_active_small_ctx.scale(this.width_mini / canvas.width, this.height_mini / canvas.height);
			this.layer_active_small_ctx.drawImage(canvas, 0, 0);
			this.layer_active_small_ctx.scale(1, 1);

			//draw right background
			var canvas_right_back = this.el.querySelector('[data-id="pop_post_back"]').getContext("2d");
			this.draw_background(canvas_right_back, this.width_mini, this.height_mini, 10);

			//copy to right side
			var canvas_right = this.el.querySelector('[data-id="pop_post"]').getContext("2d");
			canvas_right.clearRect(0, 0, this.width_mini, this.height_mini);
			canvas_right.drawImage(canvas_left,
				this.preview_padding, this.preview_padding,
				this.width_mini - this.preview_padding * 2, this.height_mini - this.preview_padding * 2);

			//prepare temp canvas
			this.preview_handler();
		}

		//call translation again to translate popup
		var lang = this.Base_gui.get_language();
		this.Tools_translate.translate(lang);
	}

	/**
	 * text of a drop-down item; "1920x1080 - Full HD" has a translated description part
	 */
	option_label(value) {
		var text = String(value);
		var parts = text.split(' - ');
		if (parts.length > 1) {
			return parts[0] + ' - ' + t(parts.slice(1).join(' - '));
		}
		return t(text);
	}

	/**
	 * size of the preview that fits the box and keeps the aspect ratio of the image
	 *
	 * @param {number} width image width
	 * @param {number} height image height
	 * @returns {{width: number, height: number}}
	 */
	fit_preview_size(width, height) {
		var max_w = 260;
		var max_h = 220;
		if (!(width > 0) || !(height > 0)) {
			return {width: this.width_mini, height: this.height_mini};
		}
		//small images are enlarged at most 4 times, so pixels stay recognizable
		var scale = Math.min(max_w / width, max_h / height, 4);
		return {
			width: Math.max(1, Math.round(width * scale)),
			height: Math.max(1, Math.round(height * scale)),
		};
	}

	generateParamsHtml() {
		var esc = (value) => this.Helper.escapeHtml(String(value));
		var html = '<table>';
		var title = null;
		var tabs = [];
		//with tabs, headings become toolbar-like tab buttons and the rows after them form the panel
		//the label column is only reserved for checkboxes when the same panel has some label to align with
		var is_checkbox = (p) => p.name != undefined && typeof p.value == 'boolean' && p.values == undefined && p.range == undefined && p.type != 'color';
		var group_has_labels = [];
		var group = -1;
		for (var j in this.parameters) {
			var item = this.parameters[j];
			if (this.tabs && item.heading != undefined) {
				group++;
				continue;
			}
			group_has_labels[group] = group_has_labels[group] || (item.title != undefined && item.title !== '' && !is_checkbox(item));
		}
		group = -1;
		for (var i in this.parameters) {
			var parameter = this.parameters[i];
			var pname = parameter.name != undefined ? esc(parameter.name) : '';

			if (this.tabs && parameter.heading != undefined) {
				group++;
				html += (tabs.length ? '</tbody>' : '') + '<tbody class="tab_panel" data-tab="' + tabs.length + '"'
					+ (tabs.length ? ' hidden' : '') + '>';
				tabs.push(parameter);
				continue;
			}
			html += '<tr id="popup-tr-' + pname + '">';
			if (title != 'Error' && parameter.title != undefined && is_checkbox(parameter)) {
				if (group_has_labels[group]) {
					html += '<th></th>';
				}
			}
			else if (title != 'Error' && parameter.title != undefined)
				html += '<th class="trn">' + this.Helper.escapeHtml(parameter.title) + '</th>';
			if (parameter.name != undefined) {
				if (parameter.values != undefined) {
					if (parameter.values.length > 10 || parameter.type == 'select') {
						//drop down
						html += '<td colspan="2"><select onchange="POP.onChangeEvent();" id="pop_data_' + pname
							+ '">';
						var k = 0;
						for (var j in parameter.values) {
							var sel = '';
							if (parameter.value == parameter.values[j])
								sel = 'selected="selected"';
							if (parameter.value == undefined && k == 0)
								sel = 'selected="selected"';
							html += '<option ' + sel + ' value="' + esc(parameter.values[j]) + '">'
								+ esc(this.option_label(parameter.values[j])) + '</option>';
							k++;
						}
						html += '</select></td>';
					}
					else {
					//radio
					html += '<td class="radios" colspan="2">';
					if (parameter.values.length > 2)
						html += '<div class="group" id="popup-group-' + pname + '">';
					var k = 0;
					for (var j in parameter.values) {
						var ch = '';
						if (parameter.value == parameter.values[j])
							ch = 'checked="checked"';
						if (parameter.value == undefined && k == 0)
							ch = 'checked="checked"';

						var title = esc(parameter.values[j]);
						var parts = parameter.values[j].split(" - ");
						if (parts.length > 1) {
							title = esc(parts[0]) + ' - <span class="trn">' + esc(parts[1]) + '</span>';
						}

						html += '<input type="radio" onchange="POP.onChangeEvent();" ' + ch + ' name="'
							+ pname + '" id="pop_data_' + pname + "_poptmp" + j + '" value="'
							+ esc(parameter.values[j]) + '">';
						html += '<label class="trn" for="pop_data_' + pname + "_poptmp" + j + '">' + title
							+ '</label>';
						if (parameter.values.length > 2)
							html += '<br />';
						k++;
					}
						if (parameter.values.length > 2)
							html += '</div>';
						html += '</td>';
					}
				}
				else if (parameter.value != undefined) {
					//input, range, textarea, color
					var step = 1;
					if (parameter.step != undefined)
						step = parameter.step;
				if (parameter.range != undefined) {
					//range
					html += '<td><input type="range" name="' + pname + '" id="pop_data_' + pname
						+ '" value="' + esc(parameter.value) + '" min="' + parameter.range[0] + '" max="'
						+ parameter.range[1] + '" step="' + step
						+ '" oninput="POP.range_input(this);" '
						+'onchange="POP.onChangeEvent();" /></td>';
					html += '<td class="range_value"><input type="number" class="range_number" data-for="pop_data_' + pname
						+ '" value="' + esc(parameter.value) + '" min="' + parameter.range[0] + '" max="'
						+ parameter.range[1] + '" step="' + step
						+ '" oninput="POP.range_number(this);" onchange="POP.range_number_commit(this);" /></td>';
				}
				else if (parameter.type == 'color') {
					//color
					html += '<td><input type="color" id="pop_data_' + pname + '" value="' + esc(parameter.value)
						+ '" onchange="POP.onChangeEvent();" /></td>';
				}
				else if (typeof parameter.value == 'boolean') {
					//macOS style: checkbox first, label after it (no separate title column)
					var checked = parameter.value === true ? 'checked' : '';
					var label = parameter.title != undefined ? t(parameter.title).replace(/:\s*$/, '') : '';
					html += '<td class="checkbox" colspan="' + (group_has_labels[group] ? 2 : 3) + '"><input type="checkbox" id="pop_data_' + pname + '" '
						+ checked + ' onclick="POP.onChangeEvent();" > <label for="pop_data_'
						+ pname + '">' + this.Helper.escapeHtml(label) + '</label></td>';
				}
				else {
					//input or textarea
					if (parameter.placeholder == undefined)
						parameter.placeholder = '';
					if (parameter.type == 'textarea') {
						//textarea
						html += '<td><textarea rows="10" id="pop_data_' + pname
							+ '" onchange="POP.onChangeEvent();" placeholder="' + esc(parameter.placeholder) + '" ' + (parameter.prevent_submission ? 'data-prevent-submission=""' : '' ) + '>'
							+ esc(parameter.value) + '</textarea></td>';
					}
					else {
						//text or number
						var input_type = "text";
						if (parameter.placeholder != '' && !isNaN(parameter.placeholder))
							input_type = 'number';
						if (parameter.value != undefined && typeof parameter.value == 'number')
							input_type = 'number';

var comment_html = '';
					if (typeof parameter.comment !== 'undefined') {
						comment_html = '<span class="field_comment trn">' + this.Helper.escapeHtml(parameter.comment) + '</span>';
					}

						html += '<td colspan="2"><input type="' + input_type + '" id="pop_data_' + pname
							+ '" onchange="POP.onChangeEvent();" value="' + esc(parameter.value) + '" placeholder="'
							+ esc(parameter.placeholder) + '" ' + (parameter.prevent_submission ? 'data-prevent-submission=""' : '' ) + ' />'+comment_html+'</td>';
					}
				}
				}
			}
			else if (parameter.heading != undefined) {
				//section heading
				html += '<td class="heading trn" colspan="3">' + this.Helper.escapeHtml(parameter.heading) + '</td>';
			}
			else if (parameter.function != undefined) {
				//custom function
				var result;
				result = parameter.function();
				html += '<td colspan="3">' + result + '</td>';
			}
			else if (parameter.html != undefined) {
				//html
				html += '<td class="html_value" colspan="2">' + parameter.html + '</td>';
			}
			else if (parameter.title == undefined) {
				//gap
				html += '<td colspan="2"></td>';
			}
			else {
				//locked fields without name
				var str = "" + parameter.value;
				var id_tmp = parameter.title.toLowerCase().replace(/[^\w]+/g, '').replace(/ +/g, '-');
				id_tmp = id_tmp.substring(0, 10);
				if (str.length < 40)
					html += '<td colspan="2"><div class="trn" id="pop_data_' + id_tmp + '">' + this.Helper.escapeHtml(str)
						+ '</div></td>';
				else
					html += '<td class="long_text_value" colspan="2"><textarea disabled="disabled">' + this.Helper.escapeHtml(str)
						+ '</textarea></td>';
			}
			html += '</tr>';
		}
		if (tabs.length) {
			html += '</tbody>';
		}
		html += '</table>';
		if (tabs.length) {
			var bar = '<div class="tab_bar" role="tablist">';
			for (var k = 0; k < tabs.length; k++) {
				bar += '<button type="button" role="tab" class="tab_button" data-tab="' + k + '" aria-selected="' + (k == 0)
					+ '"><span class="tab_icon" aria-hidden="true">' + (tabs[k].icon || '') + '</span><span>'
					+ this.Helper.escapeHtml(t(tabs[k].heading)) + '</span></button>';
			}
			html = bar + '</div>' + html;
		}

		return html;
	}

	/**
	 * shows one panel of a dialog with tabs
	 *
	 * @param {string|number} index
	 */
	select_tab(index) {
		if (!this.el) {
			return;
		}
		this.el.querySelectorAll('.tab_bar .tab_button').forEach((button) => {
			button.setAttribute('aria-selected', String(button.getAttribute('data-tab') == String(index)));
		});
		this.el.querySelectorAll('tbody.tab_panel').forEach((panel) => {
			panel.hidden = panel.getAttribute('data-tab') != String(index);
		});
	}

	/* ---------------- Photoshop-like dialog helpers ------------------------ */

	//slider moved: update the number box next to it
	range_input(slider) {
		if (!this.el) {
			return;
		}
		var number = this.el.querySelector('.range_number[data-for="' + slider.id + '"]');
		if (number) {
			number.value = Math.round(slider.value * 100) / 100;
		}
		this.preview_handler();
	}

	//number box typed: move the slider
	range_number(number) {
		if (!this.el) {
			return;
		}
		var slider = document.getElementById(number.dataset.for);
		var value = parseFloat(number.value);
		if (!slider || isNaN(value)) {
			return;
		}
		slider.value = Math.min(parseFloat(slider.max), Math.max(parseFloat(slider.min), value));
		this.preview_handler();
	}

	//number box left: show the clamped value and update preview
	range_number_commit(number) {
		if (!this.el) {
			return;
		}
		var slider = document.getElementById(number.dataset.for);
		if (slider) {
			number.value = Math.round(slider.value * 100) / 100;
		}
		this.onChangeEvent();
	}

	get_initial_values() {
		var values = {};
		for (var i in this.parameters) {
			var parameter = this.parameters[i];
			if (parameter.name == undefined) {
				continue;
			}
			var value = parameter.value;
			if (value == undefined && parameter.values != undefined) {
				value = parameter.values[0];
			}
			values[parameter.name] = value;
		}
		return values;
	}

	//Alt + Cancel: restore values the dialog was opened with
	reset_params() {
		var fire = (element, type) => element.dispatchEvent(new Event(type, {bubbles: true}));
		for (var name in this.initial_values) {
			var value = this.initial_values[name];
			var inputs = this.el.querySelectorAll('[id^="pop_data_' + name + '"]');
			for (var i = 0; i < inputs.length; i++) {
				var input = inputs[i];
				if (input.id != 'pop_data_' + name && input.id.indexOf('pop_data_' + name + '_poptmp') != 0) {
					continue;
				}
				if (input.type == 'radio') {
					input.checked = (input.value == String(value));
				}
				else if (input.type == 'checkbox') {
					input.checked = Boolean(value) && value !== 'false' && value !== '0' && value !== 0;
				}
				else if (input.disabled) {
					continue;
				}
				else {
					input.value = value;
					if (input.type == 'range') {
						this.range_input(input);
					}
					else if (input.type == 'color') {
						fire(input, 'input');
					}
				}
			}
		}
		this.last_params_hash = '';
		this.onChangeEvent();
	}

	set_comfort_events() {
		//preview checkbox and press-and-hold on the preview shows the original image
		var toggle = this.el.querySelector('[data-id="popup_preview_toggle"]');
		toggle.addEventListener('change', () => {
			this.el.classList.toggle('show_original', toggle.checked == false);
		});
		var preview = this.el.querySelector('.canvas_preview_container');
		if (preview) {
			var show = (flag) => {
				this.el.classList.toggle('show_original', flag || toggle.checked == false);
			};
			preview.addEventListener('mousedown', () => show(true));
			this.addEventListener(document, 'mouseup', () => show(false));
		}

		//Alt turns "Cancel" into "Reset"
		var alt = (event) => {
			this.el.classList.toggle('alt_reset', event.altKey === true);
		};
		this.addEventListener(document, 'keydown', alt);
		this.addEventListener(document, 'keyup', alt);
		this.addEventListener(window, 'blur', () => this.el.classList.remove('alt_reset'));

		//drag over a label to change the slider next to it
		var rows = this.el.querySelectorAll('tr');
		for (var i = 0; i < rows.length; i++) {
			if (rows[i].querySelector('input[type="range"]') && rows[i].querySelector('th')) {
				rows[i].querySelector('th').classList.add('scrub');
			}
		}
		var scrub = null;
		this.el.addEventListener('mousedown', (event) => {
			var th = event.target.closest ? event.target.closest('th.scrub') : null;
			if (!th) {
				return;
			}
			var slider = th.parentNode.querySelector('input[type="range"]');
			event.preventDefault();
			scrub = {
				x: event.pageX,
				slider: slider,
				start: parseFloat(slider.value),
				min: parseFloat(slider.min),
				max: parseFloat(slider.max),
				step: parseFloat(slider.step) || 1,
			};
		});
		this.addEventListener(document, 'mousemove', (event) => {
			if (!scrub) {
				return;
			}
			var value = scrub.start + (event.pageX - scrub.x) * (scrub.max - scrub.min) / 250;
			value = Math.round(value / scrub.step) * scrub.step;
			scrub.slider.value = Math.min(scrub.max, Math.max(scrub.min, value));
			this.range_input(scrub.slider);
		});
		this.addEventListener(document, 'mouseup', () => {
			if (scrub) {
				scrub = null;
				this.onChangeEvent();
			}
		});
	}

	//on key press inside input text
	onkeyup(event) {
		if (event.key == 'Enter') {
			if (event.target.hasAttribute('data-prevent-submission')) {
				event.preventDefault();
			} else {
				this.save();
			}
		}
	}

	getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	strpos(haystack, needle, offset) {
		var i = (haystack + '').indexOf(needle, (offset || 0));
		return i === -1 ? false : i;
	}

	draw_background(canvas, W, H, gap, force) {
		var transparent = this.Base_gui.get_transparency_support();

		if (transparent == false && force == undefined) {
			canvas.beginPath();
			canvas.rect(0, 0, W, H);
			canvas.fillStyle = "#ffffff";
			canvas.fill();
			return false;
		}
		if (gap == undefined)
			gap = 10;
		var fill = true;
		for (var i = 0; i < W; i = i + gap) {
			if (i % (gap * 2) == 0)
				fill = true;
			else
				fill = false;
			for (var j = 0; j < H; j = j + gap) {
				if (fill == true) {
					canvas.fillStyle = '#eeeeee';
					canvas.fillRect(i, j, gap, gap);
					fill = false;
				}
				else
					fill = true;
			}
		}
	}

}

export default Dialog_class;