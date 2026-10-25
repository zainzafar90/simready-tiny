# Architecture

## Data path

```text
Hugging Face file listing (build/import time)
    -> pinned revision + resumable paginated traversal
    -> filename taxonomy + matching thumbnail/root-layer pairs
    -> approved enrichment overlay
    -> immutable catalog.<hash>.json + small mutable manifest

Browser
    -> static HTML / CSS / native modules
    -> search worker fetches manifest + catalog
    -> weighted inverted index
    -> ranked IDs and facet counts
    -> virtualized grid / list

Explicit "Explore in 3D"
    -> isolated same-origin iframe
    -> separately bundled Hugging Face USD viewer
    -> USD / layers / textures from original host
    -> iframe removed on stop or dialog close
```

The main thread receives catalog records for rendering, while the worker keeps the index and performs matching. At this catalog size, that duplication is an acceptable simplicity/memory tradeoff; benchmark actual data before scaling far beyond 10,000 records. There is no server search API.

## Search contract

Fields are weighted: object name 9, curated aliases 5, tags 4, category 2, description/path 1. Multiple positive terms intersect. Only the final positive term expands as a prefix; typo fallback runs only when exact/prefix matches for that term are absent. Common plurals normalize through a small dictionary and heuristic. This is lexical search, not general semantic understanding or a complete language stemmer.

Quoted phrases use normalized contiguous text. Negative single terms match normalized tokens, not substrings. Facets reflect the other filters before the selected category is applied. Search is debounced by 25 ms and request IDs prevent late results from replacing newer ones.

## Rendering

`VirtualGrid` renders visible rows plus one overscan row on either side. It retains existing nodes rather than recreating every card on scroll. ResizeObserver recalculates columns; requestAnimationFrame schedules painting. Lazy images have explicit aspect ratios. Unchanged results retain scroll and focus when dialogs close.

The page reserves a scroll region for the gallery. Desktop controls stay visible; mobile hides the sidebar in a keyboard-managed drawer. Native `<dialog>` provides modal focus containment. Focus styles, reduced-motion handling and visible labels are present; this is not an independent accessibility certification.

## Catalog ingestion

The importer resolves the branch to a commit, paginates the HF tree endpoint, saves a checkpoint after every page and retries transient errors with backoff. File sizes come from tree metadata, not guesses. Thumbnails match their named USD root layer; top-level `simready_usd` layers remain discoverable without images. Variants are retained as separate asset IDs.

Non-object layers and unmatched structures are reported. The importer does not pretend it can index every possible USD packaging layout: inspect `reports/catalog-sync.json`. Empty catalogs, duplicate IDs, invalid paths and unexpectedly shrinking existing snapshots are rejected. Source updates are manual and reviewable, not silent background jobs.

Asset IDs are source paths, so saved collections can survive pinned revision changes. If an upstream asset moves or disappears, it is omitted from the active collection view. Export backups before major updates.

## Security and privacy

Only public static files are served. No browser API keys, analytics, account system, uploads endpoint or server-side URL proxy exists. Import scripts validate paths and pagination origins. Text is escaped before HTML insertion; the search field is length-limited. User collections contain IDs, not executable markup.

The build emits CSP, MIME-sniffing and referrer protections. The viewer can make remote HTTPS requests for referenced resources; the official viewer validates/parses them. Treat untrusted models as untrusted input and keep its dependency patched. Root viewer URLs are limited to this NVIDIA dataset. Security headers and resource caps reduce risk but are not a security audit.

Favorites and named collections live in localStorage, not a cloud account. Existing `atlas.saved`, `atlas.theme` and `atlas.view` keys remain compatible. `atlas.collections` stores bounded `{ id, name, ids }` records. Collection filters reuse the worker's saved-ID restriction rather than introducing a second search path. Unknown collection memberships are retained through catalog refreshes but omitted from visible results. Asset share links exclude local collection and saved filters.

The full-screen preview keeps an at-most-nine-item window of nearby result thumbnails. Next/previous replaces the current preview history entry; closing goes back to the gallery entry and retains the virtualized scroll position. Downloading a full package is an explicit source link or shell command, not a misleading standalone USD download.

Favorites live in localStorage, not a cloud account. Search works after the catalog loads even if connectivity drops, but this is not a service-worker-backed offline application. Refreshing offline and uncached remote images/models may fail.

## Deliberate omissions

No accounts, billing, model conversion service, vector database, runtime model inference, cross-device sync service or physics simulation. USD physics/material/license fields are not extracted in this version; they remain available only in the original package. This keeps the initial app small and avoids presenting invented facts as verified metadata.
