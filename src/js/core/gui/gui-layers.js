/*
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

import app from './../../app.js';
import config from './../../config.js';
import Base_layers_class from './../base-layers.js';
import Helper_class from './../../libs/helpers.js';
import { validate_layer_name } from './../../libs/input-validator.js';
import Layer_rename_class from './../../modules/layer/rename.js';
import Effects_browser_class from './../../modules/effects/browser.js';
import { is_vector_layer } from './../../libs/raster-tools.js';
import Layer_duplicate_class from './../../modules/layer/duplicate.js';
import Layer_raster_class from './../../modules/layer/raster.js';
import { panel_rows, group_props_of } from './../../libs/layer-groups.js';
import Tools_translate_class, { t } from './../../modules/tools/translate.js';

//blend modes shown in the layers panel (like Photoshop), canvas composite operation -> label
const BLEND_MODES = [
	['source-over', 'Normal'],
	['darken', 'Darken'],
	['multiply', 'Multiply'],
	['color-burn', 'Color Burn'],
	['lighten', 'Lighten'],
	['screen', 'Screen'],
	['color-dodge', 'Color Dodge'],
	['overlay', 'Overlay'],
	['soft-light', 'Soft Light'],
	['hard-light', 'Hard Light'],
	['difference', 'Difference'],
	['exclusion', 'Exclusion'],
	['hue', 'Hue'],
	['saturation', 'Saturation'],
	['color', 'Color'],
	['luminosity', 'Luminosity'],
];

const template = `
	<input type="search" id="layer_search" class="layer_search" aria-label="Search layers" autocomplete="off" />
	<div class="layer_props">
		<select id="layer_blend" aria-label="Blend mode" title="Blend mode">
			${ BLEND_MODES.map((mode) => `<option class="trn" value="${mode[0]}">${mode[1]}</option>`).join('') }
		</select>
		<label class="layer_opacity" title="Opacity">
			<span class="trn">Opacity:</span>
			<input type="number" id="layer_opacity" min="0" max="100" step="1" /> %
		</label>
		<label class="layer_opacity" title="Fill opacity: fades the layer's pixels, but not its styles">
			<span class="trn">Fill:</span>
			<input type="number" id="layer_fill_opacity" min="0" max="100" step="1" /> %
		</label>
	</div>
	<div class="layer_buttons">
		<button type="button" class="layers_arrow trn" title="Move layer up" id="layer_up"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg></button>
		<button type="button" class="layers_arrow trn" title="Move layer down" id="layer_down"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg></button>
		<button type="button" class="layer_raster trn" id="layer_raster" title="Convert layer to raster"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11"/></svg></button>
		<button type="button" class="layer_duplicate trn" id="layer_duplicate" title="Duplicate layer"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 3.5v-.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h.5"/></svg></button>
		<button type="button" class="layer_add trn" id="insert_layer" title="Insert new layer"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M8 5.5v5M5.5 8h5"/></svg></button>
	</div>

	<div class="layers_list" id="layers"></div>
`;

/**
 * GUI class responsible for rendering layers on right sidebar
 */
class GUI_layers_class {

	constructor() {
		this.Base_layers = new Base_layers_class();
		this.Helper = new Helper_class();
		this.Layer_rename = new Layer_rename_class();
		this.Effects_browser = new Effects_browser_class();
		this.Layer_duplicate = new Layer_duplicate_class();
		this.Layer_raster = new Layer_raster_class();
		this.Tools_translate = new Tools_translate_class();
		this.layer_filter = '';
	}

