# Orbit — Scramjet V2 proxy

A compact self-hosted web proxy built on the Scramjet 2.x controller stack, libcurl transport, and a local Wisp endpoint.

## Run it

```bash
npm install
npm start
```

Open [http://localhost:8080](http://localhost:8080). For development with automatic server restarts, use `npm run dev`.

## Dedicated Wisp server

The proxy starts with a Wisp endpoint at `/wisp/` on port 8080. To run Wisp as
a separate relay instead:

```bash
npm run wisp
WISP_URL=ws://localhost:8081/wisp/ npm start
```

The dedicated relay has a health check at `http://localhost:8081/health` and
keeps private and loopback destination addresses blocked. In production, use a
`wss://` URL behind TLS.

## Deployment notes

### Render static site

The static build uses `wss://orbit-proxy-6iw7.onrender.com/wisp/` by default.
Keep that separate Wisp Web Service running.

- Build command: `npm ci && npm run build`
- Publish directory: `dist-render`
- Optional build environment override: `WISP_URL` (must start with `wss://`).

For an existing Render Static Site, add these headers for path `/*` under its
Headers settings: `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`, and `Cache-Control: no-cache`.
The included `render.yaml` supplies these settings when creating a Blueprint.
Do not add a catch-all rewrite to `index.html`: proxy routes are handled by
the service worker. Upload the source including `scripts/build-static.js`;
Render generates `dist-render` during its build.

- Use HTTPS outside localhost: browsers only permit service workers in secure contexts.
- Keep WebSocket upgrades enabled and routed to `/wisp/`; serverless hosts are usually a poor fit for long-lived Wisp connections.
- Do not cache `sw.js` or the Scramjet runtime directories across releases.
- The Wisp server does not enable private/loopback destinations, so it should remain that way on public deployments.
- Follow the acceptable-use policy of your host and use the proxy only with sites and services you are authorized to access.

## Verification

```bash
npm run check
curl http://localhost:8080/health
```
