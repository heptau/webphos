/**
 * Helpers for drawing histograms.
 */

/**
 * Height scale of a histogram: the highest bar, but single extreme bars (pure black or white
 * pixels in screenshots) do not flatten the rest - the top 1 % of the values is ignored when it
 * is much higher than the other values.
 *
 * @param {ArrayLike<number>[]} channels histograms of 256 values
 * @returns {number} value that is drawn at full height (0 when all histograms are empty)
 */
export function histogram_scale(channels) {
	const values = [];
	let maximum = 0;
	for (let c = 0; c < channels.length; c++) {
		for (let i = 0; i < channels[c].length; i++) {
			values.push(channels[c][i]);
			if (channels[c][i] > maximum) {
				maximum = channels[c][i];
			}
		}
	}
	if (maximum == 0) {
		return 0;
	}
	values.sort((a, b) => a - b);
	const robust = values[Math.floor(values.length * 0.99)] || maximum;
	//clip only strong outliers
	return maximum > robust * 4 ? Math.max(robust * 2, 1) : maximum;
}