	render_main_layers() {
		document.getElementById('layers_base').innerHTML = template;
		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, document.getElementById('layers_base'));
		}
		this.render_layers();
		this.set_events();
	}

	set_events() {

		//search in layer names
		document.getElementById('layer_search').addEventListener('input', (event) => {
			this.layer_filter = event.currentTarget.value.trim().toLowerCase();
			this.render_layers();
		});
		//drag layers to change the order
		let dragged = null;
		const list = document.getElementById('layers');
		list.addEventListener('dragstart', (event) => {
			const button = event.target.closest ? event.target.closest('button.layer_name') : null;
			if (!button || this.layer_filter) {
				event.preventDefault();
				return;
			}
			dragged = button.dataset.id;
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', dragged);
		});
		list.addEventListener('dragover', (event) => {
			if (dragged !== null) {
				event.preventDefault();
			}
		});
		list.addEventListener('drop', (event) => {
			if (dragged === null) {
				return;
			}
			const header = event.target.closest ? event.target.closest('button.group_toggle') : null;
			if (header) {
				//dropped on the row of a group: the layer goes into the group
				event.preventDefault();
				app.GUI.run_target('layer/group.move_into_group', [dragged, header.dataset.group]);
				dragged = null;
				return;
			}
			const target = event.target.closest ? event.target.closest('button.layer_name') : null;
			if (!target) {
				return;
			}
			event.preventDefault();
			const ids = Array.from(list.querySelectorAll('button.layer_name')).map((button) => {
				return button.dataset.id;
			});
			const steps = ids.indexOf(dragged) - ids.indexOf(target.dataset.id);
			const moved = config.layers.find((layer) => layer.id == dragged);
			const onto = config.layers.find((layer) => layer.id == target.dataset.id);
			if (steps != 0) {
				const actions = [];
				for (let i = 0; i < Math.abs(steps); i++) {
					actions.push(new app.Actions.Reorder_layer_action(dragged, steps > 0 ? 1 : -1));
				}
				app.State.do_action(new app.Actions.Bundle_action('reorder_layers', 'Reorder Layer', actions));
			}
			if (moved && onto && (moved.group || null) !== (onto.group || null)) {
				//dropped among the layers of a group (or of no group): the layer is in that group now
				app.GUI.run_target('layer/group.move_into_group', [moved.id, onto.group || null]);
			}
			dragged = null;
		});
		list.addEventListener('dragend', () => {
			dragged = null;
		});

		//blend mode and opacity of the selected layer
		const change_layer_prop = function (props) {
			if (!config.layer) {
				return;
			}
			app.State.do_action(
				new app.Actions.Bundle_action('change_layer_details', 'Change Layer Details', [
					new app.Actions.Update_layer_action(config.layer.id, props)
				])
			);
		};
		document.getElementById('layer_blend').addEventListener('change', function () {
			change_layer_prop({composition: this.value});
		});
		document.getElementById('layer_opacity').addEventListener('change', function () {
			let value = parseInt(this.value, 10);
			if (isNaN(value)) {
				value = 100;
			}
			change_layer_prop({opacity: Math.min(100, Math.max(0, value))});
		});

		document.getElementById('layer_fill_opacity').addEventListener('change', function () {
			let value = parseInt(this.value, 10);
			if (isNaN(value)) {
				value = 100;
			}
			change_layer_prop({fill_opacity: Math.min(100, Math.max(0, value))});
		});

		document.getElementById('layers_base').addEventListener('click', (event) => {
			let target = event.target;
			if (target.closest && target.closest('.layer_buttons button')) {
				//the buttons contain icons, the click can come from the icon
				target = target.closest('.layer_buttons button');
			}
			if (target.id == 'insert_layer') {
				//new layer
				app.State.do_action(
					new app.Actions.Insert_layer_action()
				);
			}
			else if (target.id == 'layer_duplicate') {
				//duplicate
				this.Layer_duplicate.duplicate();
			}
			else if (target.id == 'layer_raster') {
				//raster
				this.Layer_raster.raster();
			}
			else if (target.id == 'layer_up') {
				//move layer up
				app.State.do_action(
					new app.Actions.Reorder_layer_action(config.layer.id, 1)
				);
			}
			else if (target.id == 'layer_down') {
				//move layer down
				app.State.do_action(
					new app.Actions.Reorder_layer_action(config.layer.id, -1)
				);
			}
			else if (target.classList && target.classList.contains('group_toggle')) {
				app.GUI.run_target('layer/group.toggle_collapsed', target.dataset.group);
			}
			else if (target.classList && target.classList.contains('group_visibility')) {
				app.GUI.run_target('layer/group.set_visibility', target.dataset.group);
			}
			else if (target.id == 'visibility') {
				if (event.altKey) {
					//Alt + click shows only this layer (a second Alt + click shows all again)
					return this.solo_layer(target.dataset.id);
				}
				//change visibility
				return app.State.do_action(
					new app.Actions.Toggle_layer_visibility_action(target.dataset.id)
				);
			}
			else if (target.id == 'delete') {
				//delete layer
				app.State.do_action(
					new app.Actions.Delete_layer_action(target.dataset.id)
				);
			}
			else if (target.id == 'layer_name') {
				if (event.ctrlKey || event.metaKey) {
					//Ctrl+click - select the non transparent pixels of the layer (as in Photoshop)
					(async function () {
						if (target.dataset.id != config.layer.id) {
							await app.State.do_action(
								new app.Actions.Select_layer_action(target.dataset.id)
							);
						}
						app.GUI.run_target('edit/selection.layer_transparency');
					})();
					return;
				}
				if (event.shiftKey && target.dataset.id != config.layer.id) {
					//Shift+click - link / unlink the layer with the active layer
					app.GUI.run_target('layer/link.toggle_with_active', target.dataset.id);
					return;
				}
				//select layer
				if (target.dataset.id == config.layer.id)
					return;
				app.State.do_action(
					new app.Actions.Select_layer_action(target.dataset.id)
				);
			}
			else if (target.id == 'delete_mask') {
				//delete layer mask
				app.State.do_action(
					new app.Actions.Bundle_action('layer_mask', 'Delete Mask', [
						new app.Actions.Update_layer_action(parseInt(target.dataset.pid), {mask: null}),
					])
				);
			}
			else if (target.id == 'mask_name') {
				//disable / enable layer mask
				const mask_layer = app.Layers.get_layer(parseInt(target.dataset.pid));
				if (mask_layer) {
					app.State.do_action(
						new app.Actions.Bundle_action('layer_mask', 'Toggle Mask', [
							new app.Actions.Update_layer_action(mask_layer.id, {mask_enabled: mask_layer.mask_enabled === false}),
						])
					);
				}
			}
			else if (target.id == 'delete_filter') {
				//delete filter
				app.State.do_action(
					new app.Actions.Delete_layer_filter_action(target.dataset.pid, target.dataset.id)
				);
			}
			else if (target.id == 'filter_name') {
				//edit filter
				const effects = this.Effects_browser.get_effects_list();
				const key = target.dataset.filter.toLowerCase();
				for (const i in effects) {
					if(effects[i].title.toLowerCase() == key){
						this.Base_layers.select(target.dataset.pid);
						const function_name = this.Effects_browser.get_function_from_path(key);
						effects[i].object[function_name](target.dataset.id);
					}
				}
			}
		});

		document.getElementById('layers_base').addEventListener('dblclick', (event) => {
			const target = event.target;
			if (target.classList && target.classList.contains('group_toggle')) {
				//the settings of the group (the two clicks have folded and unfolded it again)
				app.GUI.run_target('layer/group.group_settings', target.dataset.group);
				return;
			}
			if (target.id == 'layer_name') {
				const clicked = config.layers.find((layer) => layer.id == target.dataset.id);
				if (clicked && clicked.type == 'adjustment') {
					//an adjustment layer opens its settings
					app.GUI.run_target('layer/adjustment.edit');
					return;
				}
				if (clicked && clicked.type == 'pen') {
					//a path layer goes back to the Pen tool
					app.GUI.run_target('layer/path.edit_path');
					return;
				}
				//rename layer directly in the list
				this.rename_inline(target);
			}
		});

	}

	/**
	 * the name of the layer becomes a text field (Enter saves, Escape cancels)
	 *
	 * @param {HTMLElement} button
	 */
	rename_inline(button) {
		const id = parseInt(button.dataset.id, 10);
		const layer = config.layers.find((item) => item.id == id);
		if (!layer || layer.locked === true) {
			this.Layer_rename.rename(id);
			return;
		}
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'layer_rename_input';
		input.value = layer.name;
		input.maxLength = 100;
		input.setAttribute('aria-label', 'Rename');
		button.style.display = 'none';
		button.parentNode.insertBefore(input, button);
		input.focus();
		input.select();

		let done = false;
		const finish = (save) => {
			if (done) {
				return;
			}
			done = true;
			const validation = validate_layer_name(input.value.trim());
			input.remove();
			button.style.display = '';
			if (save && validation.valid && validation.sanitized != layer.name) {
				app.State.do_action(
					new app.Actions.Bundle_action('rename_layer', 'Rename Layer', [
						new app.Actions.Refresh_layers_gui_action('undo'),
						new app.Actions.Update_layer_action(id, {name: validation.sanitized}),
						new app.Actions.Refresh_layers_gui_action('do')
					])
				);
			}
		};
		input.addEventListener('keydown', (event) => {
			event.stopPropagation();
			if (event.key == 'Enter') {
				finish(true);
			}
			else if (event.key == 'Escape') {
				finish(false);
			}
		});
		input.addEventListener('blur', () => finish(true));
	}

	/**
	 * shows only the layer (or all layers when it is already the only visible one)
	 *
	 * @param {string|number} id
	 */
	solo_layer(id) {
		id = parseInt(id, 10);
		const others = config.layers.filter((layer) => layer.id != id);
		const target = config.layers.find((layer) => layer.id == id);
		if (!target) {
			return;
		}
		const only = target.visible == true && others.every((layer) => layer.visible != true);
		const actions = [];
		config.layers.forEach((layer) => {
			const wanted = only ? true : layer.id == id;
			if ((layer.visible == true) != wanted) {
				actions.push(new app.Actions.Toggle_layer_visibility_action(layer.id));
			}
		});
		if (actions.length > 0) {
			return app.State.do_action(new app.Actions.Bundle_action('solo_layer', 'Layer Visibility', actions));
		}
	}

	/**
	 * shows blend mode and opacity of the selected layer in the panel header
	 */
	sync_layer_props() {
		const select = document.getElementById('layer_blend');
		const opacity = document.getElementById('layer_opacity');
		if (!select || !opacity) {
			return;
		}
		const search = document.getElementById('layer_search');
		if (search) {
			search.placeholder = t('Search layers');
		}
		const layer = config.layer;
		const fill = document.getElementById('layer_fill_opacity');
		select.disabled = opacity.disabled = !layer;
		if (fill) {
			fill.disabled = !layer;
		}
		if (!layer) {
			return;
		}
		const composition = layer.composition || 'source-over';
		const known = BLEND_MODES.some((mode) => mode[0] == composition);
		select.value = known ? composition : '';
		if (!known) {
			select.selectedIndex = -1;
		}
		if (document.activeElement !== opacity) {
			opacity.value = layer.opacity;
		}
		if (fill && document.activeElement !== fill) {
			fill.value = layer.fill_opacity === undefined ? 100 : layer.fill_opacity;
		}
	}

	/**
	 * renders layers list
	 */
	render_layers() {
		const target_id = 'layers';
		const layers = config.layers.concat().sort(
			//sort function
				(a, b) => b.order - a.order
			);

		document.getElementById(target_id).innerHTML = '';
		let html = '';

		if (config.layer) {
			//layers of a group get a header row and can be folded (not while searching, the matches must stay visible)
			const rows = this.layer_filter
				? layers.map((layer) => ({kind: 'layer', layer}))
				: panel_rows(layers, config.collapsed_groups || []);
			for (const row_index in rows) {
				const row = rows[row_index];
				if (row.kind == 'header') {
					const group_path = this.Helper.escapeHtml(row.group);
					const group_label = this.Helper.escapeHtml(row.label);
					const group_visible = row.members.some((member) => member.visible != false);
					const group_has_active = row.members.some((member) => member.id == config.layer.id);
					html += `<div class="item group_header${group_has_active ? ' has_active' : ''}" style="margin-left:${row.depth * 12}px">`;
					html += `	<button class="visibility group_visibility${group_visible ? ' visible' : ''}" data-group="${group_path}" title="${group_visible ? t('Hide Group') : t('Show Group')}"></button>`;
					html += `	<button class="group_toggle" data-group="${group_path}" aria-expanded="${row.collapsed ? 'false' : 'true'}" title="${t('Double click: Group Settings')}">`
						+ `<span class="chevron" aria-hidden="true">${row.collapsed ? '\u25B8' : '\u25BE'}</span> ${group_label} <small style="opacity:.65">(${row.members.length})</small>${
						 group_props_of(row.members[0], row.group).mask ? ` <span class="group_mask" title="${t('Group Mask')}" aria-label="${t('Group Mask')}">\u25D0</span>` : ''  }</button>`;
					html += '	<div class="clear"></div>';
					html += '</div>';
					continue;
				}
				const i = layers.indexOf(row.layer);
				const value = layers[i];
				if (this.layer_filter && String(value.name).toLowerCase().indexOf(this.layer_filter) < 0) {
					continue;
				}
				let class_extra = '';
				if(value.composition === 'source-atop'){
					class_extra += ' shorter';
				}
				if (value.id == config.layer.id){
					class_extra += ' active';
				}

				html += `<div class="item ${class_extra}"${  row.depth > 0 ? ` style="margin-left:${row.depth * 12}px"` : ''  }>`;
				if (value.visible == true)
					html += `	<button class="visibility visible trn" id="visibility" data-id="${value.id}" title="Hide"></button>`;
				else
					html += `	<button class="visibility trn" id="visibility" data-id="${value.id}" title="Show"></button>`;
				html += `	<button class="delete trn" id="delete" data-id="${value.id}" title="Delete"></button>`;

				if(value.composition === 'source-atop'){
					html += `	<button class="arrow_down" data-id="${value.id}" ></button>`;
				}

				const kind = value.type == null ? 'empty' : (value.type == 'adjustment' ? 'adjustment' : (is_vector_layer(value) ? 'vector' : 'raster'));
				const kind_title = {empty: t('Empty layer'), vector: t('Vector layer'), raster: t('Raster layer'), adjustment: t('Adjustment layer')}[kind];
				const kind_shapes = {
					//the first layer of a new document is empty: the first brush stroke, shape or text makes it vector
					empty: '<rect x="2.5" y="2.5" width="11" height="11" stroke-dasharray="2 2"/>',
					vector: '<path d="M3 13C3 7 7 3 13 3"/><rect x="1.5" y="11.5" width="3" height="3" fill="currentColor"/><rect x="11.5" y="1.5" width="3" height="3" fill="currentColor"/>',
					raster: '<path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11"/>',
					adjustment: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/>',
				};
				const kind_icon = `<svg class="layer_kind ${kind}" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${kind_title}"><title>${kind_title}</title>${kind_shapes[kind]}</svg>`;
				const linked = value.link_id != null;
				const layer_title = kind_icon + (value.locked === true ? '\uD83D\uDD12 ' : '')
					+ (linked ? `<span class="layer_link" title="${t('Linked layer')}" aria-label="${t('Linked layer')}">\uD83D\uDD17</span> ` : '')
					+ this.Helper.escapeHtml(value.name);

				const label = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'].indexOf(value.color_label) >= 0 ? value.color_label : '';
				html += `	<button class="layer_name" id="layer_name" draggable="${this.layer_filter ? 'false' : 'true'}" data-label="${label}" data-id="${value.id}"${value.id == config.layer.id ? ' aria-current="true"' : ''}>${layer_title}</button>`;
				html += '	<div class="clear"></div>';
				html += '</div>';

				//show filters
				if (layers[i].filters.length > 0 || layers[i].mask) {
					html += '<div class="filters">';
					if (layers[i].mask) {
						html += '<div class="filter">';
						html += `	<span class="delete" id="delete_mask" data-pid="${layers[i].id}" title="delete"></span>`;
						html += `	<span class="layer_name" id="mask_name" data-pid="${layers[i].id}" title="Disable / Enable Mask">`
							+ `<span class="trn">Layer Mask</span>${layers[i].mask_enabled === false ? ' (<span class="trn">off</span>)' : ''}</span>`;
						html += '	<div class="clear"></div>';
						html += '</div>';
					}
					for (const j in layers[i].filters) {
						const filter = layers[i].filters[j];
						let title = this.Helper.escapeHtml(this.Helper.ucfirst(String(filter.name)));
						title = title.replace(/-/g, ' ');

						html += '<div class="filter">';
						html += `	<span class="delete" id="delete_filter" data-pid="${layers[i].id}" data-id="${filter.id}" title="delete"></span>`;
						html += `	<span class="layer_name" id="filter_name" data-pid="${layers[i].id}" data-id="${filter.id}" data-filter="${this.Helper.escapeHtml(String(filter.name))}">${title}</span>`;
						html += '	<div class="clear"></div>';
						html += '</div>';
					}
					html += '</div>';
				}
			}
		}

		this.sync_layer_props();

		//register
		document.getElementById(target_id).innerHTML = html;
		if (config.LANG != 'en') {
			this.Tools_translate.translate(config.LANG, document.getElementById(target_id));
		}
		//converting to raster makes sense for a vector layer and for the empty first layer (it becomes a transparent picture)
		const raster_button = document.getElementById('layer_raster');
		if (raster_button) {
			const layer = config.layer;
			//no layer yet (the start of the program): nothing to convert
			raster_button.disabled = !layer || layer.type == 'adjustment' || (is_vector_layer(layer) == false && layer.type != null);
		}
		if (app.GUI && app.GUI.GUI_tools) {
			app.GUI.GUI_tools.update_disabled_tools();
		}
	}
}

export default GUI_layers_class;
