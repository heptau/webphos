/**
 * Photoshop-like keyboard shortcuts. "ctrl" means Ctrl on Windows/Linux and Cmd on macOS.
 * Target format is the same as in config-menu.js: "module.function".
 *
 * Single letter shortcuts without modifiers are registered directly by their modules.
 */
const shortcutsDefinition = [
	//app
	{key: ',', ctrl: true, title: 'Ctrl + ,', name: 'Settings', target: 'tools/settings.settings'},

	{key: 'w', ctrl: true, shift: true, alt: true, title: 'Alt + Shift + Ctrl + W', name: 'Quick Export', target: 'file/save.quick_export'},

	//edit
	{key: 'Backspace', alt: true, title: 'Alt + Backspace', name: 'Fill with Foreground Color', target: 'edit/fill.fill'},

	{key: 'Backspace', ctrl: true, title: 'Ctrl + Backspace', name: 'Fill with Background Color', target: 'edit/fill.fill_background'},

	{key: 'v', ctrl: true, shift: true, title: 'Shift + Ctrl + V', name: 'Paste in Place', target: 'edit/paste_place.paste_in_place'},
	{key: 'v', ctrl: true, shift: true, alt: true, title: 'Alt + Shift + Ctrl + V', name: 'Paste Into', target: 'edit/paste_place.paste_into'},

	{key: 'g', ctrl: true, alt: true, title: 'Alt + Ctrl + G', name: 'Clipping Mask', target: 'layer/clipping.toggle'},

	//view
	{key: ';', ctrl: true, title: 'Ctrl + ;', name: 'Show Guides', target: 'view/guides.toggle'},
	{key: [';', ':'], ctrl: true, shift: true, title: 'Shift + Ctrl + ;', name: 'Snap', target: 'view/guides.toggle_snap'},
	{key: '\'', ctrl: true, title: 'Ctrl + \'', name: 'Grid', target: 'view/grid.grid'},

	{key: '\\', ctrl: true, title: 'Ctrl + \\', name: 'Hide / Show All Panels', target: 'view/panels.toggle_all'},

	{key: 't', ctrl: true, title: 'Ctrl + T', name: 'Free Transform', target: 'edit/transform.free_transform'},
	{key: 't', ctrl: true, shift: true, title: 'Shift + Ctrl + T', name: 'Transform Again', target: 'edit/transform.transform_again'},

	{key: '0', ctrl: true, alt: true, title: 'Alt + Ctrl + 0', name: 'Zoom to Selection', target: 'view/zoom.to_selection'},
	{key: 'r', ctrl: true, alt: true, shift: true, title: 'Alt + Shift + Ctrl + R', name: 'Repeat Last Command', target: 'edit/repeat.repeat_last'},

	{key: 'e', ctrl: true, alt: true, shift: true, title: 'Alt + Shift + Ctrl + E', name: 'Stamp Visible', target: 'layer/stamp.stamp_visible'},
	{key: 'd', ctrl: true, alt: true, title: 'Alt + Ctrl + D', name: 'Describe Document', target: 'help/describe.describe'},
	{key: 'F6', title: 'F6', name: 'Colors', target: 'view/panels.toggle', parameter: 'colors'},
	{key: 'F7', title: 'F7', name: 'Layers', target: 'view/panels.toggle', parameter: 'layers'},
	{key: 'F8', title: 'F8', name: 'Histogram', target: 'view/panels.toggle', parameter: 'histogram'},

	//select
	{key: 'd', ctrl: true, title: 'Ctrl + D', name: 'Deselect', target: 'edit/selection.deselect'},
	{key: 'd', ctrl: true, shift: true, title: 'Shift + Ctrl + D', name: 'Reselect', target: 'edit/selection.reselect'},

	//image
	{key: 'i', ctrl: true, shift: true, title: 'Shift + Ctrl + I', name: 'Inverse selection', target: 'edit/selection.invert'},
	{key: 'f', ctrl: true, shift: true, title: 'Shift + Ctrl + F', name: 'Fade', target: 'image/adjustments.fade'},
	{key: 'l', ctrl: true, title: 'Ctrl + L', name: 'Levels', target: 'image/adjustments.levels'},
	{key: 'u', ctrl: true, title: 'Ctrl + U', name: 'Hue/Saturation', target: 'image/adjustments.hue_saturation'},
	{key: 'l', ctrl: true, shift: true, title: 'Shift + Ctrl + L', name: 'Auto Contrast', target: 'image/adjustments.auto_contrast'},
	{key: 'b', ctrl: true, title: 'Ctrl + B', name: 'Color Balance', target: 'image/adjustments.color_balance'},
	{key: 'b', ctrl: true, shift: true, title: 'Shift + Ctrl + B', name: 'Auto Color', target: 'image/adjustments.auto_color'},
	{key: 'm', ctrl: true, title: 'Ctrl + M', name: 'Curves', target: 'image/adjustments.curves'},
	{key: 'i', ctrl: true, title: 'Ctrl + I', name: 'Invert', target: 'image/adjustments.invert'},
	{key: 'u', ctrl: true, shift: true, title: 'Shift + Ctrl + U', name: 'Desaturate', target: 'image/adjustments.desaturate'},

	{key: 'q', ctrl: true, shift: true, title: 'Shift + Ctrl + Q', name: 'Quick Edit', target: 'image/quick_edit.quick_edit'},

	{key: 'f', ctrl: true, alt: true, title: 'Alt + Ctrl + F', name: 'Repeat Last Adjustment', target: 'image/adjustments.repeat_last'},

	//layer
	{key: 'n', ctrl: true, shift: true, title: 'Shift + Ctrl + N', name: 'New layer', target: 'layer/new.new'},
	{key: 'j', ctrl: true, title: 'Ctrl + J', name: 'Layer via Copy', target: 'layer/duplicate.via_copy'},
	{key: 'j', ctrl: true, shift: true, title: 'Shift + Ctrl + J', name: 'Layer via Cut', target: 'layer/new.new_selection', parameter: 'cut'},
	{key: 'e', ctrl: true, title: 'Ctrl + E', name: 'Merge Down', target: 'layer/merge.merge'},
	{key: 'e', ctrl: true, shift: true, title: 'Shift + Ctrl + E', name: 'Flatten Image', target: 'layer/flatten.flatten'},

	//view
	{key: ['=', '+'], ctrl: true, shift: 'any', title: 'Ctrl + +', name: 'Zoom In', target: 'view/zoom.in'},
	{key: ['-', '_'], ctrl: true, shift: 'any', title: 'Ctrl + -', name: 'Zoom Out', target: 'view/zoom.out'},
	{key: '0', ctrl: true, title: 'Ctrl + 0', name: 'Fit Window', target: 'view/zoom.auto'},
	{key: '1', ctrl: true, title: 'Ctrl + 1', name: 'Original Size', target: 'view/zoom.original'},
	{key: '\'', ctrl: true, title: 'Ctrl + \'', name: 'Grid on/off', target: 'view/grid.grid'},

	//tools
	{key: '[', title: '[', name: 'Decrease brush size', target: 'tools/brush_size.decrease', group: 'Tools'},
	{key: ']', title: ']', name: 'Increase brush size', target: 'tools/brush_size.increase', group: 'Tools'},
];

