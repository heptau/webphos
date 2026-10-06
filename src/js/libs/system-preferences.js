/**
 * Helpers for "auto" settings that follow operating system preferences (theme and language).
 */

export const AUTO = 'auto';

//old miniPaint codes that were not valid BCP 47 / ISO 639-1 tags
const LEGACY_LANG_CODES = {
	uk: 'en-GB', //was used for English (UK), but "uk" is ISO 639-1 code of Ukrainian
};

/**
 * sanitize and normalize language code to BCP 47 form used by browsers,
 * e.g. "EN_gb" -> "en-GB", "zh-hans" -> "zh-Hans", legacy "uk" -> "en-GB"
 *
 * @param {string} code
 * @returns {string|null} normalized code or null if invalid
 */
export function normalize_lang_code(code) {
	if (typeof code != 'string') {
		return null;
	}
	var parts = code.trim().replace(/_/g, '-').split('-');
	if (/^[a-z]{2,3}$/i.test(parts[0]) == false) {
		return null;
	}
	var result = [parts[0].toLowerCase()];
	for (var i = 1; i < parts.length; i++) {
		var part = parts[i];
		if (/^[a-z]{2}$/i.test(part) || /^[0-9]{3}$/.test(part)) {
			//region - ISO 3166-1
			result.push(part.toUpperCase());
		}
		else if (/^[a-z]{4}$/i.test(part)) {
			//script - ISO 15924
			result.push(part[0].toUpperCase() + part.slice(1).toLowerCase());
		}
		else if (/^[a-z0-9]{5,8}$/i.test(part)) {
			result.push(part.toLowerCase());
		}
		else {
			return null;
		}
	}
	var normalized = result.join('-');
	return LEGACY_LANG_CODES[normalized] || normalized;
}

/**
 * pick best supported language from browser/system preferences
 *
 * @param {string[]} preferred e.g. navigator.languages - ['cs-CZ', 'en-US']
 * @param {string[]} available supported BCP 47 codes, e.g. ['en', 'cs', 'de', 'en-GB', ...]
 * @returns {string} language code, 'en' if nothing matches
 */
export function detect_system_language(preferred, available) {
	if (!Array.isArray(preferred)) {
		preferred = preferred ? [preferred] : [];
	}
	for (var i in preferred) {
		//do not use normalize_lang_code() here - browser "uk" really means Ukrainian
		if (typeof preferred[i] != 'string' || preferred[i] == '') {
			continue;
		}
		var tag = preferred[i].toLowerCase().replace(/_/g, '-');
		var primary = tag.split('-')[0];

		//exact match first (e.g. en-GB), then primary language (e.g. cs-CZ -> cs)
		for (var j in available) {
			if (available[j].toLowerCase() == tag) {
				return available[j];
			}
		}
		if (tag == 'en-ie' && available.includes('en-GB')) {
			return 'en-GB';
		}
		for (var k in available) {
			if (available[k].toLowerCase() == primary) {
				return available[k];
			}
		}
	}
	return 'en';
}

/**
 * read system languages from navigator
 *
 * @returns {string[]}
 */
export function get_system_languages() {
	if (typeof navigator == 'undefined') {
		return [];
	}
	if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
		return navigator.languages;
	}
	return navigator.language ? [navigator.language] : [];
}

/**
 * resolve theme setting to real theme name
 *
 * @param {string|null} setting theme name or 'auto'
 * @param {boolean} prefers_dark system prefers dark color scheme
 * @param {string[]} themes available themes
 * @returns {string}
 */
export function resolve_theme(setting, prefers_dark, themes) {
	if (setting != null && setting != AUTO && themes.includes(setting)) {
		return setting;
	}
	var wanted = prefers_dark ? 'dark' : 'light';
	if (themes.includes(wanted)) {
		return wanted;
	}
	return themes[0];
}

/**
 * @returns {boolean} true if system prefers dark color scheme
 */
export function system_prefers_dark() {
	if (typeof window == 'undefined' || typeof window.matchMedia != 'function') {
		return true;
	}
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * register callback for system color scheme changes
 *
 * @param {function} callback receives boolean prefers_dark
 */
export function on_system_theme_change(callback) {
	if (typeof window == 'undefined' || typeof window.matchMedia != 'function') {
		return;
	}
	var query = window.matchMedia('(prefers-color-scheme: dark)');
	var handler = (event) => callback(event.matches);
	if (typeof query.addEventListener == 'function') {
		query.addEventListener('change', handler);
	}
	else if (typeof query.addListener == 'function') {
		//older Safari
		query.addListener(handler);
	}
}

/**
 * supported languages that match browser preferences, in the order of preference
 *
 * @param {string[]} preferred e.g. navigator.languages - ['cs-CZ', 'sk', 'en-US']
 * @param {string[]} available supported BCP 47 codes
 * @returns {string[]} e.g. ['cs', 'en'] - unsupported preferences (sk) are skipped, no duplicates
 */
export function match_preferred_languages(preferred, available) {
	var result = [];
	for (var i in preferred) {
		if (typeof preferred[i] != 'string' || preferred[i] == '') {
			continue;
		}
		var tag = preferred[i].toLowerCase().replace(/_/g, '-');
		var primary = tag.split('-')[0];
		var found = null;
		for (var j in available) {
			if (available[j].toLowerCase() == tag) {
				found = available[j];
				break;
			}
		}
		if (found == null && tag == 'en-ie' && available.includes('en-GB')) {
			found = 'en-GB';
		}
		if (found == null) {
			for (var k in available) {
				if (available[k].toLowerCase() == primary) {
					found = available[k];
					break;
				}
			}
		}
		if (found != null && result.includes(found) == false) {
			result.push(found);
		}
	}
	return result;
}

/**
 * order language codes for a language list: browser preferred languages first,
 * all others after them in alphabetical order of their names
 *
 * @param {object} names map code -> language name
 * @param {string[]} preferred browser preferences, e.g. navigator.languages
 * @param {string} [locale] locale used for alphabetical sorting
 * @returns {string[]} language codes
 */
export function order_languages(names, preferred, locale) {
	var codes = Object.keys(names);
	var first = match_preferred_languages(preferred, codes);
	var rest = codes.filter((code) => first.includes(code) == false);
	var collator = new Intl.Collator(locale || undefined);
	rest.sort((a, b) => collator.compare(names[a], names[b]));
	return first.concat(rest);
}
