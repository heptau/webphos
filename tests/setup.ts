// Test setup file
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom has no TextEncoder / TextDecoder
Object.assign(globalThis, { TextEncoder, TextDecoder });

// Mock alertify
const mockAlertify = {
	success: jest.fn(),
	error: jest.fn(),
	alert: jest.fn(),
	confirm: jest.fn(),
	prompt: jest.fn(),
	log: jest.fn(),
	set: jest.fn(),
	reset: jest.fn(),
};

jest.mock('alertifyjs', () => mockAlertify);

// Make alertify globally available
(globalThis as any).alertify = mockAlertify;

// Mock config
jest.mock('../src/js/config.js', () => ({
	TRANSPARENCY: false,
	TRANSPARENCY_TYPE: 'squares',
	LANG: 'en',
	WIDTH: 800,
	HEIGHT: 600,
	ZOOM: 1,
	SNAP: true,
	google_webfonts_key: '',
	layers: [],
	layer: null,
	need_render: false,
	user_fonts: {},
	guides: [],
	COLOR: '#008000',
	ALPHA: 255,
}));

// Mock Helper_class
jest.mock('../src/js/libs/helpers.js', () => {
	return jest.fn().mockImplementation(() => ({
		escapeHtml: (text: string) => text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;'),
		getCookie: jest.fn(() => null),
		setCookie: jest.fn(),
		number_format: (n: number) => n.toString(),
		strpos: (haystack: string, needle: string) => haystack.indexOf(needle),
		is_input: () => false,
	}));
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: jest.fn().mockImplementation(query => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock sessionStorage
global.sessionStorage = localStorageMock as unknown as Storage;

// Mock fetch
global.fetch = jest.fn();

// Mock Image constructor
global.Image = class {
	src: string = '';
	width: number = 100;
	height: number = 100;
	onload: (() => void) | null = null;
	onerror: ((err: Error) => void) | null = null;
	crossOrigin: string = '';
	constructor() {
		setTimeout(() => {
			if (this.onload) this.onload();
		}, 0);
	}
} as any;

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
	fillRect: jest.fn(),
	clearRect: jest.fn(),
	drawImage: jest.fn(),
	getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
	putImageData: jest.fn(),
	createImageData: jest.fn(),
	setTransform: jest.fn(),
	resetTransform: jest.fn(),
	scale: jest.fn(),
	rotate: jest.fn(),
	translate: jest.fn(),
	transform: jest.fn(),
	beginPath: jest.fn(),
	moveTo: jest.fn(),
	lineTo: jest.fn(),
	arc: jest.fn(),
	fill: jest.fn(),
	stroke: jest.fn(),
	rect: jest.fn(),
	ellipse: jest.fn(),
	save: jest.fn(),
	restore: jest.fn(),
	fillStyle: '',
	strokeStyle: '',
	lineWidth: 1,
	font: '',
	textAlign: 'start',
	textBaseline: 'alphabetic',
	globalCompositeOperation: 'source-over',
	imageSmoothingEnabled: true,
	webkitImageSmoothingEnabled: true,
	msImageSmoothingEnabled: true,
	canvas: { width: 800, height: 600 },
});
