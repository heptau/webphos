/**
 * Helpers for the document tabs.
 */

/**
 * @param {string[]} names names of existing documents
 * @returns {string} "Untitled-1", "Untitled-2"... first name that is not used
 */
export function next_document_name(names) {
	let number = 1;
	while (names.includes(`Untitled-${  number}`)) {
		number++;
	}
	return `Untitled-${  number}`;
}

/**
 * index of the active document after one document was removed
 *
 * @param {number} count number of documents before removing
 * @param {number} active index of the active document
 * @param {number} removed index of the removed document
 * @returns {{active: number, switched: boolean}} switched = the active document was removed, a neighbour is shown
 */
export function remove_document_index(count, active, removed) {
	const remaining = count - 1;
	if (removed == active) {
		return {active: Math.min(removed, remaining - 1), switched: true};
	}
	return {active: removed < active ? active - 1 : active, switched: false};
}

/**
 * new position of the active document after a tab was dragged to another place
 *
 * @param {number} active index of the active document
 * @param {number} from index of the dragged tab
 * @param {number} to index where it was dropped
 * @returns {number} index of the active document after moving
 */
export function move_active_index(active, from, to) {
	if (active == from) {
		return to;
	}
	if (from < active && to >= active) {
		return active - 1;
	}
	if (from > active && to <= active) {
		return active + 1;
	}
	return active;
}
