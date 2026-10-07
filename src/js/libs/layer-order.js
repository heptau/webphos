/**
 * Order of layers: the steps that reverse the stack with the "move up" action of the layer list.
 */

/**
 * @param {number[]} ids layer ids from the bottom layer to the top one
 * @returns {number[]} ids of the layers to move one place up, one after another (bubble sort), which turns the stack upside down
 */
export function reverse_steps(ids) {
	var list = ids.concat();
	var steps = [];
	for (var end = list.length - 1; end > 0; end--) {
		for (var i = 0; i < end; i++) {
			steps.push(list[i]);
			var swap = list[i];
			list[i] = list[i + 1];
			list[i + 1] = swap;
		}
	}
	return steps;
}

/**
 * Applies the steps to a list of ids (the same as the layer list does)
 *
 * @param {number[]} ids from the bottom to the top
 * @param {number[]} steps
 * @returns {number[]}
 */
export function apply_steps(ids, steps) {
	var list = ids.concat();
	steps.forEach(function (id) {
		var index = list.indexOf(id);
		if (index >= 0 && index < list.length - 1) {
			list[index] = list[index + 1];
			list[index + 1] = id;
		}
	});
	return list;
}
