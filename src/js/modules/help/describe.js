import config from './../../config.js';
import { t } from '../tools/translate.js';

/**
 * Help > Describe Document - the state of the picture read aloud by screen readers (also shown as a message)
 */
class Help_describe_class {

	text() {
		const layer = config.layer;
		const visible = config.layers.filter((item) => item.visible).length;
		const parts = [
			`${t('Document')  } ${config.WIDTH} x ${config.HEIGHT} px`,
			`${config.layers.length  } ${t('layers')} (${visible} ${t('visible')})`,
			`${t('Active layer')  }: ${  layer ? layer.name : '-'}`,
			`${t('Tool')  }: ${  config.TOOL ? config.TOOL.name.replace(/_/g, ' ') : '-'}`,
			`${t('Zoom')  }: ${Math.round(config.ZOOM * 100)} %`,
		];
		return `${parts.join('. ')  }.`;
	}

	describe() {
		let region = document.getElementById('sr_announcer');
		if (!region) {
			region = document.createElement('div');
			region.id = 'sr_announcer';
			region.className = 'sr_only';
			region.setAttribute('role', 'status');
			region.setAttribute('aria-live', 'polite');
			document.body.appendChild(region);
		}
		const text = this.text();
		//the text is changed so that the reader says it also when it is the same as before
		region.textContent = '';
		setTimeout(() => {
			region.textContent = text;
		}, 50);
	}
}

export default Help_describe_class;
