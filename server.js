import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import express from "express";
import { galaxyRuntime, patchedLibcurl } from "./scripts/galaxy-runtime.js";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const app = express();
const port = Number(process.env.PORT || 8080);
const configuredWispUrl = process.env.WISP_URL ? new URL(process.env.WISP_URL) : null;

if (configuredWispUrl && !["ws:", "wss:"].includes(configuredWispUrl.protocol)) {
  throw new Error("WISP_URL must use ws:// or wss://");
}

// Never import browser-only packages on the server. Resolving their entry point
// gives us the directory to serve without evaluating their browser runtime.
const dirOf = (specifier) => path.dirname(require.resolve(specifier));

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "scramjet-v2-proxy",
    wisp: configuredWispUrl?.toString() ?? "/wisp/"
  });
});

// Lets a deployed shell point at a separate Wisp server without bundling a
// deployment-specific address into the browser files.
app.get("/config.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript");
  res.send(`globalThis.__PROXY_CONFIG__ = ${JSON.stringify({
    wispUrl: configuredWispUrl?.toString() ?? null
  })};`);
});

const libcurlSource = await patchedLibcurl();
app.get('/libby/index.mjs', (_req, res) => res.type('application/javascript').send(libcurlSource));
for (const [mount, source] of galaxyRuntime) {
  app.use(`/${mount}/`, express.static(source, { fallthrough: false }));
}

// Scramjet V2 runtime assets retained for existing sessions.
app.use("/scram/", express.static(scramjetPath, { fallthrough: false }));
app.use(
  "/controller/",
  express.static(dirOf("@mercuryworkshop/scramjet-controller"), {
    fallthrough: false
  })
);
app.use(
  "/utils/",
  express.static(dirOf("@mercuryworkshop/scramjet-utils"), {
    fallthrough: false
  })
);
app.use(
  "/libcurl/",
  express.static(dirOf("@mercuryworkshop/libcurl-transport"), {
    fallthrough: false
  })
);

// A stale worker is difficult to recover from after deploying a new engine.
app.get("/sw.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.use((_req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/wisp/") {
    req.url = pathname;
    wisp.routeRequest(req, socket, head);
    return;
  }

  socket.end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Scramjet V2 proxy listening on http://localhost:${port}`);
});
