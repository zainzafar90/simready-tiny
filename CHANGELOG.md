# Changelog

## 2.0.0 — SimReady Tiny (2026-10-26)

Renamed from Atlas. Live at [simready.zainzafar.net](https://simready.zainzafar.net).

### 3D previews

- Opening an object loads its 3D model automatically, over a sharp 1024px image, with real progress.
- Network-aware auto-load limit: 250 MB on fast links, 100 MB on phones, 25 MB on 3G, 5–10 MB on 2G, never with Data Saver. Larger models show **Load 3D · size**, and their cards get a **Large** tag with an instant tooltip.
- Models load from a self-hosted R2 mirror with textures capped at 1024px: 245 GB → 45 GB (81% smaller), 2–3× faster. Hugging Face is the automatic fallback.
- Network errors retry once, then fall back to the original source, before showing a plain error with **Retry**.
- A service worker caches revision-pinned model files, so reopening a model is near-instant.

### Gallery and UI

- Full catalog of 2,575 objects with self-hosted WebP thumbnails (~32 KB per object instead of ~836 KB PNG).
- Padded card tiles in 4–7 columns, skeleton loading, one media grey shared by the cards, preview and viewer, and a **TINY** wordmark badge.
- Cards show the real 3D preview size. Sorting by size uses the same number.
- Simpler chrome: no Help dialog, tabs, history arrows, status bar, format filter or duplicate buttons. Sort sits on the title row, Export/Import is in the sidebar footer, and the preview toolbar is Download, ⋯ and Save.
- The details panel opens by default on desktop and remembers if you close it.
- Attribution banner (NVIDIA SimReady, CC BY 4.0, not affiliated) with an optional **Request removal** link, plus an OG image and social tags.

### Engineering

- Code organized into domain folders (`app`, `gallery`, `preview`, `library`, `search`, `shared`); no JavaScript file over 200 lines.
- Fork-friendly: `config.json` sets the site URL, model mirror and contact. The viewer allowlist and CSP follow it.
- Security: an independent audit found no critical issues or XSS. The fixes include upgraded `sharp` and Vite, path validation and streaming size caps in the converter, a bounded model cache, a CSP limited to the mirror and Hugging Face, and HSTS and COOP.
- Tooling: model mirror converter (sharded, resumable), thumbnail converter, mobile/3G performance runner, walkthrough recorder, OG image renderer.
- Tests: 104 unit tests, 13 converter tests, and the browser suite (41 checks in memory, 39 against a real server) on a dedicated fixture. CI runs all of them.

## 1.1.0 — Gallery edition (2026-10-26)

Light-first gallery with a narrow sidebar and persistent search. Full-screen preview with a nine-item filmstrip, keyboard navigation and a details panel. Named local collections with export/import. Virtualized grid and a 32 KiB core budget. 3D was opt-in behind **Explore in 3D**, and the bundled catalog was a 15-object demo.
