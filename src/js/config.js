//main config file

var config = {};

config.TRANSPARENCY = false;
config.TRANSPARENCY_TYPE = 'squares'; //squares, green, grey
config.LANG = 'en';
config.WIDTH = null;
config.HEIGHT = null;
config.visible_width = null;
config.visible_height = null;
config.COLOR = '#008000';
config.COLOR_BG = '#ffffff';
config.ALPHA = 255;
config.UNITS = null; //unit of the document size (see libs/units.js), null = the default from Settings
config.RESOLUTION = null; //dpi of the document, null = the default resolution from Settings
config.ZOOM = 1;
config.SNAP = true;
// API keys should be configured via environment variables or a separate config file
// For security, these are not hardcoded. Set them via:
// window.Google_Webfonts_API_Key = 'your-key-here';
config.safe_search_can_be_disabled = true;
config.google_webfonts_key = (typeof window !== 'undefined' && window.Google_Webfonts_API_Key) || '';
config.layers = [];
config.layer = null;
config.need_render = false;
config.need_render_changed_params = false; // Set specifically when param change in layer details triggered render
config.mouse = {};
config.mouse_lock = null;
config.swatches = {
	default: [] // Only default used right now, object format for swatch swapping in future.
};
config.user_fonts = {};
config.guides_enabled = true;
config.guides = [];
config.freeze_render = false; //true while the history is replayed
config.compare = null; //View > Split Compare: {before: canvas, x}
config.ruler_active = false;
config.enable_autoresize_by_default = true;

//requires styles in reset.css
config.themes = [
	'dark',
	'light',
	'green',
	'contrast',
];

//no-translate BEGIN
config.FONTS = [
	"Arial",
	"Courier",
	"Impact",
	"Helvetica",
	"Monospace",
	"Tahoma",
	"Times New Roman",
	"Verdana",
	"Amatic SC",
	"Arimo",
	"Codystar",
	"Creepster",
	"Indie Flower",
	"Lato",
	"Lora",
	"Merriweather",
	"Monoton",
	"Montserrat",
	"Mukta",
	"Muli",
	"Nosifer",
	"Nunito",
	"Oswald",
	"Orbitron",
	"Pacifico",
	"PT Sans",
	"PT Serif",
	"Playfair Display",
	"Poppins",
	"Raleway",
	"Roboto",
	"Rubik",
	"Special Elite",
	"Tangerine",
	"Titillium Web",
	"Ubuntu"
];
//no-translate END

