# Atlas — Gallery edition

Version 1.1.0 · Light-first, image-led browsing.

A static-first browser for NVIDIA's SimReady objects. Search locally, browse a virtualized gallery, save a collection, inspect an asset, and open its source package. Heavy 3D code and models load only after an explicit click.

**Status:** the browse/search application is implemented and tested. The archive includes **15 real preview objects**, not the full NVIDIA catalog. The full catalog importer, isolated USD viewer adapter, Jev adapter, and Cloudflare deployment are included, but their live external integrations could not be executed in the build environment. See [verification status](docs/STATUS.md).

![Desktop preview](reports/desktop.png)

## Start immediately

Requires **Node.js 22.12 or newer**. No dependency installation is needed for the gallery, search, tests, or core build.

```sh
unzip simready-atlas-gallery.zip
cd simready-atlas
npm start
```

Open **http://localhost:4173**. The bundled previews are local; search and saved collections work without Hugging Face. Use the development server, not `file://`.

## Enable the full source catalog and interactive 3D

On your network-connected machine:

```sh
npm run setup
npm start
```

`setup` performs two independent steps:

1. Pins the current Hugging Face dataset commit, walks its paginated file listing, and generates the complete discoverable asset catalog. It downloads metadata, **not the 472 GB of models and textures**. Inspect `reports/catalog-sync.json` for counts and excluded or unmatched paths.
2. Installs and builds the optional Hugging Face USD viewer into `public/vendor/usd/`. It is not imported by the browsing interface.

The bundled preview banner disappears after a successful catalog sync. If either step fails, the existing catalog and the core app remain usable. Retry a step independently:

```sh
npm run catalog:sync
npm run viewer:setup
```

The importer intentionally does not hardcode a count of 2,575. Source changes, variants and unsupported layouts can make its count differ from the Hub's gallery. Review its report before publishing.

## The new interface

A narrow neutral sidebar, compact persistent search, generous square object cards, and a full-screen preview. The large promotional header has been removed. Technical information stays in an optional details panel.

- **Browse:** worker search, categories, optional format/sort panel, grid/list, heart-to-save, and session back/forward.
- **Preview:** nearby-results strip (at most nine thumbnails), previous/next buttons, arrow keys, share, source download options, and explicit **Explore in 3D**.
- **Organize:** create/rename/delete named collections, edit membership from a preview, and export/import the whole local library. No account required.
- **Mobile:** two columns, navigation drawer, compact preview toolbar, and details sheet. Light by default, with optional dark mode.

These are the real dataset previews, not the cartoon artwork in the design reference. Their existing backgrounds and resolution are preserved. The 15 bundled images are small screenshot crops; syncing retrieves source thumbnail URLs, not new studio renders.

See [CHANGELOG.md](CHANGELOG.md) and [docs/UPGRADING.md](docs/UPGRADING.md) when merging this into an existing setup.

## What is implemented

| Area | Behavior |
| --- | --- |
| Search | Weighted local index in a Web Worker; prefixes, typo fallback, quoted phrases, exclusions, curated synonyms |
| Browsing | Virtualized grid/list, category counts, format filters, name/root-layer-size sorting, lazy images |
| Navigation | Keyboard shortcuts and arrow navigation, mobile filter drawer, focus-trapped details, shareable query and asset URLs |
| Collection | Local saved assets + named collections, JSON export/import, cross-tab updates; no account required |
| Details | Tags with provenance, file/package distinction, source links, full-package download command |
| 3D | Explicit-click isolated viewer, load limits, progress, stop/cleanup, source fallback; external integration needs online validation |
| Tagging | Filename taxonomy out of the box; optional review-gated Jev batch suggestions |
| Delivery | Content-hashed app/catalog, cache and security headers, static Cloudflare configuration, deploy safeguards |

Search examples: `banana`, `bannana`, `storage`, `"frying pan"`, `medical -glove`.

## Architecture choice

The gallery uses **native JavaScript modules + CSS + Web Workers**, rather than carrying the starter's React runtime for this small, mostly read-only interface. The core has no package dependencies and no bundler requirement. Source is formatted, separated by responsibility, and directly editable.

Vite is used **only for the separately installed USD viewer**. There is no database, application server, vector service, or AI call on the search path. Model and texture delivery stays with Hugging Face; third-party availability and usage terms still apply.

## Tagging

You do not need Jev to launch. Filenames and the curated taxonomy already supply object names, categories, tags and aliases. Jev is an optional batch classifier, not a per-search dependency.

```sh
cp .env.example .env
# Add TYPESAFE_API_KEY only when using the optional paid API.

npm run tag:jev -- --limit 10          # dry run; no API requests
npm run tag:jev -- --limit 10 --execute
# Review tags.enrichment.json and change accepted entries to status: "approved".
npm run catalog:tags
```

Visual tagging is opt-in and uses Jev's experimental image API. See [TAGGING.md](docs/TAGGING.md) for image setup, controls, review and limitations. Nothing infers physical properties or licensing from thumbnails.

## Test, build, deploy

```sh
npm run check
npm test
npm run bench
npm run build
npm run preview                      # serves the generated dist/
```

The archive includes a built `dist/`, but it is still the preview catalog. Rebuild after any source, catalog or tagging change.

After online setup and the checks in [DEPLOYMENT.md](docs/DEPLOYMENT.md):

```sh
npm run deploy
```

This builds the app and invokes Wrangler; authentication uses your Cloudflare account. Deployment refuses a preview-only catalog or missing viewer unless you explicitly pass `--allow-preview`. No credentials or deployment are included in the archive.

## Measured, not assumed

See the machine-readable results in `reports/` and [PERFORMANCE.md](docs/PERFORMANCE.md). The current build is approximately **22.8 KiB gzip for the browse/search JavaScript and CSS**, excluding HTML, catalog JSON, thumbnails and the optional viewer. The 2,575-record synthetic browser stress check mounted **16 cards**, not 2,575.

The archive's browser checks use Chromium with the actual UI and search worker but mocked network/storage/history in an in-memory harness. They are not a deployed end-to-end or mobile-device performance certification.

## Modify it

Start with [EDITING.md](docs/EDITING.md). Main files:

```text
index.html                  Shell, labels, page layout
src/styles.css              Theme tokens and responsive styling
src/app.js                  UI state and interactions
src/virtual-grid.js         Windowed gallery and keyboard navigation
src/search-engine.js        Search weights, matching and ranking
src/detail.js               Full-screen preview, filmstrip and viewer lifecycle
src/collections.js          Collection normalization and merge rules
scripts/catalog-lib.mjs     Categories, aliases, source normalization
scripts/sync-catalog.mjs    Hugging Face catalog ingestion
scripts/jev-lib.mjs         Jev question schema and review normalization
public/config.json          Brand name, subtitle, viewer entry
public/data/                Generated, content-addressed catalog
public/thumbs/              Preview images / optional mirrored thumbnails
tools/viewer/               Optional Vite + USD viewer application
docs/                       Architecture, tagging, deployment and verification
```

## Rights and boundaries

Atlas is independent of NVIDIA and Hugging Face. The MIT license in this archive applies to the original application code, **not** NVIDIA's models, thumbnails, trademarks, or third-party dependencies. The bundled thumbnails were cropped from the user-provided reference screenshot for local preview. Replace them with appropriately licensed source previews before public redistribution. The application deliberately shows source license/physical properties as unverified.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [docs/SOURCES.md](docs/SOURCES.md). Do not treat public file availability as permission to redistribute, or visual 3D rendering as validation of simulation behavior.
