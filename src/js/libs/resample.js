/**
 * Resampling modes of Image > Resize that the browser canvas does itself (the others are Lanczos and Hermite).
 */

export const CANVAS_RESAMPLE_MODES = ['Bicubic', 'Bilinear', 'Nearest Neighbor', 'Basic'];

/**
 * @param {string} mode
 * @returns {{enabled: boolean, quality: 'low'|'medium'|'high'}} canvas smoothing settings for the mode
 */
export function smoothing_for_mode(mode) {
	switch (mode) {
		case 'Nearest Neighbor':
			//hard pixels - for pixel art and screenshots
			return {enabled: false, quality: 'low'};
		case 'Bilinear':
			return {enabled: true, quality: 'low'};
		case 'Bicubic':
			return {enabled: true, quality: 'high'};
		default:
			return {enabled: true, quality: 'medium'};
	}
}
