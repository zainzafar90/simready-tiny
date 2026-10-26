# Changelog

## Unreleased — Faster previews

- 3D previews load from a self-hosted R2 mirror (`simready-models.zainzafar.net`) with 1024px textures: 233 GB → 43 GB (81% smaller), 2–3× faster loads, no Hugging Face rate limits. Hugging Face remains the automatic fallback.
- `tools/preview-models/` converts the catalog in shards (resumable, per-package done markers) and writes real preview sizes into the catalog; only 14 models now exceed 250 MB.
- Transient viewer errors retry once with a plain message; an instant CSS tooltip explains the **Large** tag.
- Opening an object loads its 3D model automatically, over a sharp image, with real progress. Auto-load adapts to the connection (250 MB fast, 100 MB slow or unknown phone, 25 MB 3G, 5–10 MB 2G, never with Data Saver); larger packages show one **Load 3D · size** button. Failures keep the image and offer **Retry**.
- Removed the Explore/Stop 3D buttons, image badge, keyboard hint row, and repeated warnings.
- `catalog:thumbs` now writes 512 px and 1024 px WebP thumbnails (~35 KB per asset instead of ~836 KB PNG).
- `public/sw.js` caches revision-pinned Hugging Face files, so reopening a model skips the network.
- Viewer fetches 8 files at once instead of 4.
- Smaller gallery cards: 4–7 columns on laptop and desktop screens.
- Cards show full package size; a **Large** tag (with tooltip) marks models that won't auto-load on the current connection. Sizes within 10% of the limit still auto-load.
- Skeleton placeholders while the catalog and images load.
- Preview toolbar is now Download, ⋯ (details, add to collection, copy link) and Save.
- Removed filler copy; the page intro now says where models come from and what you can do.
- Removed the Help dialog, All/Saved tabs, back/forward arrows, bottom status bar, Format filter, USD chip, category reset and duplicate New collection button. Export/Import moved to the sidebar footer; sorting is an inline dropdown on the title row; a × beside the title clears the category.

## 1.1.0 — Gallery edition (2026-10-26)

### Presentation

Light-first neutral palette; narrow sidebar; persistent compact search; large square previews with visible names; collapsible format/sort filters; saved tab; cleaner list view. The promotional header and always-visible technical controls are removed. Dark mode remains optional.

### Full-screen preview

Centered media, bounded nine-result thumbnail strip, previous/next controls, arrow keys, save shortcut, copy link, package download menu, and an optional metadata panel. Mobile uses a two-row toolbar and a details sheet. Model loading remains explicit. Closing, switching, or stopping removes the viewer; an in-flight viewer probe is abortable.

### Collections

Named local collections with create, rename, confirmed delete, and multi-collection membership. Version-2 export includes collections and saved IDs; old saved-only imports still work. Unknown source IDs are retained in collection data for future catalog sync. Canonical shared asset links do not depend on someone else's local collections.

### Performance and verification

Core browse/search code and styles remain dependency-free. One overscan row each side; bounded thumbnail navigation; 32 KiB gzip build budget. Actual report: 73 Node tests, 39 Chromium harness checks, 16 mounted desktop cards for a 2,575-record synthetic fixture. See `docs/STATUS.md` for test boundaries and `reports/` for raw results.

### Unchanged boundaries

The included catalog still contains 15 screenshot-derived real preview objects. Full source import, external USD rendering, Jev API calls and Cloudflare deployment require online setup and validation. No full dataset, simulator, account service or scene editor has been added.
