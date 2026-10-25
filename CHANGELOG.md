# Changelog

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
