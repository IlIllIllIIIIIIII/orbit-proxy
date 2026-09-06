import http from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const host = process.env.WISP_HOST || "0.0.0.0";
const port = Number(process.env.WISP_PORT || 8081);
const endpoint = "/wisp/";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("WISP_PORT must be a valid TCP port number");
}

// Retain Wisp's safe defaults: private and loopback destinations are blocked.
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, service: "wisp", endpoint }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Wisp WebSocket endpoint: /wisp/");
});

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === endpoint) {
    req.url = endpoint;
    wisp.routeRequest(req, socket, head);
    return;
  }

  socket.end();
});

server.listen(port, host, () => {
  console.log(`Wisp server listening on ws://${host}:${port}${endpoint}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; shutting down Wisp server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
