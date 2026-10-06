/**
 * Adds keys of the Czech dictionary (the reference one) that are missing in the translator template empty.json.
 * Usage: node scripts/sync-translations.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/js/languages');
const cs = JSON.parse(fs.readFileSync(path.join(dir, 'cs.json'), 'utf8'));
const file = path.join(dir, 'empty.json');
const empty = JSON.parse(fs.readFileSync(file, 'utf8'));

let added = 0;
for (const key of Object.keys(cs)) {
	if (!(key in empty)) {
		empty[key] = '';
		added++;
	}
}
fs.writeFileSync(file, JSON.stringify(empty, null, 4) + '\n');
console.log('empty.json: added ' + added + ' keys');