config.TOOLS = [
	{
		name: 'select',
		title: 'Select object tool',
		attributes: {
			auto_select: true,
		},
	},
	{
		name: 'selection',
		attributes: {
			shape: {
				value: 'Rectangle',
				values: ['Rectangle', 'Ellipse'],
			},
		},
		on_leave: 'on_leave',
		keep_selection: true,
	},
	{
		name: 'lasso',
		title: 'Lasso (Shift: add, Alt: subtract)',
		attributes: {
			polygonal: false,
			feather: {
				value: 0,
				min: 0,
				max: 100,
			},
		},
		on_leave: 'on_leave',
		keep_selection: true,
	},
	{
		name: 'magic_wand',
		title: 'Magic Wand (Shift: add, Alt: subtract)',
		attributes: {
			tolerance: {
				value: 32,
				min: 0,
				max: 255,
			},
			contiguous: true,
			feather: {
				value: 0,
				min: 0,
				max: 100,
			},
		},
		on_leave: 'on_leave',
		keep_selection: true,
	},
	{
		name: 'quick_select',
		title: 'Quick Selection (paint over the object, Alt: subtract)',
		attributes: {
			size: 40,
			tolerance: {
				value: 25,
				min: 1,
				max: 100,
			},
			feather: {
				value: 0,
				min: 0,
				max: 100,
			},
		},
		on_leave: 'on_leave',
		keep_selection: true,
	},
	{
		name: 'quick_mask',
		title: 'Quick Mask (paint selection, Q)',
		attributes: {
			size: {
				value: 30,
				min: 1,
				max: 500,
			},
			softness: {
				value: 0,
				min: 0,
				max: 100,
			},
			subtract: false,
			target: {
				value: 'Selection',
				values: ['Selection', 'Layer mask'],
			},
		},
		on_leave: 'on_leave',
		keep_selection: true,
	},
	{
		name: 'brush',
		attributes: {
			size: 4,
			pressure: false,
		},
	},
	{
		name: 'pencil',
		attributes: {
			size: 1,
			pressure: false,
		},
	},
	{
		name: 'pick_color',
		attributes: {
			global: false,
			sample: {
				value: 'Point',
				values: ['Point', '3x3', '5x5', '11x11', '31x31'],
			},
		},
	},
	{
		name: 'erase',
		on_update: 'on_params_update',
		attributes: {
			size: 30,
			circle: true,
			strict: true,
		},
	},
	{
		name: 'magic_erase',
		title: 'Magic Eraser Tool',
		attributes: {
			power: 15,
			anti_aliasing: true,
			contiguous: false,
		},
	},
	{
		name: 'fill',
		attributes: {
			power: 5,
			anti_aliasing: false,
			contiguous: false,
		},
	},
	{
		name: 'shape',
		on_activate: 'on_activate',
		title: 'Shapes (H)',
		attributes: {
			size: 3,
			stroke: '#00aa00',
		},
	},
	{
		name: 'line',
		visible: false,
		attributes: {
			size: 4,
		},
	},
	{
		name: 'arrow',
		visible: false,
		attributes: {
			size: 4,
		},
	},
	{
		name: 'rectangle',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
			radius: {
				value: 0,
				min: 0,
			},
			square: false,
		},
	},
	{
		name: 'ellipse',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
			circle: false,
		},
	},
	{
		name: 'triangle',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'right_triangle',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'romb',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'parallelogram',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'trapezoid',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'plus',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'pentagon',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'hexagon',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'star',
		visible: false,
		attributes: {
			border_size: 4,
			corners: 5,
			inner_radius: 40,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'heart',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'cylinder',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'human',
		visible: false,
		attributes: {
			border_size: 4,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'tear',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'cog',
		visible: false,
		attributes: {
			fill_color: '#555555',
		},
	},
	{
		name: 'bezier_curve',
		visible: false,
		attributes: {
			size: 4,
		},
	},
	{
		name: 'moon',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'callout',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
	{
		name: 'text',
		on_update: 'on_params_update',
		on_activate: 'on_activate',
		attributes: {
			font: {
				value: 'Arial',
				values() {
					const user_font_names = Object.keys(config.user_fonts);
					return ['', '[Add Font...]', ...Array.from(new Set([...config.FONTS, ...user_font_names].sort()))];
				}
			},
			size: 40,
			bold: {
				value: false,
				icon: `bold.svg`
			},
			italic: {
				value: false,
				icon: `italic.svg`
			},
			underline: {
				value: false,
				icon: `underline.svg`
			},
			strikethrough: {
				value: false,
				icon: `strikethrough.svg`
			},
			fill: '#008800',
			stroke: '#000000',
			stroke_size: {
				value: 0,
				min: 0,
				step: 0.1
			},
			kerning: {
				value: 0,
				min: -999,
				max: 999,
				step: 1
			},
			leading: {
				value: 0,
				min: -999,
				max: 999,
				step: 1
			}
		},
	},
	{
		name: 'gradient',
		attributes: {
			color_1: '#008000',
			color_2: '#ffffff',
			alpha: 0,
			radial: false,
			radial_power: 50,
		},
	},
	{
		name: 'clone',
		attributes: {
			size: 30,
			anti_aliasing: true,
			source_layer: {
				value: 'Current',
				values: ['Current', 'Previous'],
			},
		},
	},
	{
		name: 'crop',
		on_update: 'on_params_update',
		on_leave: 'on_leave',
		attributes: {
			crop: true,
		},
	},
	{
		name: 'blur',
		attributes: {
			size: 30,
			strength: 1,
		},
	},
	{
		name: 'sharpen',
		attributes: {
			size: 30,
		},
	},
	{
		name: 'desaturate',
		attributes: {
			size: 50,
			anti_aliasing: true,
		},
	},
	{
		name: 'smudge',
		title: 'Smudge Tool',
		attributes: {
			size: 40,
			strength: {
				value: 50,
				min: 1,
				max: 100,
			},
			anti_aliasing: true,
		},
	},
	{
		name: 'dodge_burn',
		title: 'Dodge/Burn Tool',
		attributes: {
			size: 50,
			exposure: {
				value: 15,
				min: 1,
				max: 100,
			},
			burn: false,
			anti_aliasing: true,
		},
	},
	{
		name: 'bulge_pinch',
		title: 'Bulge/Pinch Tool',
		attributes: {
			radius: 80,
			power: 50,
			bulge: true,
		},
	},
	{
		name: 'heal',
		title: 'Healing Brush (paint over a blemish)',
		attributes: {
			size: 30,
			match_color: true,
		},
	},
	{
		name: 'red_eye',
		title: 'Red Eye (click on the eye)',
		attributes: {
			size: 40,
			strength: {
				value: 100,
				min: 10,
				max: 100,
			},
		},
	},
	{
		name: 'background_eraser',
		title: 'Background Eraser (erases the color under the pointer)',
		attributes: {
			size: 40,
			tolerance: {
				value: 30,
				min: 1,
				max: 100,
			},
		},
	},
	{
		name: 'liquify',
		title: 'Liquify (push pixels)',
		attributes: {
			size: 80,
			strength: {
				value: 50,
				min: 1,
				max: 100,
			},
		},
	},
	{
		name: 'measure',
		title: 'Measure (drag a line: size, length, angle)',
		on_leave: 'on_leave',
		attributes: {},
	},
	{
		name: 'hand',
		title: 'Hand (Space)',
		attributes: {},
	},
	{
		name: 'zoom',
		title: 'Zoom (click: in, Alt + click: out, Z)',
		attributes: {},
	},
	{
		name: 'animation',
		on_activate: 'on_activate',
		on_update: 'on_params_update',
		on_leave: 'on_leave',
		attributes: {
			play: false,
			delay: 400,
		},
	},
	{
		name: 'polygon',
		visible: false,
		attributes: {
			border_size: 4,
			border: true,
			fill: true,
			border_color: '#555555',
			fill_color: '#aaaaaa',
		},
	},
];

//link to active tool
config.TOOL = config.TOOLS[2];
	
export default config;