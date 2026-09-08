# Galaxy compatibility audit

Reference: https://gitlab.com/Hydra.Network/galaxy/galaxyv7 at
`a7b99031a0ffba0245cad2350ac5cab77fdc6cbd`.

## Findings and changes

No cause of the reported school-network block was established. This audit is
about runtime correctness on authorized networks, not policy circumvention.
All 16 files in `public/prism`, `public/poly`, and `public/glass` match the pinned
checkout byte-for-byte; none were changed.

| Area | Finding / action |
| --- | --- |
| Prism transport | Already matches `src/lib/lethe/prism.js`: vendored `/prism/libby.js`, `LibcurlClient` export resolution, `new Client({wisp})`, awaited `init()`, then controller `wait()`. Epoxy uses `/prism/libbyworse.js`. No transport replacement or version upgrade. |
| Two npm libcurl versions | Not an active Prism mix. `galaxy-libcurl@1.5.2` serves `/libby/index.mjs` for BareMux; npm libcurl 2 serves only the retained `/libcurl/` compatibility route. Current HTML does not load that route. Added source comments documenting this distinction. |
| libcurl patch | Existing WASM-before-session patch is for the BareMux ESM transport, not Prism. It achieves Galaxy's initialization ordering; its remaining ready check returns immediately after WASM initialization. Preserved. |
| Controller configuration | Same Prism runtime, injection, WASM paths and existing codec. Previous separate-codec-object fix preserved. Failed controller readiness no longer publishes a controller as ready; assignment happens after `wait()`. No new URL encoding or obfuscation. |
| Frame navigation | Removed Orbit's extra escaped-link and URL-watcher plugins from Prism frame creation to match Galaxy's GeForce NOW `/api` route, which uses a plain frame. The escaped-link callback had redirected new-window requests toward Orbit's shell. This was a concrete behavioral difference, not proof of the reported block's cause. |
| Service worker | Same combined-engine architecture as Galaxy. Removed Orbit's hard-coded `/scramjet/` predicate; routing now follows Prism first, then loaded legacy configuration, Glass, Polygon, network fallback. Added the upstream undefined-controller guard and explicit classic registration. |
| Activation | Orbit still waits for page control and keeps skipWaiting/clients.claim; Galaxy's worker lacks these lifecycle listeners and its registration waits less strictly. Retained Orbit's bounded startup wait. Neither clears user storage nor reloads the page. |
| GFN shortcut | Now explicitly chooses Prism and direct libcurl, matching Galaxy's `/api?type=prism&autoSW=false` default. User clicking the shortcut supplies the launch gesture. Manual address entry still honors the selected engine. |
| Wisp | One configured string reaches both transport APIs. Orbit uses `/wisp/`, Galaxy `/lively/`; Orbit's server and frontend agree on the former. Secure static builds already reject non-wss endpoints; added the same HTTPS check in the browser. Standalone Wisp now also honors Render's `PORT`. |
| WebSockets | Both Node servers delegate the exact upgrade route to wisp-js and do not end accepted sockets. Local initial Wisp packet type 3 verified for both. Browser WebSockets are handled by the pinned transports, not HTTP service-worker routing. No protocol changes. |
| Workers and redirects | Same Prism worker, injection and WASM bytes; SW routing now matches upstream. No changes to bundled redirect rewriting. End-to-end workers/redirects need browser testing. |
| Cookies/storage | Same bundled controller cookie jar, IndexedDB persistence and broadcast synchronization. No storage clearing. Orbit's origin and optional existing about:blank embedding differ from Galaxy; third-party storage behavior may therefore differ. Existing cloaking code was not added or modified. |
| Initialization | Orbit eagerly loads bundles and awaits legacy init at shell startup; Galaxy lazily loads Prism, does initial BareMux preparation even on its Prism route, and launches GFN after a click. Prism itself uses a direct transport, so no speculative additional BareMux connection was added. |
| Tabs | Orbit retains separate live iframes with a shared Prism controller and BareMux connection. Changing transport affects other tabs sharing that controller/connection; this is not per-tab isolation. Galaxy's dedicated GFN app has its own application context. |
| Hosting | Orbit retains Express/static Render plus an optional separate relay. Galaxy uses Fastify/Svelte and custom DNS configuration. Those DNS/blacklist settings were not copied. Orbit's private/loopback protections remain in place. |
| Other UI behavior | Zen-style shell and shortcuts retained. Removing the Prism URL watcher means in-page Prism navigations may not refresh Orbit's address field; adding a safe observer is separate work. Galaxy browser-specific popup interception is not part of the GFN `/api` route and was not imported. |

## Diagnostics

Open Orbit with `?debug=1` and inspect the developer console for `[Orbit]`.
Logs contain fixed stage names, engine/transport choices, Wisp origin (no path,
query or credentials), worker state and initialization results. They do not log
navigation URLs, cookies, raw exceptions, packet payloads or authentication data.
A separate diagnostic Wisp socket opens, waits for its first packet and closes;
`wisp-probe-error`/timeout identifies failure of that probe, not of every socket
inside the WASM transport. The existing third-party bundles have their own logs.

## Validation and local testing

Automated checks: npm installation; JavaScript syntax checks; engine/codec/tab
regression test; service-worker priority/fallback regression test; pinned runtime
byte comparison; static runtime file presence; local Wisp handshakes for both
servers. No authenticated GeForce NOW session or live Render relay was tested.

1. Run `npm install`, `npm run check`, `node --test tests/*.test.js`, `npm run build`.
2. Run `npm start`. Open `http://localhost:8080/?debug=1` on an authorized network,
   not the file:/// HTML page. Existing browser tabs were not reloaded by this task.
3. Click the GeForce NOW tile. Confirm the console selects Prism/direct libcurl
   even if the settings previously selected another engine. Confirm controller
   readiness, then test login, app navigation and game launch manually.
4. Open a second Orbit tab, load an ordinary test page, and switch back. Verify
   neither page was reloaded. Test back/forward and each legacy engine separately.
5. For a separate relay, run `npm run wisp` in another terminal and start Orbit with
   `WISP_URL=ws://localhost:8081/wisp/ PORT=8082 npm start`; open port 8082.
6. For Render static hosting, keep `npm ci && npm run build` and `dist-render`.
   Set build-time `WISP_URL` to your authorized secure relay URL ending in its
   actual endpoint path. Redeploy changed files. Open a fresh site session after
   deployment so the new script and worker can initialize together.

Browser-level compatibility, authenticated cookies/redirects, streaming UDP or
WebRTC constraints, remote relay availability and network policies remain
unverified. A successful build or Wisp handshake does not establish streaming
compatibility and cannot remove an administrator's access restriction.
