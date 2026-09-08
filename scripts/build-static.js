import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist-render");
const require = createRequire(import.meta.url);
const wisp = new URL(process.env.WISP_URL || "wss://orbit-proxy-6iw7.onrender.com/wisp/");
if (wisp.protocol !== "wss:") throw new Error("Static deployment requires a secure wss:// WISP_URL");

await mkdir(output, { recursive: true });
await cp(path.join(root, "public"), output, { recursive: true });
for (const [directory, source] of [
  ["scram", scramjetPath],
  ["controller", path.dirname(require.resolve("@mercuryworkshop/scramjet-controller"))],
  ["utils", path.dirname(require.resolve("@mercuryworkshop/scramjet-utils"))],
  ["libcurl", path.dirname(require.resolve("@mercuryworkshop/libcurl-transport"))]
]) {
  await cp(source, path.join(output, directory), { recursive: true });
}
await writeFile(path.join(output, "config.js"),
  `globalThis.__PROXY_CONFIG__ = ${JSON.stringify({ wispUrl: wisp.href })};\n`);
// Support an existing static service configured with Vite's default directory.
await cp(output, path.join(root, "dist"), { recursive: true });
console.log(`Static proxy built in dist-render and dist using ${wisp.href}`);
