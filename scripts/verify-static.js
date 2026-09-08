import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galaxyRuntime } from './galaxy-runtime.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist-render');
const manifest = JSON.parse(await readFile(path.join(root, 'public/galaxy/RUNTIME-SHA256.json'), 'utf8'));
for (const [file, expected] of Object.entries(manifest.files)) {
  for (const directory of ['public', 'dist-render']) {
    const actual = createHash('sha256').update(await readFile(path.join(root, directory, file))).digest('hex');
    if (actual !== expected) throw new Error(`Pinned Galaxy asset mismatch: ${directory}/${file}`);
  }
}
const required = new Set(['sw.js', 'config.js', 'js/codec.js', 'js/engine.js', 'utils/scramjet-utils.js']);
const html = await readFile(path.join(output, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
  if (match[1] !== '/') required.add(match[1].slice(1));
}
async function runtimeFiles(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await runtimeFiles(path.join(directory, entry.name), relative);
    else if (/\.(js|mjs|wasm)$/.test(entry.name)) required.add(relative);
  }
}
for (const [mount, source] of galaxyRuntime) await runtimeFiles(source, mount);
for (const file of required) {
  if (!(await stat(path.join(output, file))).isFile()) throw new Error(`Missing runtime asset: ${file}`);
}
console.log(`Verified ${Object.keys(manifest.files).length} pinned assets and ${required.size} frontend/runtime paths.`);
