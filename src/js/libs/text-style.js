/**
 * Changes of the style of a whole text layer. A text layer keeps its text as lines of spans
 * ([[{text, meta}]], see text-replace.js); the meta of a span holds only what differs from the defaults of the Text tool,
 * so the functions here take those defaults as an argument and never write a default value back. Pure functions, no DOM.
 */

function is_default(value, fallback) {
	return value === undefined || value === fallback;
}

function clean(meta, defaults) {
	const result = {};
	Object.keys(meta).forEach((key) => {
		if (meta[key] !== undefined && (!defaults || !is_default(meta[key], defaults[key]) || key === 'fill_color')) {
			result[key] = meta[key];
		}
	});
	return result;
}

/**
 * A range of the text: {start: {line, character}, end: {line, character}}, the character is a position in the line.
 * The ends may come in any order (a selection made backwards).
 *
 * @param {{start: {line: number, character: number}, end: {line: number, character: number}}} range
 * @returns {{first: {line: number, character: number}, last: {line: number, character: number}}}
 */
export function order_range(range) {
	const a = range.start;
	const b = range.end;
	const backwards = a.line > b.line || (a.line === b.line && a.character > b.character);
	return backwards ? {first: b, last: a} : {first: a, last: b};
}

export function is_empty_range(range) {
	const ordered = order_range(range);
	return ordered.first.line === ordered.last.line && ordered.first.character === ordered.last.character;
}

/**
 * Cuts the spans at the ends of the range and marks (inside: true) those that lie in it. Without a range everything is inside.
 */
function mark_range(data, range) {
	const ordered = range ? order_range(range) : null;
	return data.map((line, line_index) => {
		let from = 0;
		let to = Infinity;
		let outside = false;
		if (ordered) {
			outside = line_index < ordered.first.line || line_index > ordered.last.line;
			from = line_index === ordered.first.line ? ordered.first.character : 0;
			to = line_index === ordered.last.line ? ordered.last.character : Infinity;
		}
		const result = [];
		let position = 0;
		line.forEach((span) => {
			const text = String(span.text);
			const start = position;
			const end = position + text.length;
			position = end;
			const piece = function (a, b, inside) {
				if (b > a || (text === '' && a === 0)) {
					result.push({text: text.slice(a - start, b - start), meta: Object.assign({}, span.meta || {}), inside});
				}
			};
			if (outside || end <= from || start >= to) {
				piece(start, end, false);
			}
			else {
				const cut_from = Math.max(start, from);
				const cut_to = Math.min(end, to);
				piece(start, cut_from, false);
				piece(cut_from, cut_to, true);
				piece(cut_to, end, false);
			}
		});
		return result;
	});
}

function same_meta(a, b) {
	const keys = Object.keys(Object.assign({}, a, b)).sort();
	return keys.every((key) => { return a[key] === b[key]; });
}

/**
 * Takes the marks away and joins neighbouring spans with the same style (the cuts would pile up otherwise).
 */
function unmark(data) {
	return data.map((line) => {
		const result = [];
		line.forEach((span) => {
			const last = result[result.length - 1];
			const meta = clean(span.meta, null);
			if (last && same_meta(last.meta, meta)) {
				last.text += span.text;
			}
			else {
				result.push({text: span.text, meta});
			}
		});
		return result.filter((span, index) => {
			return span.text !== '' || (index === 0 && result.length === 1);
		});
	});
}

/**
 * @param {object[][]} data
 * @param {function(object, object): object} change gets a copy of a span inside the range and its meta, returns the new meta
 * @param {object} [range] only this part of the text; without it the whole text
 * @returns {object[][]} a changed copy
 */
function map_spans(data, change, range) {
	const marked = mark_range(data, range);
	marked.forEach((line) => {
		line.forEach((span) => {
			if (span.inside) {
				span.meta = change(span, span.meta);
			}
		});
	});
	return unmark(marked);
}

/**
 * Sets the given style on the spans of the range (or all).
 *
 * @param {object[][]} data
 * @param {object} changes for example {size: 24, bold: true, fill_color: '#ff0000'}
 * @param {object} defaults the default meta of the Text tool; a value equal to the default is not stored
 * @param {object} [range]
 * @returns {object[][]}
 */
export function apply_meta(data, changes, defaults, range) {
	return map_spans(data, (span, meta) => {
		Object.keys(changes).forEach((key) => {
			meta[key] = is_default(changes[key], defaults[key]) && key !== 'fill_color' ? undefined : changes[key];
		});
		return clean(meta, defaults);
	}, range);
}

/**
 * The style of the first span that has some text (the dialog shows it), with the defaults filled in.
 *
 * @param {object[][]} data
 * @param {object} defaults
 * @param {object} [range] the style of the beginning of this part
 * @returns {object}
 */
export function read_meta(data, defaults, range) {
	let found = null;
	let source = data || [];
	if (range && data) {
		source = mark_range(data, range).map((line) => {
			return line.filter((span) => { return span.inside; });
		});
	}
	source.forEach((line) => {
		line.forEach((span) => {
			if (found === null && String(span.text) !== '') {
				found = span.meta || {};
			}
		});
	});
	if (found === null && data && data[0] && data[0][0]) {
		found = data[0][0].meta || {};
	}
	return Object.assign({}, defaults, found || {});
}

/**
 * Turns a flag (bold, italic, underline, strikethrough) on for the text (or the range), or off when it is on everywhere already.
 *
 * @param {object[][]} data
 * @param {string} key
 * @param {object} defaults
 * @param {object} [range]
 * @returns {object[][]}
 */
export function toggle_flag(data, key, defaults, range) {
	let all = true;
	let any = false;
	mark_range(data, range).forEach((line) => {
		line.forEach((span) => {
			if (!span.inside || String(span.text) === '') {
				return;
			}
			any = true;
			if (!span.meta[key]) {
				all = false;
			}
		});
	});
	const change = {};
	change[key] = any && all ? false : true;
	return apply_meta(data, change, defaults, range);
}

function title_case(text) {
	return text.toLowerCase().replace(/(^|[\s\-_.,;:!?()"'“„])(\S)/g, (match, before, letter) => {
		return before + letter.toUpperCase();
	});
}

/**
 * @param {object[][]} data
 * @param {'upper'|'lower'|'title'} mode
 * @param {object} [range]
 * @returns {object[][]}
 */
export function change_case(data, mode, range) {
	return map_spans(data, (span, meta) => {
		const text = String(span.text);
		span.text = mode === 'upper' ? text.toUpperCase() : mode === 'lower' ? text.toLowerCase() : title_case(text);
		return meta;
	}, range);
}

/**
 * Replaces the text by another, the first span keeps its style (the rest of the spans disappears).
 *
 * @param {object[][]} data
 * @param {string} text lines are separated by \n
 * @returns {object[][]}
 */
export function replace_text(data, text) {
	const first = data && data[0] && data[0][0] && data[0][0].meta ? data[0][0].meta : {};
	return String(text).split('\n').map((line) => {
		return [{text: line, meta: Object.assign({}, first)}];
	});
}

export const LOREM_IPSUM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
