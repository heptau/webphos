import { crc32, build_zip } from '../src/js/libs/zip.js';
import { parse_gpl, build_gpl } from '../src/js/libs/gpl.js';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('writes a readable archive structure', () => {
    const zip = build_zip([{ name: 'a.txt', data: bytes('hello') }, { name: 'b/č.txt', data: bytes('xy') }], new Date(2024, 0, 15, 10, 20, 30));
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    //end of central directory is the last 22 bytes
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const central_start = view.getUint32(end + 16, true);
    expect(view.getUint32(central_start, true)).toBe(0x02014b50);
    //stored data of the first file follows its local header
    expect(new TextDecoder().decode(zip.slice(30 + 5, 30 + 5 + 5))).toBe('hello');
    expect(view.getUint32(14, true)).toBe(crc32(bytes('hello')));
  });
});

describe('gpl palettes', () => {
  it('writes and reads a palette', () => {
    const text = build_gpl('Test', ['#ff0000', '#00ff80', 'broken']);
    expect(text.startsWith('GIMP Palette')).toBe(true);
    expect(parse_gpl(text)).toEqual(['#ff0000', '#00ff80']);
  });

  it('rejects other files', () => {
    expect(parse_gpl('hello')).toBeNull();
    expect(parse_gpl('GIMP Palette\nName: x\n#\n')).toBeNull();
  });
});
