/**
 * Find and replace in the text of a text layer. Text layers keep their text as lines of spans:
 * [[{text: "Hello ", meta: {...}}, {text: "world", meta: {...}}]] - the style (meta) of a span stays.
 */

function escape_pattern(text) {
	return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {{text: string, meta: object}[][]} data lines of spans
 * @param {string} find
 * @param {string} replacement
 * @param {boolean} [match_case]
 * @returns {{data: object[][], count: number}} a changed copy of the data and the number of replacements
 */
export function replace_in_text_data(data, find, replacement, match_case) {
	let count = 0;
	const pattern = new RegExp(escape_pattern(find), match_case ? 'g' : 'gi');
	const text = String(replacement == undefined ? '' : replacement);
	const result = data.map((line) => {
		return line.map((span) => {
			if (typeof span.text != 'string') {
				return span;
			}
			const changed = span.text.replace(pattern, () => {
				count++;
				return text;
			});
			return Object.assign({}, span, {text: changed});
		});
	});
	return {data: result, count};
}
