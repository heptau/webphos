import app from './../app.js';
import config from './../config.js';
import { Base_action } from './base.js';
import alertify from './../../../node_modules/alertifyjs/build/alertify.min.js';
import { t } from '../modules/tools/translate.js';

export class Activate_tool_action extends Base_action {
	/**
	 * Groups multiple actions together in the undo/redo history, runs them all at once.
	 */
	constructor(key, ignore_same_tool) {
		super('activate_tool', 'Activate Tool');
		this.ignore_same_tool = !!ignore_same_tool;
		this.key = key;
		this.old_key = null;
		this.tool_leave_actions = null;
		this.tool_activate_actions = null;
	}

	async do() {
		super.do();
		const key = this.key;
		this.old_key = app.GUI.GUI_tools.active_tool;

		if (this.key !== this.old_key || this.ignore_same_tool) {

			//reset last
			document.querySelector('#tools_container .' + this.old_key).classList.remove("active");

			//tools that share the selection (selection, lasso, magic wand, quick mask) do not reset it when switching between them
			var next_tool = config.TOOLS.find((tool) => tool.name == key);
			var keeps_selection = Boolean(config.TOOL.keep_selection && next_tool && next_tool.keep_selection);
			if (keeps_selection) {
				var old_object = app.GUI.GUI_tools.tools_modules[config.TOOL.name].object;
				if (typeof old_object.on_switch_keep_selection == 'function') {
					old_object.on_switch_keep_selection();
				}
			}

			//send exit event to old previous tool
			if (config.TOOL.on_leave != undefined && !keeps_selection) {
				var moduleKey = config.TOOL.name;
				var functionName = config.TOOL.on_leave;
				this.tool_leave_actions = app.GUI.GUI_tools.tools_modules[moduleKey].object[functionName]();
				if (this.tool_leave_actions) {
					for (let action of this.tool_leave_actions) {
						await action.do();
					}
				}
			}

			//change active
			app.GUI.GUI_tools.active_tool = key;
			document.querySelector('#tools_container .' + app.GUI.GUI_tools.active_tool)
				.classList.add("active");
			for (let i in config.TOOLS) {
				if (config.TOOLS[i].name == app.GUI.GUI_tools.active_tool) {
					config.TOOL = config.TOOLS[i];
				}
			}

			//check module
			if (app.GUI.GUI_tools.tools_modules[key] == undefined) {
				alertify.error(t('Tools class not found: ') + key);
				return;
			}

			//set default cursor
			const mainWrapper = document.getElementById('main_wrapper');
			const defaultCursor = ({text: 'text', hand: 'grab', zoom: 'zoom-in'})[config.TOOL && config.TOOL.name] || 'default';
			if (mainWrapper.style.cursor != defaultCursor) {
				mainWrapper.style.cursor = defaultCursor;
			}

			app.GUI.GUI_tools.show_action_attributes();
			app.GUI.GUI_tools.Helper.setCookie('active_tool', app.GUI.GUI_tools.active_tool);
		}

		//send activate event to new tool
		if (config.TOOL.on_activate != undefined) {
			var moduleKey = config.TOOL.name;
			var functionName = config.TOOL.on_activate;
			this.tool_activate_actions = app.GUI.GUI_tools.tools_modules[moduleKey].object[functionName]();
			if (this.tool_activate_actions) {
				for (let action of this.tool_activate_actions) {
					await action.do();
				}
			}
		}

		config.need_render = true;
	}

	async undo() {
		super.undo();

		// Undo activate actions
		if (this.tool_activate_actions) {
			for (let action of this.tool_activate_actions) {
				await action.undo();
				action.free();
			}
			this.tool_activate_actions = null;
		}

		//reset last
		document.querySelector('#tools_container .' + this.key)
			.classList.remove("active");

		//change active
		app.GUI.GUI_tools.active_tool = this.old_key;
		document.querySelector('#tools_container .' + app.GUI.GUI_tools.active_tool)
			.classList.add("active");
		for (let i in config.TOOLS) {
			if (config.TOOLS[i].name == app.GUI.GUI_tools.active_tool) {
				config.TOOL = config.TOOLS[i];
			}
		}

		app.GUI.GUI_tools.show_action_attributes();
		app.GUI.GUI_tools.Helper.setCookie('active_tool', app.GUI.GUI_tools.active_tool);

		//set default cursor
		const mainWrapper = document.getElementById('main_wrapper');
		const defaultCursor = ({text: 'text', hand: 'grab', zoom: 'zoom-in'})[config.TOOL && config.TOOL.name] || 'default';
		if (mainWrapper.style.cursor != defaultCursor) {
			mainWrapper.style.cursor = defaultCursor;
		}

		// Undo leave actions
		if (this.tool_leave_actions) {
			for (let action of this.tool_leave_actions) {
				await action.undo();
				action.free();
			}
			this.tool_leave_actions = null;
		}

		config.need_render = true;
	}

	free() {
		if (this.tool_activate_actions) {
			for (let action of this.tool_activate_actions) {
				action.free();
			}
			this.tool_activate_actions = null;
		}
		if (this.tool_leave_actions) {
			for (let action of this.tool_leave_actions) {
				action.free();
			}
			this.tool_leave_actions = null;
		}
	}
}