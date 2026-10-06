import { read_cookie_value, parse_config_value, serialize_config_value, read_config, write_config } from '../src/js/libs/cookie-config.js';

function clear_cookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim();
    if (name) {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }
}

describe('Config cookie', () => {
  beforeEach(clear_cookies);

  it('reads cookie by exact name', () => {
    const cookies = 'myconfig=wrong; config={"a":1}; other=x';
    expect(read_cookie_value(cookies, 'config')).toBe('{"a":1}');
    expect(read_cookie_value(cookies, 'missing')).toBeNull();
    expect(read_cookie_value('', 'config')).toBeNull();
  });

  it('parses legacy raw JSON and URI-encoded values', () => {
    expect(parse_config_value('{"language":"cs","snap":1}')).toEqual({ language: 'cs', snap: 1 });
    expect(parse_config_value(encodeURIComponent('{"theme":"auto"}'))).toEqual({ theme: 'auto' });
  });

  it('never throws on corrupted values', () => {
    expect(parse_config_value('%7B%22acti')).toEqual({});
    expect(parse_config_value('{broken')).toEqual({});
    expect(parse_config_value('%E0%A4%A')).toEqual({});
    expect(parse_config_value('null')).toEqual({});
    expect(parse_config_value('[1,2]')).toEqual({});
    expect(parse_config_value('5')).toEqual({});
    expect(parse_config_value(null)).toEqual({});
  });

  it('round-trips values with special characters', () => {
    const data = { name: 'a; b, "c" =d %', language: 'en-GB' };
    expect(parse_config_value(serialize_config_value(data))).toEqual(data);
  });

  it('writes and reads document cookie', () => {
    write_config({ language: 'cs', theme: 'auto' });
    expect(read_config()).toEqual({ language: 'cs', theme: 'auto' });
  });

  it('recovers from corrupted document cookie', () => {
    document.cookie = 'config=%7B%22acti';
    expect(read_config()).toEqual({});
    write_config({ language: 'de' });
    expect(read_config()).toEqual({ language: 'de' });
  });
});
