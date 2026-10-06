/**
 * @jest-environment jsdom
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const $ = require('jquery');

(window as any).jQuery = $;
require('../src/js/libs/jquery.translate.js');

function translate(html: string, translations: Record<string, Record<string, string>>) {
	document.body.innerHTML = '<div id="x" class="trn">' + html + '</div>';
	($('body') as any).translate({lang: 'cs', t: translations});
	return document.getElementById('x')!;
}

describe('jquery.translate', () => {
	test('replaces the text with the translation', () => {
		const el = translate('Cancel', {Cancel: {cs: 'Zrušit'}});
		expect(el.textContent).toBe('Zrušit');
	});

	test('keeps simple markup', () => {
		const el = translate('Hello', {Hello: {cs: 'Ahoj <b>světe</b>'}});
		expect(el.innerHTML).toBe('Ahoj <b>světe</b>');
	});

	test('drops scripts, event handlers and javascript links', () => {
		const el = translate('Hi', {Hi: {cs: '<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)" onclick="x()">odkaz</a>'}});
		expect(el.querySelector('img')).toBeNull();
		expect(el.querySelector('script')).toBeNull();
		const link = el.querySelector('a')!;
		expect(link.getAttribute('onclick')).toBeNull();
		expect(link.getAttribute('href')).toBeNull();
	});

	test('escaped text stays text', () => {
		const el = translate('&lt;img src=x onerror=alert(1)&gt;', {});
		expect(el.querySelector('img')).toBeNull();
		expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
	});

	test('keeps the icon of a button and translates its title', () => {
		document.body.innerHTML = '<button id="b" class="trn" title="Cancel"><svg viewBox="0 0 16 16"><path d="M1 1"/></svg></button>';
		($('body') as any).translate({lang: 'cs', t: {Cancel: {cs: 'Zrušit'}}});
		const button = document.getElementById('b')!;
		expect(button.querySelector('svg')).not.toBeNull();
		expect(button.getAttribute('title')).toBe('Zrušit');
	});
});
