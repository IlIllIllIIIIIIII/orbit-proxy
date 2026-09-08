import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { prepareChemical } from "./scripts/chemical-assets.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.join(root, ".chemical-runtime");
await prepareChemical(runtime);
const app = express();
const port = Number(process.env.PORT || 8080);
const configuredWispUrl = process.env.WISP_URL ? new URL(process.env.WISP_URL) : null;
if (configuredWispUrl && !["ws:", "wss:"].includes(configuredWispUrl.protocol)) {
  throw new Error("WISP_URL must use ws:// or wss://");
}
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-cache");
  next();
});
app.get("/health", (_req, res) => res.json({ ok: true, service: "orbit-chemical-proxy", wisp: configuredWispUrl?.toString() ?? "/wisp/" }));
app.get("/config.js", (_req, res) => {
  res.type("application/javascript").send(`globalThis.__PROXY_CONFIG__ = ${JSON.stringify({ wispUrl: configuredWispUrl?.toString() ?? null })};`);
});
app.use(express.static(path.join(root, "public"), { extensions: ["html"] }));
app.use(express.static(runtime));
app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));
const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === "/wisp/") {
    req.url = pathname;
    wisp.routeRequest(req, socket, head);
  } else socket.end();
});
server.listen(port, "0.0.0.0", () => console.log(`Orbit ChemicalJS proxy listening on http://localhost:${port}`));