export default shortcutsDefinition;

/**
 * Menu shortcuts that are written in config-menu.js but are meant otherwise now: the plain letters belong to the tools
 * (as in Photoshop), the commands got a combination with a modifier or none. Key = the text in the menu.
 */
export const REPLACED_MENU_SHORTCUTS = {
	'O': 'Mod+O', //Open
	'S': 'Mod+S', //Export
	'Shift + S': 'Mod+Shift+S', //Save As
	'I': 'Mod+Alt+Shift+I', //Information
	'R': 'Mod+Alt+I', //Resize (Image Size in Photoshop)
	'T': '', //Trim
	'L': '', //90° counter clockwise
	'F': '', //Auto adjust colors
	'D': '', //Duplicate layer (Ctrl+J is Layer via Copy)
	'G': '', //Grid (Ctrl+' )
	'Ctrl+R': 'Mod+Alt+R', //Rulers: Cmd+R / Ctrl+R reloads the page in the browser (the picture would be lost)
	'Alt+Ctrl+G': '', //Create Clipping Mask (Clipping Mask below is the same command as a switch)
};

/**
 * Menu commands that are handled by the keyboard code of the browser or of the tools themselves (the clipboard needs
 * a real Ctrl+C / Ctrl+V, Delete belongs to the tool that has something to delete): the editor shows them, but they
 * can not be changed.
 */
export const FIXED_COMMANDS = [
	'edit/copy.cut', 'edit/copy.copy_to_clipboard', 'edit/copy.copy_to_clipboard|"merged"', 'edit/paste.paste', 'edit/selection.delete',
];

/**
 * Commands that are not in the menu (or have no shortcut there): the tools, the colors and a few more. Plain letters are
 * for the tools and the colors, everything else has a modifier. `tool` activates a tool, `target` runs a command.
 * Ctrl+N, Ctrl+W and Ctrl+T are taken by the browser (they can not be used in a tab), so New and Close use Alt as well.
 */
