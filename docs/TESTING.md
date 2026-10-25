# Testing and acceptance

## Dependency-free checks

```sh
npm run check
npm test
npm run build
npm run bench
```

`check` runs Node syntax checks on JavaScript modules. `test` covers search, catalog and collection normalization, provenance-safe enrichment, malformed input, paths/URLs, pagination, retry behavior and the real local HTTP server. It does not install or execute the external USD package.

`bench` uses explicitly synthetic catalog records. Do not treat its CPU results as network, browser paint or low-end mobile latency. `build` enforces a 32,768-byte gzip budget for core browse/search JS + CSS, excluding HTML, data, images and the optional viewer.

## Browser checks

The browser suite expects the bundled 15-item preview catalog and no installed viewer. Run it before full setup, or use a separate clean checkout of the archive for fixture tests. It intentionally tests the missing-viewer fallback, not successful remote rendering.

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
npm start
# In another terminal:
npm run test:browser
```

To use a system browser, set `CHROMIUM_EXECUTABLE=/path/to/chromium`. The script writes screenshots and `reports/browser.json`.

The supplied report was generated with:

```sh
npm run test:browser -- --in-memory
```

The authoring environment blocks browser URL navigation and outbound package/data requests. The in-memory harness runs actual application source and a real Web Worker in Chromium, but substitutes network, module loading, location/history, storage, clipboard and image delivery. It verifies DOM behavior, modal focus, keyboard controls, filtering, saved state, collection create/rename/delete, membership editing, backups, navigation, 320px previews and virtualization. It is **not** a substitute for an HTTP-origin deployed E2E test or actual localStorage durability checks.

## Required online acceptance before public launch

- Run full setup and inspect the complete importer report. Spot-check variants, packages without thumbnails and categories against the source.
- Inspect Network: the USD viewer, WASM and model files should not load during ordinary browsing. They should load only after activating interactive 3D.
- Open representative food, industrial and medical assets. Confirm geometry, referenced textures and source warnings; large or unsupported assets should fail with a useful message and a working source link.
- Close/stop previews repeatedly and inspect browser memory/GPU behavior. The iframe is removed, but device-specific memory reclamation must be measured.
- Reload a saved collection; import/export it between browsers. Verify share URLs and browser back/forward from a fresh URL, not only inside the harness.
- Run narrow-phone and slower-device profiling: network transfer, first usable search, long tasks and interaction latency. No Lighthouse score or real-device INP has been measured in this archive.
- Validate headers, CORS, MIME types, missing paths and cache refresh on the actual Cloudflare URL. Check thumbnails with source delivery blocked.
- Enable a small Jev batch only with your key and spending approval; inspect output/usage before scaling. API credentials never belong in a browser bundle.

Read `STATUS.md` for the exact verification boundary.
