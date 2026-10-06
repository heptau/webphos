import config from './../../config.js';
import Helper_class from './../../libs/helpers.js';
import Translate_class from './../../libs/jquery.translate.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';
import { AUTO, detect_system_language, get_system_languages, normalize_lang_code } from './../../libs/system-preferences.js';

var instance = null;

//Available language codes - dictionaries are loaded on demand (code split),
//so unused languages do not bloat the initial bundle.
const LANG_LOADERS = {
	ar: () => import('../../languages/ar.json'),
	cs: () => import('../../languages/cs.json'),
	de: () => import('../../languages/de.json'),
	el: () => import('../../languages/el.json'),
	'en-GB': () => import('../../languages/en-GB.json'),
	es: () => import('../../languages/es.json'),
	fr: () => import('../../languages/fr.json'),
	it: () => import('../../languages/it.json'),
	ja: () => import('../../languages/ja.json'),
	ko: () => import('../../languages/ko.json'),
	lt: () => import('../../languages/lt.json'),
	nl: () => import('../../languages/nl.json'),
	pt: () => import('../../languages/pt.json'),
	ru: () => import('../../languages/ru.json'),
	tr: () => import('../../languages/tr.json'),
	zh: () => import('../../languages/zh.json'),
};

//language names shown in Settings (own names, so they are not translated), code -> name
export const LANGUAGE_NAMES = {
	en: 'English',
	ar: 'عربي',
	cs: 'Čeština',
	zh: '简体中文',
	de: 'Deutsch',
	nl: 'Dutch',
	'en-GB': 'English (UK)',
	es: 'Español',
	fr: 'Français',
	el: 'Greek',
	it: 'Italiano',
	ja: '日本語',
	ko: '한국어',
	lt: 'Lietuvių',
	pt: 'Português',
	ru: 'русский язык',
	tr: 'Türkçe',
};

class Tools_translate_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Helper = new Helper_class();
		this.translations = {};
		this.trans_lang_codes = [];
		this.loaded_langs = new Set(['en']);
		this.pending_langs = {};
		this.auto = false;

		if (typeof window != 'undefined') {
			//follow system language changes while "auto" is selected
			window.addEventListener('languagechange', () => {
				if (this.auto) {
					this.translate(this.get_system_language());
				}
			});
		}
	}

	//supported language codes
	get_available_languages() {
		return ['en'].concat(Object.keys(LANG_LOADERS));
	}

	//best supported language based on operating system / browser preferences
	get_system_language() {
		return detect_system_language(get_system_languages(), this.get_available_languages());
	}

	/**
	 * language selected by user from menu - code or "auto" (follow system). Choice is saved.
	 *
	 * @param {string} lang_code
	 */
	set_language(lang_code) {
		if (lang_code != AUTO) {
			lang_code = normalize_lang_code(lang_code);
		}
		if (lang_code != AUTO && this.get_available_languages().includes(lang_code) == false) {
			alertify.error(t('Translate error, can not find dictionary: ') + lang_code);
			return;
		}
		this.Helper.setCookie('language', lang_code);
		this.auto = (lang_code == AUTO);
		this.translate(this.auto ? this.get_system_language() : lang_code);
	}

	/**
	 * saved language preference, "auto" when nothing was chosen yet
	 *
	 * @returns {string}
	 */
	get_language_setting() {
		var lang_code = this.Helper.getCookie('language');
		if (!lang_code || lang_code == AUTO) {
			return AUTO;
		}
		return normalize_lang_code(String(lang_code)) || AUTO;
	}

	//load a language dictionary on demand (once per language)
	ensure_lang(lang_code) {
		if (this.loaded_langs.has(lang_code)) {
			return Promise.resolve();
		}
		if (this.pending_langs[lang_code]) {
			return this.pending_langs[lang_code];
		}
		const loader = LANG_LOADERS[lang_code];
		if (!loader) {
			return Promise.reject(new Error('Unknown language: ' + lang_code));
		}
		this.pending_langs[lang_code] = loader().then((dict) => {
			for (const key in dict) {
				if (this.translations[key] == undefined) {
					this.translations[key] = {
						en: key,
					};
				}
				this.translations[key][lang_code] = dict[key];
			}
			this.loaded_langs.add(lang_code);
			this.trans_lang_codes.push(lang_code);
			delete this.pending_langs[lang_code];
		}).catch((error) => {
			delete this.pending_langs[lang_code];
			console.error('Failed to load language: ' + lang_code, error);
			throw error;
		});
		return this.pending_langs[lang_code];
	}

	//change language
	translate(lang_code, element) {
		if (lang_code == undefined) {
			lang_code = this.Helper.getCookie('language');
			if (!lang_code) {
				return;
			}
		}

		if (lang_code == AUTO) {
			lang_code = this.get_system_language();
		}
		lang_code = normalize_lang_code(String(lang_code)) || 'en';

		if (lang_code == 'en' || LANG_LOADERS[lang_code]) {
			//translate once the dictionary is available
			this.ensure_lang(lang_code).then(() => {
				$(element || 'body').translate({lang: lang_code, t: this.translations});
				config.LANG = lang_code;
				//panels that render translated text from JS (History) refresh themselves
				document.dispatchEvent(new Event('minipaint:history'));
				document.documentElement.lang = lang_code;
			}).catch(() => {
				alertify.error(t('Translate error, can not find dictionary: ') + lang_code);
			});
		}
		else {
			alertify.error(t('Translate error, can not find dictionary: ') + lang_code);
		}
	}
}

//JS-side translation helper (alertify messages and other runtime strings).
//Fallback: returns the original English text when no translation exists.
export function t(text) {
	if (typeof text != 'string' || text == '') {
		return text;
	}
	const translator = instance || new Tools_translate_class();
	const lang = config.LANG;
	if (!lang || lang == 'en') {
		return text;
	}
	const entry = translator.translations[text];
	if (entry && entry[lang]) {
		return entry[lang];
	}
	//dictionary not loaded yet - start loading, fall back to English for now
	translator.ensure_lang(lang).catch(() => {});
	return text;
}

export default Tools_translate_class;
