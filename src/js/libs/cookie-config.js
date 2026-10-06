/**
 * Safe storage of user settings in one JSON cookie ("config").
 *
 * Value is written URI-encoded (cookie values may not contain ; , " or spaces).
 * Older raw JSON cookies are still readable. Corrupted cookie never throws - it is ignored
 * and replaced by valid data on next write.
 */

export const CONFIG_COOKIE = 'config';
const EXPIRE_DAYS = 180;

/**
 * find raw value of cookie by exact name
 *
 * @param {string} cookie_string e.g. document.cookie
 * @param {string} name
 * @returns {string|null}
 */
export function read_cookie_value(cookie_string, name) {
	if (typeof cookie_string != 'string' || cookie_string == '') {
		return null;
	}
	var parts = cookie_string.split(';');
	for (var i in parts) {
		var part = parts[i].trim();
		var separator = part.indexOf('=');
		if (separator == -1) {
			continue;
		}
		if (part.substring(0, separator).trim() == name) {
			return part.substring(separator + 1).trim();
		}
	}
	return null;
}

/**
 * parse config cookie value, supports URI-encoded and legacy raw JSON values
 *
 * @param {string|null} raw
 * @returns {object} settings, empty object if missing or corrupted
 */
export function parse_config_value(raw) {
	if (typeof raw != 'string' || raw == '') {
		return {};
	}
	var candidates = [raw];
	try {
		var decoded = decodeURIComponent(raw);
		if (decoded != raw) {
			candidates.unshift(decoded);
		}
	}
	catch (error) {
		//malformed URI sequence - try raw value only
	}

	for (var i in candidates) {
		try {
			var data = JSON.parse(candidates[i]);
			if (data !== null && typeof data == 'object' && Array.isArray(data) == false) {
				return data;
			}
		}
		catch (error) {
			//try next candidate
		}
	}
	return {};
}

/**
 * serialize settings for config cookie
 *
 * @param {object} data
 * @returns {string}
 */
export function serialize_config_value(data) {
	return encodeURIComponent(JSON.stringify(data));
}

/**
 * @returns {object} all settings stored in config cookie
 */
export function read_config() {
	if (typeof document == 'undefined') {
		return {};
	}
	return parse_config_value(read_cookie_value(document.cookie, CONFIG_COOKIE));
}

/**
 * save all settings to config cookie
 *
 * @param {object} data
 */
export function write_config(data) {
	if (typeof document == 'undefined') {
		return;
	}
	var expire = new Date();
	expire.setTime(expire.getTime() + EXPIRE_DAYS * 24 * 3600 * 1000);
	document.cookie = CONFIG_COOKIE + '=' + serialize_config_value(data)
		+ '; expires=' + expire.toUTCString() + '; SameSite=Lax';
}
