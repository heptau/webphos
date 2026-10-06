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

	//view
	{key: ';', ctrl: true, title: 'Ctrl + ;', name: 'Show Guides', target: 'view/guides.toggle'},
	{key: [';', ':'], ctrl: true, shift: true, title: 'Shift + Ctrl + ;', name: 'Snap', target: 'view/guides.toggle_snap'},
	{key: '\'', ctrl: true, title: 'Ctrl + \'', name: 'Grid', target: 'view/grid.grid'},

	{key: '\\', ctrl: true, title: 'Ctrl + \\', name: 'Hide / Show All Panels', target: 'view/panels.toggle_all'},

	{key: 't', ctrl: true, title: 'Ctrl + T', name: 'Free Transform', target: 'edit/transform.free_transform'},

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
	{key: '[', title: '[', name: 'Decrease brush size', target: 'tools/brush_size.decrease'},
	{key: ']', title: ']', name: 'Increase brush size', target: 'tools/brush_size.increase'},
];

export default shortcutsDefinition;
