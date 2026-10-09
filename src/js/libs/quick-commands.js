/**
 * "Quick Edit" - simple edits written as words ("brighter, more contrast, black and white").
 * English and Czech phrases are understood. Everything runs locally, it is plain keyword matching.
 */
import * as Adjustments from './adjustments.js';
import * as Filters from './filters.js';

//the most specific rules first ("less contrast" before "contrast")
const RULES = [
	{re: /(auto ?contrast|autokontrast)/, steps: () => [{op: 'autoContrast'}]},
	{re: /(auto ?colou?r|autobarv)/, steps: () => [{op: 'autoColor'}]},
	{re: /(less|lower|reduce|decrease|mene|mensi|nizsi|snizit|sniz).*contrast|contrast.*(down|lower)|kontrast.*(mene|nizsi|mensi)/, steps: (m) => [{op: 'contrast', value: -20 * m}]},
	{re: /(more|higher|increase|boost|vice|vetsi|vyssi|zvys|zvysit).*contrast|contrast.*(up|higher)|kontrastnej|kontrast/, steps: (m) => [{op: 'contrast', value: 20 * m}]},
	{re: /(less|lower|reduce|decrease|muted|mene|potlac|sniz).*(saturat|syt|barev)|desaturate (a|slightly)/, steps: (m) => [{op: 'saturation', value: -25 * m}]},
	{re: /(blackwhite|b&w|grayscale|greyscale|monochrome|desaturate|cernobil|cernobil|sede)/, steps: () => [{op: 'desaturate'}]},
	{re: /(more|higher|increase|boost|vibrant|vice|vetsi|zvys|zivejs|barevnej).*(saturat|syt|barev)?|saturat|syt/, steps: (m) => [{op: 'saturation', value: 25 * m}]},
	{re: /(warmer|warm|teplej|tepleji)/, steps: (m) => [{op: 'temperature', value: 25 * m}]},
	{re: /(cooler|colder|cool|studen|chladn)/, steps: (m) => [{op: 'temperature', value: -25 * m}]},
	{re: /sepia/, steps: () => [{op: 'sepia'}]},
	{re: /(invert|negative|negativ)/, steps: () => [{op: 'invert'}]},
	{re: /(equali[sz]e|vyrovn)/, steps: () => [{op: 'equalize'}]},
	{re: /(sharpen|sharper|sharp|ostr|zostr|doostr)/, steps: (m) => [{op: 'sharpen', value: 80 * m}]},
	{re: /(darker|darken|dim|tmavs|tmav|ztmav)/, steps: (m) => [{op: 'brightness', value: -20 * m}]},
	{re: /(lighter|brighter|brighten|lighten|light|bright|svetlej|svetl|zesvetl|rozjasn)/, steps: (m) => [{op: 'brightness', value: 20 * m}]},
	{re: /(fix|enhance|improve|auto|vylepsi|oprav|zlepsi)/, steps: () => [{op: 'autoContrast'}, {op: 'autoColor'}]},
];

function normalize(text) {
	return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function magnitude(part) {
	if (/(a bit|slightly|little|trochu|mirne|malo|jemne)/.test(part)) {
		return 0.5;
	}
	if (/(very|much|a lot|strongly|hodne|velmi|moc|silne)/.test(part)) {
		return 2;
	}
	return 1;
}

/**
 * @param {string} text e.g. "a bit brighter, more contrast and warmer"
 * @returns {{steps: object[], unknown: string[]}} steps to apply and the parts that were not understood
 */
export function parse_commands(text) {
	//"black and white" must not be cut at "and"
	const cleaned = normalize(text).replace(/black\s*(?:and|&)\s*white/g, 'blackwhite');
	const parts = cleaned.split(/\s*(?:,|;|\+|\band\b|\bthen\b|\ba\b(?!\s+(?:bit|little|lot))|\bpak\b)\s*/).map((part) => part.trim()).filter((part) => part != '');
	let steps = [];
	const unknown = [];
	parts.forEach((part) => {
		const rule = RULES.find((item) => item.re.test(part));
		if (!rule) {
			unknown.push(part);
			return;
		}
		steps = steps.concat(rule.steps(magnitude(part)));
	});
	return {steps, unknown};
}

/**
 * @param {object} image ImageData-like object, changed in place
 * @param {object[]} steps result of parse_commands()
 * @returns {object} the image
 */
export function apply_steps(image, steps) {
	steps.forEach((step) => {
		switch (step.op) {
			case 'brightness':
				Adjustments.brightnessContrast(image, step.value, 0);
				break;
			case 'contrast':
				Adjustments.brightnessContrast(image, 0, step.value);
				break;
			case 'saturation':
				Adjustments.hueSaturation(image, {saturation: step.value});
				break;
			case 'temperature':
				Adjustments.temperatureTint(image, {temperature: step.value});
				break;
			case 'desaturate':
				Adjustments.desaturate(image);
				break;
			case 'sepia':
				Adjustments.sepia(image, 100);
				break;
			case 'invert':
				Adjustments.invert(image);
				break;
			case 'equalize':
				Adjustments.equalize(image);
				break;
			case 'autoContrast':
				Adjustments.autoContrast(image);
				break;
			case 'autoColor':
				Adjustments.autoColor(image);
				break;
			case 'sharpen':
				Filters.unsharpMask(image, {amount: step.value, radius: 2, threshold: 0});
				break;
		}
	});
	return image;
}

//ready-made combinations (Image > Recipes)
export const RECIPES = {
	portrait: 'a bit warmer, a bit brighter, a bit more saturation',
	product: 'auto contrast, auto color, sharpen',
	vintage: 'sepia, less contrast',
	drama: 'black and white, more contrast',
	thumbnail: 'more contrast, more saturation, sharpen',
};
