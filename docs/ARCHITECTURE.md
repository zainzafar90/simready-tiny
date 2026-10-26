# Architecture

SimReady Tiny is a static site. There is no application server, database or search API. Everything below runs in the browser or as an offline script.

## Data flow

```text
Offline (scripts/)
  Hugging Face file listing (pinned commit)
    -> catalog-lib: entry layers, thumbnails, labels, package sizes
    -> optional reviewed tag overlay (tags.enrichment.json)
    -> public/data/catalog.<hash>.json + public/catalog-manifest.json
  mirror-thumbs: source PNG -> public/thumbs/<hash>-512.webp / -1024.webp
  tools/preview-models: model files -> 1024px textures -> R2 mirror

Browser
  index.html + src/app.js
    -> search worker loads manifest + catalog, builds the index
    -> virtual grid renders visible cards only
    -> preview dialog (lazy module) -> viewer iframe (/vendor/usd/)
         -> model files from the R2 mirror, else Hugging Face
         -> public/sw.js caches revision-pinned files
```

## Source layout

| Folder | Responsibility |
|---|---|
| `src/app/` | Page state (`app-store`), rendering, search client, events, collection dialogs, preview controller, sidebar, site config |
| `src/gallery/` | `VirtualGrid`: windowed rendering, keyboard navigation, skeletons, size tags |
| `src/preview/` | Preview dialog (markup, menus, controls), viewer lifecycle, network-aware load policy |
| `src/library/` | Collection normalization/merge rules and saved-item import validation |
| `src/search/` | Search engine and its Web Worker |
| `src/shared/` | HTML escaping and URL checks, formatting, storage, URL state, icons |

`src/app.js` only wires these together. Every module is a native ES module; there is no bundler for the app itself.

## Search

The worker owns the index; the main thread gets ranked IDs and category counts. Fields are weighted: name 9, aliases 5, tags 4, category 2, description and path 1. Multiple terms intersect. The last term also matches as a prefix, and typo matching only runs when a term has no exact or prefix match. Quoted phrases and `-exclusions` are supported. Input is debounced by 25 ms, and request IDs drop late results.

## Rendering

`VirtualGrid` mounts only the visible rows plus one row above and below, and keeps existing card nodes while scrolling. Columns come from the container width (minimum 200px on desktop, 140px on phones). Thumbnails are 512px WebP; the preview uses the 1024px version. Native `<dialog>` handles modal focus.

## 3D preview

Opening an object shows its 1024px image immediately, then loads the model in a same-origin iframe (`tools/viewer`, built on `@huggingface/usd-web-viewer`):

1. **Load policy** (`src/preview/load-policy.js`): models auto-load up to a limit that depends on the connection — 250 MB on fast links, 100 MB on phones, 25 MB on 3G, 5–10 MB on 2G or under 1 Mbit/s, and never with Data Saver. Sizes within 10% of the limit still auto-load. Bigger models show **Load 3D · size**, and their cards get a **Large** tag. Sizes are the real mirrored preview sizes from the catalog (`previewSizeBytes`).
2. **Sources** (`modelSources`): the mirror at `modelBaseUrl` first, then the original Hugging Face URL.
3. **Recovery**: a network-type failure retries once; if the mirror still fails, the viewer switches to Hugging Face; only then does the user see an error with **Retry**.
4. **Isolation**: the viewer only accepts the configured mirror (with a 40-character commit path) or the NVIDIA dataset on Hugging Face. Parent and viewer talk via `postMessage`, checked against the exact iframe window and origin. Closing or switching previews removes the iframe.

## Caching

- App files (`/app/<hash>/`) and catalogs (`/data/catalog.<hash>.json`) are content-addressed and cached for a year. HTML, `config.json` and the manifest are revalidated on every load.
- `public/sw.js` caches model files whose URL contains a pinned dataset commit, so reopening a model costs no network. It skips files over 512 MB and keeps the cache under 2 GB or half of the browser quota, whichever is smaller.
- R2 objects are served with `Cache-Control: immutable`.

## Local data

Saved items, collections and preferences live in `localStorage` under `atlas.saved`, `atlas.collections`, `atlas.view`, `atlas.theme` and `atlas.details`. The key names predate the rename and are kept so existing libraries keep working. Storage is per origin; **Export / Import** moves a library between browsers. Imports are capped at 5 MB, IDs are filtered against the catalog, and collections are rebuilt field by field.

## Security model

- All dynamic HTML is escaped (`src/shared/html.js`); links and images go through `safeUrl`, which only allows https or same-origin paths.
- The CSP is generated from `config.json` (`scripts/serve.mjs`): scripts from the site only, plus `wasm-unsafe-eval` for the viewer's WASM; network and images only from the site, the mirror and Hugging Face; no plugins, forms or external framing. Deployed headers add HSTS and COOP.
- No API keys ship to the browser. Tooling secrets (R2, Jev) come from environment variables or `.env` files that are git-ignored.
- The offline converter validates every dataset path, sniffs image content before decoding, and caps download sizes while streaming.

## Deliberate omissions

No accounts, analytics, server-side search, model conversion service or physics simulation. Physical properties, materials and licenses are not extracted from USD files; the preview links to the original package for those.
