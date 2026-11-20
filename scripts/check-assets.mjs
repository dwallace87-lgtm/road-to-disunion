import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = ['board_config.json', 'backend.js', 'Road to Disunion Tracker.dc.html', 'Mission Control.dc.html'];
const pngReference = /\bassets\/[^"'`<>\r\n{}?#]+?\.png(?=$|[?#"'`<>\s),;])/gi;
const references = new Map();

function record(path, source) {
  if (!references.has(path)) references.set(path, new Set());
  references.get(path).add(source);
}

for (const source of sources) {
  const contents = readFileSync(join(root, source), 'utf8');
  for (const [path] of contents.matchAll(pngReference)) {
    record(decodeURIComponent(path), source);
  }
}

for (const set of ['A', 'B']) {
  for (let number = 1; number <= 12; number++) {
    record(`assets/av${set}_${number}.png`, 'avatar picker');
  }
}

// The board builds its leaf image URLs from the colors configured for each map.
const board = JSON.parse(readFileSync(join(root, 'board_config.json'), 'utf8'));
for (const map of [board.world, ...board.regions]) {
  for (const [, , color] of map.ambient?.leaf ?? []) {
    record(`assets/mo_leaf_${color}.png`, 'board_config.json (map animations)');
  }
}

const files = new Set(readdirSync(join(root, 'assets'), { recursive: true, withFileTypes: true })
  .filter(file => file.isFile())
  .map(file => relative(root, join(file.parentPath, file.name)).split(sep).join('/')));
const missing = [...references.keys()].filter(path => !files.has(path)).sort();

if (missing.length) {
  console.error(`Missing PNG files (${missing.length}):`);
  for (const path of missing) {
    console.error(`  ${path} — referenced by ${[...references.get(path)].join(', ')}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Asset check passed: ${references.size} PNG files found, including all 24 avatars.`);
}
