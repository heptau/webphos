import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import menuDefinition from '../src/js/config-menu.js';
import shortcuts from '../src/js/config-shortcuts.js';

const root = join(__dirname, '../src/js/modules');

type Item = { target?: string; children?: Item[] };

function targets(items: Item[], result: string[] = []): string[] {
  for (const item of items) {
    if (item.target) {
      result.push(item.target);
    }
    if (item.children) {
      targets(item.children, result);
    }
  }
  return result;
}

describe('menu and shortcut targets', () => {
  const all = Array.from(new Set(targets(menuDefinition as Item[]).concat((shortcuts as Item[]).map((item) => item.target as string))));

  it('every target points to an existing module and method', () => {
    const problems: string[] = [];
    for (const target of all) {
      const [path, method] = target.split('.');
      const file = join(root, path + '.js');
      if (!existsSync(file)) {
        problems.push(target + ' - file is missing');
        continue;
      }
      const source = readFileSync(file, 'utf8');
      //method definition "name(" at the start of a line (class method), also "async name("
      if (!new RegExp('^\\s+(async\\s+)?' + method + '\\s*\\(', 'm').test(source)) {
        problems.push(target + ' - method is missing');
      }
    }
    expect(problems).toEqual([]);
  });
});
