import config from './../../config.js';
import { t } from '../tools/translate.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';

//color matrices (row-major 3x3) that simulate color vision deficiencies, Machado et al. 2009, severity 1.0
const MATRICES = {
	protanopia: '0.152286 1.052583 -0.204868  0.114503 0.786281 0.099216  -0.003882 -0.048116 1.051998',
	deuteranopia: '0.367322 0.860646 -0.227968  0.280085 0.672501 0.047413  -0.011820 0.042940 0.968881',
	tritanopia: '1.255528 -0.076749 -0.178779  -0.078411 0.930809 0.147602  0.004733 0.691367 0.303900',
	achromatopsia: '0.299 0.587 0.114  0.299 0.587 0.114  0.299 0.587 0.114',
};

/**
 * View > Proof Colors - shows how the picture looks to people with color vision deficiency.
 * Only the view changes (a CSS filter on the canvas), the image and exports stay untouched.
 */
class View_proof_class {

	constructor() {
		this.current = null;
	}

	/**
	 * @param {string} name protanopia, deuteranopia, tritanopia, achromatopsia or "none"
	 */
	proof(name) {
		var canvas = document.getElementById('canvas_minipaint');
		var holder = document.getElementById('proof_filters');
		if (!holder) {
			holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			holder.setAttribute('id', 'proof_filters');
			holder.setAttribute('width', '0');
			holder.setAttribute('height', '0');
			holder.setAttribute('aria-hidden', 'true');
			holder.style.position = 'absolute';
			Object.keys(MATRICES).forEach((key) => {
				var filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
				filter.setAttribute('id', 'proof_' + key);
				filter.setAttribute('color-interpolation-filters', 'linearRGB');
				var matrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
				var v = MATRICES[key].split(/\s+/);
				matrix.setAttribute('type', 'matrix');
				matrix.setAttribute('values', [v[0], v[1], v[2], 0, 0, v[3], v[4], v[5], 0, 0, v[6], v[7], v[8], 0, 0, 0, 0, 0, 1, 0].join(' '));
				filter.appendChild(matrix);
				holder.appendChild(filter);
			});
			document.body.appendChild(holder);
		}
		if (name == 'none' || MATRICES[name] == undefined || name == this.current) {
			canvas.style.filter = '';
			this.current = null;
			config.proof = null;
			return;
		}
		canvas.style.filter = 'url(#proof_' + name + ')';
		this.current = name;
		config.proof = name;
		alertify.message(t('Proof colors is on - it only changes the view. Choose it again to turn it off.'), 4);
	}
}

export default View_proof_class;
