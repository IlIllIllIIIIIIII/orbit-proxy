import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareChemical } from "./chemical-assets.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist-render");
const wisp = new URL(process.env.WISP_URL || "wss://orbit-proxy-6iw7.onrender.com/wisp/");
if (wisp.protocol !== "wss:") throw new Error("Static deployment requires a secure wss:// WISP_URL");

await mkdir(output, { recursive: true });
await cp(path.join(root, "public"), output, { recursive: true });
await prepareChemical(output);
await writeFile(path.join(output, "config.js"),
  `globalThis.__PROXY_CONFIG__ = ${JSON.stringify({ wispUrl: wisp.href })};\n`);
// Support an existing static service configured with Vite's default directory.
await cp(output, path.join(root, "dist"), { recursive: true });
console.log(`Static proxy built in dist-render and dist using ${wisp.href}`);