export const EXTRA_SHORTCUTS = [
	//tools (the letters of Photoshop; Shift cycles to the next tool of the same key there, here it is the second tool)
	{id: 'tool:select', group: 'Tools', name: 'Move', tool: 'select', spec: 'V'},
	{id: 'tool:selection', group: 'Tools', name: 'Rectangular Marquee', tool: 'selection', spec: 'M'},
	{id: 'tool:lasso', group: 'Tools', name: 'Lasso', tool: 'lasso', spec: 'L'},
	{id: 'tool:magic_wand', group: 'Tools', name: 'Magic Wand', tool: 'magic_wand', spec: 'W'},
	{id: 'tool:quick_select', group: 'Tools', name: 'Quick Selection', tool: 'quick_select', spec: 'Shift+W'},
	{id: 'tool:crop', group: 'Tools', name: 'Crop', tool: 'crop', spec: 'C'},
	{id: 'tool:pick_color', group: 'Tools', name: 'Eyedropper', tool: 'pick_color', spec: 'I'},
	{id: 'tool:measure', group: 'Tools', name: 'Ruler', tool: 'measure', spec: 'Shift+I'},
	{id: 'tool:heal', group: 'Tools', name: 'Healing Brush', tool: 'heal', spec: 'J'},
	{id: 'tool:patch', group: 'Tools', name: 'Patch', tool: 'patch', spec: 'Shift+J'},
	{id: 'tool:red_eye', group: 'Tools', name: 'Red Eye', tool: 'red_eye', spec: ''},
	{id: 'tool:clone', group: 'Tools', name: 'Clone Stamp', tool: 'clone', spec: 'S'},
	{id: 'tool:history_brush', group: 'Tools', name: 'History Brush', tool: 'history_brush', spec: 'Y'},
	{id: 'tool:brush', group: 'Tools', name: 'Brush', tool: 'brush', spec: 'B'},
	{id: 'tool:pencil', group: 'Tools', name: 'Pencil', tool: 'pencil', spec: 'Shift+B'},
	{id: 'tool:erase', group: 'Tools', name: 'Eraser', tool: 'erase', spec: 'E'},
	{id: 'tool:magic_erase', group: 'Tools', name: 'Magic Eraser', tool: 'magic_erase', spec: 'Shift+E'},
	{id: 'tool:background_eraser', group: 'Tools', name: 'Background Eraser', tool: 'background_eraser', spec: ''},
	{id: 'tool:gradient', group: 'Tools', name: 'Gradient', tool: 'gradient', spec: 'G'},
	{id: 'tool:fill', group: 'Tools', name: 'Paint Bucket', tool: 'fill', spec: 'K'},
	{id: 'tool:blur', group: 'Tools', name: 'Blur', tool: 'blur', spec: 'R'},
	{id: 'tool:sharpen', group: 'Tools', name: 'Sharpen', tool: 'sharpen', spec: 'Shift+R'},
	{id: 'tool:smudge', group: 'Tools', name: 'Smudge', tool: 'smudge', spec: ''},
	{id: 'tool:dodge_burn', group: 'Tools', name: 'Dodge / Burn', tool: 'dodge_burn', spec: 'O'},
	{id: 'tool:sponge', group: 'Tools', name: 'Sponge', tool: 'sponge', spec: 'Shift+O'},
	{id: 'tool:liquify', group: 'Tools', name: 'Liquify', tool: 'liquify', spec: ''},
	{id: 'tool:bulge_pinch', group: 'Tools', name: 'Bulge / Pinch', tool: 'bulge_pinch', spec: ''},
	{id: 'tool:text', group: 'Tools', name: 'Type', tool: 'text', spec: 'T'},
	{id: 'tool:shape', group: 'Tools', name: 'Shapes', tool: 'shape', spec: 'U'},
	{id: 'tool:pen', group: 'Tools', name: 'Pen', tool: 'pen', spec: 'P'},
	{id: 'tool:hand', group: 'Tools', name: 'Hand', tool: 'hand', spec: 'H'},
	{id: 'tool:zoom', group: 'Tools', name: 'Zoom', tool: 'zoom', spec: 'Z'},
	{id: 'tool:animation', group: 'Tools', name: 'Animation', tool: 'animation', spec: ''},

	//colors
	{id: 'tools/colors.swap', group: 'Tools', name: 'Swap Colors', target: 'tools/colors.swap', spec: 'X'},
	{id: 'tools/colors.reset', group: 'Tools', name: 'Default Colors', target: 'tools/colors.reset', spec: 'D'},

	//file and edit
	{id: 'file/new.new', group: 'File', name: 'New', target: 'file/new.new', spec: 'Mod+Alt+N'},
	{id: 'view/documents.close_active', group: 'File', name: 'Close Document', target: 'view/documents.close_active', spec: 'Mod+Alt+W'},
	{id: 'tools/search.search|f', group: 'Other', name: 'Search (alternative)', target: 'tools/search.search', spec: 'Mod+F'},
	{id: 'tools/search.search|k', group: 'Other', name: 'Search (second alternative)', target: 'tools/search.search', spec: 'Mod+K'},
	{id: 'edit/redo.redo|alternative', group: 'Edit', name: 'Redo (alternative)', target: 'edit/redo.redo', spec: 'Mod+Shift+Z'},

	//layer
	{id: 'layer/group.set_group', group: 'Layer', name: 'Set Group', target: 'layer/group.set_group', spec: 'Mod+G'},
	{id: 'layer/group.clear_group', group: 'Layer', name: 'Clear Group', target: 'layer/group.clear_group', spec: 'Mod+Shift+G'},
	{id: 'layer/move.up', group: 'Layer', name: 'Move Layer Up', target: 'layer/move.up', spec: 'Mod+]'},
	{id: 'layer/move.down', group: 'Layer', name: 'Move Layer Down', target: 'layer/move.down', spec: 'Mod+['},
	{id: 'layer/visibility.toggle', group: 'Layer', name: 'Show / Hide Layer', target: 'layer/visibility.toggle', spec: ''},
];
