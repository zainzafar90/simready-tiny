# Testing

## Fast checks (no installs)

```sh
npm run check   # syntax-checks every module in src/, public/, scripts/, tests/, tools/
npm test        # Node unit tests
npm run build   # also enforces the 32 KiB gzip budget for core JS + CSS
npm run bench   # search timings on synthetic catalogs; fails over its limits
```

The unit tests cover search ranking and parsing, catalog normalization, tag merging, collections and imports, URL state and escaping, the load policy, viewer error handling and model sources, the dev server (paths, headers, compression), security headers and CSP, preview markup escaping, the service-worker cache, catalog sync and deploy guards, and site-config rendering. The converter has its own suite: `cd tools/preview-models && npm test`.

## Browser suite

Requires Playwright: `python3 -m pip install playwright && python3 -m playwright install chromium`.

```sh
npm run test:browser:memory           # in-memory harness, 41 checks
npm start                              # then, in another terminal:
npm run test:browser                   # real server, 39 checks
```

Both modes use the 15-object fixture in `tests/fixtures/` (catalog and thumbnails), so results don't depend on the live catalog.

- **In-memory mode** loads the real modules into a blank page, with network, history, storage and clipboard mocked. `tests/browser_harness.py` resolves each module's imports itself. It also covers the clipboard.
- **Real-server mode** runs against `npm start` (or `--url`) and serves the fixture through request routing. It hides the viewer, so the missing-viewer fallback is tested consistently.

Scenarios are grouped in `browser_checks.py` (gallery, search, preview), `browser_collection_checks.py` and `browser_layout_checks.py` (keyboard, history, mobile, and a 2,575-record stress test that fails if typing-to-results takes over 250 ms on a 4× slower CPU). Any uncaught error or `console.error` fails the run. Screenshots and `reports/browser.json` are written to `reports/`.

CI (`.github/workflows/check.yml`) runs all of the above on every pull request and push to `main`.

## Live and performance checks

These hit real networks and are not part of the automatic suite:

- `python3 tools/perf/mobile-perf.py` emulates a phone on 4G, fast 3G and slow 3G, and measures the gallery and 3D loads (Hugging Face vs mirror). Start `node scripts/serve.mjs --port 4175` first.
- `python3 tools/demo/record-walkthrough.py` records a user-style walkthrough to `reports/video/walkthrough.mp4`.

Before a public launch, also open a few large and small models on the deployed domain, try a slow connection, and confirm headers with `curl -I`.
