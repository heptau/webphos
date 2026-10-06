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
	var count = 0;
	var pattern = new RegExp(escape_pattern(find), match_case ? 'g' : 'gi');
	var text = String(replacement == undefined ? '' : replacement);
	var result = data.map(function (line) {
		return line.map(function (span) {
			if (typeof span.text != 'string') {
				return span;
			}
			var changed = span.text.replace(pattern, function () {
				count++;
				return text;
			});
			return Object.assign({}, span, {text: changed});
		});
	});
	return {data: result, count: count};
}
