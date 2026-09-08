# Galaxy v7 proxy runtime

Source: https://gitlab.com/Hydra.Network/galaxy/galaxyv7
Pinned revision: a7b99031a0ffba0245cad2350ac5cab77fdc6cbd

The public prism/, poly/, and glass/ assets are copied unchanged from that revision.
The URL codec is from src/lib/lethe/codec.js, exposed as a browser global.
Orbit's integration adapts the three-engine service worker and controller setup,
retaining Orbit's interface and separately hosted Wisp endpoint.

Galaxy's desktop, games library, account/settings system, and popup plugin are
not included. Upstream has no top-level LICENSE file at this revision; this
notice does not grant or replace upstream/component licenses. Review upstream
permissions before redistributing these bundles beyond your own deployment.
