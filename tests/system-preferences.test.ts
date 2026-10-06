import { detect_system_language, normalize_lang_code, resolve_theme, AUTO } from '../src/js/libs/system-preferences.js';

const available = ['en', 'ar', 'cs', 'de', 'zh', 'en-GB', 'pt'];
const themes = ['dark', 'light', 'green'];

describe('System language detection', () => {
  it('uses first supported language', () => {
    expect(detect_system_language(['cs-CZ', 'en-US'], available)).toBe('cs');
    expect(detect_system_language(['fi-FI', 'de-AT', 'en'], available)).toBe('de');
    expect(detect_system_language(['zh-Hans-CN'], available)).toBe('zh');
    expect(detect_system_language(['pt_BR'], available)).toBe('pt');
  });

  it('maps British English to "en-GB" and does not confuse Ukrainian', () => {
    expect(detect_system_language(['en-GB'], available)).toBe('en-GB');
    expect(detect_system_language(['en-gb'], available)).toBe('en-GB');
    expect(detect_system_language(['en-IE'], available)).toBe('en-GB');
    expect(detect_system_language(['en-US'], available)).toBe('en');
    expect(detect_system_language(['uk-UA', 'cs'], available)).toBe('cs');
    expect(detect_system_language(['uk-UA'], available)).toBe('en');
  });

  it('falls back to English', () => {
    expect(detect_system_language([], available)).toBe('en');
    expect(detect_system_language(['xx'], available)).toBe('en');
    expect(detect_system_language('de-DE' as unknown as string[], available)).toBe('de');
  });
});

describe('Language code normalization', () => {
  it('normalizes to BCP 47 form', () => {
    expect(normalize_lang_code('cs')).toBe('cs');
    expect(normalize_lang_code('EN_gb')).toBe('en-GB');
    expect(normalize_lang_code('zh-hans-cn')).toBe('zh-Hans-CN');
    expect(normalize_lang_code(' de ')).toBe('de');
  });

  it('maps legacy miniPaint "uk" code to en-GB', () => {
    expect(normalize_lang_code('uk')).toBe('en-GB');
  });

  it('rejects invalid codes', () => {
    expect(normalize_lang_code('')).toBeNull();
    expect(normalize_lang_code('auto')).toBeNull();
    expect(normalize_lang_code('cs"><script>')).toBeNull();
    expect(normalize_lang_code('../cs')).toBeNull();
    expect(normalize_lang_code(null as unknown as string)).toBeNull();
  });
});

describe('Theme resolving', () => {
  it('keeps manually selected theme', () => {
    expect(resolve_theme('green', true, themes)).toBe('green');
    expect(resolve_theme('light', true, themes)).toBe('light');
  });

  it('follows system preference in auto mode', () => {
    expect(resolve_theme(AUTO, true, themes)).toBe('dark');
    expect(resolve_theme(AUTO, false, themes)).toBe('light');
    expect(resolve_theme(null, false, themes)).toBe('light');
  });

  it('falls back to first theme when needed', () => {
    expect(resolve_theme('unknown', false, ['dark', 'green'])).toBe('dark');
  });
});

import { match_preferred_languages, order_languages } from '../src/js/libs/system-preferences.js';
import { filter_supported_types, can_encode_mime } from '../src/js/libs/export-formats.js';

describe('language order', () => {
  const names = { en: 'English', cs: 'Čeština', de: 'Deutsch', 'en-GB': 'English (UK)', es: 'Español' };

  it('keeps supported browser preferences in order and skips unsupported', () => {
    expect(match_preferred_languages(['cs-CZ', 'sk', 'en-US', 'cs'], Object.keys(names))).toEqual(['cs', 'en']);
    expect(match_preferred_languages(['en-GB'], Object.keys(names))).toEqual(['en-GB']);
  });

  it('puts preferred languages first and sorts the rest alphabetically', () => {
    expect(order_languages(names, ['cs-CZ', 'sk', 'en-US'], 'cs')).toEqual(['cs', 'en', 'de', 'en-GB', 'es']);
    expect(order_languages(names, [], 'en')).toEqual(['cs', 'de', 'en', 'en-GB', 'es']);
  });
});

describe('export formats', () => {
  const canvas = (supported: string[]) => () => ({
    toDataURL: (mime: string) => 'data:' + (supported.includes(mime) ? mime : 'image/png') + ';base64,AAAA',
  });

  it('detects mime types the canvas encodes', () => {
    expect(can_encode_mime('image/webp', canvas(['image/webp']) as never)).toBe(true);
    expect(can_encode_mime('image/webp', canvas([]) as never)).toBe(false);
  });

  it('hides formats the browser cannot encode, keeps library formats', () => {
    const types = { PNG: 'p', JPG: 'j', WEBP: 'w', AVIF: 'a', GIF: 'g', BMP: 'b', TIFF: 't' };
    const result = filter_supported_types(types, canvas(['image/png', 'image/jpeg', 'image/webp']) as never);
    expect(Object.keys(result)).toEqual(['PNG', 'JPG', 'WEBP', 'GIF', 'BMP', 'TIFF']);
  });
});
