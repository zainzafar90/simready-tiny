# Delivery and verification status

Prepared 2026-10-26 · Gallery edition 1.1.0. This is an implemented application with a reproducible local test package, not a claim that third-party integrations were deployed and certified.

## Implemented and exercised here

The light-first reference-inspired interface, full-screen image preview, nine-item filmstrip, named-collection create/rename/delete and membership editing, library import/export, virtualized grid/list, category and format filters, ranking/typo matching, save controls, import normalization, detail dialog, keyboard controls, mobile drawer, light/dark themes, share-state serialization and source/download command UI.

The core build, content hashes, gzip budget, Node static server, security-header generation, catalog fixture processing, pagination/retry mocks, source-preserving tag merges and Jev response normalization.

73 Node tests pass. 39 Chromium interaction checks pass. The browser checks use an in-memory harness with a real worker and mocked environment I/O. See `reports/unit-tests.tap` and `reports/browser.json`. Syntax checks are not TypeScript typechecks, and browser interaction tests are not an independent accessibility/security audit.

## Included, but not live-validated here

| Integration | Included work | Remaining validation |
| --- | --- | --- |
| Full NVIDIA catalog | Commit-pinned, paginated, resumable importer and issue report | Real complete endpoint traversal and catalog coverage |
| Interactive USD | Official-library adapter, lazy iframe, load limits, warnings, disposal path, Vite config | Install exact packages, compile WASM assets, load real remote models and textures |
| Jev | Dry-run CLI, structured questions, optional image adapter, caching/checkpoints, review gate | Authorized API call, current response compatibility, accuracy and billing |
| Cloudflare | Build output, `_headers`, Wrangler config, deployment guard | Account authentication, deployment, live cache/CORS/browser behavior |

The execution environment could not resolve external package/data hosts, and managed Chromium disallowed URL navigation. No workarounds to those restrictions were applied. Tests therefore use local HTTP requests from Node and the explicitly described browser harness.

## Included data

15 genuine object previews and source paths, with thumbnails cropped from the user's supplied reference screenshot. They are clearly marked preview data and are not a fabricated 2,575-entry catalog. The 2,575- and 10,000-record datasets in performance tests are synthetic fixtures and are never published as model assets.

Run `npm run setup` online to replace the preview catalog and install the viewer. Source enumeration is intentionally automated rather than manually fabricating unknown asset metadata. Inspect its report before removing the remaining online validation tasks from your own release checklist.

## Not included

Model files, physics simulation/training, verified physical-property extraction, verified redistribution licenses, cloud accounts, secrets, production uptime or performance guarantees. The original claim that every asset has reliable physical metadata has not been independently validated by this app.
