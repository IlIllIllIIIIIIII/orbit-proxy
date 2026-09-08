import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { libcurlPath } from "chemical-libcurl";

const vendor = fileURLToPath(new URL("../vendor/chemicaljs/", import.meta.url));
const uvPath = "_hPRTiIRrX";
export async function prepareChemical(output) {
  await mkdir(output, { recursive: true });
  const config = `const uvRandomPath = ${JSON.stringify(uvPath)};\nconst uvEnabled = true;\nconst scramjetEnabled = false;\nconst rammerheadEnabled = false;\nconst demoMode = false;\nconst defaultService = "uv";\n`;
  const client = (await readFile(path.join(vendor, "client/chemical.js"), "utf8"))
    .replaceAll('"/chemical.sw.js"', '"/sw.js"');
  await writeFile(path.join(output, "chemical.js"), `(async () => {\n${config}${client}\n})().catch(error => window.dispatchEvent(new CustomEvent("chemicalError", { detail: String(error?.message || error) })));\n`);
  const worker = await readFile(path.join(vendor, "client/chemical.sw.js"), "utf8");
  await writeFile(path.join(output, "chemical-worker.js"), config + worker);
  for (const [name, source] of [[uvPath, path.join(vendor, "ultraviolet/dist")], ["baremux", baremuxPath], ["libcurl", libcurlPath]]) {
    await cp(source, path.join(output, name), { recursive: true });
  }
  // Distribute the corresponding source and license with the deployed assets.
  await cp(vendor, path.join(output, "chemical-source"), { recursive: true });
}
