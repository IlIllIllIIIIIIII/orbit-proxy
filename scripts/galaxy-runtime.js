import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from 'galaxy-libcurl';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { refluxPath } from '@nightnetwork/reflux/path';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const galaxyRuntime = [
  ['charon', baremuxPath],
  ['libby', libcurlPath],
  ['libbybutslightlyworse', epoxyPath],
  ['reflux', refluxPath]
];

// Galaxy's pinned libcurl patch: initialize WASM before opening a session.
export async function patchedLibcurl() {
  const source = await readFile(path.join(libcurlPath, 'index.mjs'), 'utf8');
  const marker = '    libcurl.set_websocket(this.wisp);';
  if (!source.includes(marker)) throw new Error('Pinned libcurl patch no longer matches.');
  return source.replace(marker, '    if (!libcurl.ready) await libcurl.load_wasm();\n' + marker);
}
