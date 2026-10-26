# 3D-first asset preview design

Date: 2026-10-26
Status: Approved in conversation; awaiting written-spec review

## Purpose

Simplify the asset preview without changing the rest of the browsing interface. Opening an asset should normally start its interactive 3D preview automatically, communicate real loading progress, and preserve a sharp image as the loading and failure fallback.

## Current findings

- `src/detail.js` currently opens an image-first preview and requires an **Explore in 3D** click.
- The viewer already loads models and textures directly from Hugging Face and reports a loading stage and overall fraction through `onProgress`.
- The built `dist/` catalog still contains the 15-object preview with 184×184 screenshot-derived thumbnails.
- The current source catalog contains 2,575 assets and upstream thumbnail URLs. Sampled upstream PNGs are 1024×1024 despite their `256x256` source-directory names.
- Indexed package sizes vary substantially, so automatic loading needs a large-package confirmation and existing viewer resource limits must remain in place.

## Scope

Change only the asset-preview experience, its viewer adapter, associated styling, tests, and user-facing documentation needed to describe the new behavior. Keep gallery search, cards, filters, collections, saved items, navigation, and the setup command structure unchanged.

## Approaches considered

1. **Progressive 3D-first preview — selected.** Show a sharp source image, automatically load ordinary assets, confirm exceptionally large packages, and replace the image with 3D only when ready.
2. **Always auto-load everything.** Fewer decisions, but undesirable data usage and memory risk for very large packages.
3. **Server-rendered previews.** Consistent images and potentially fast rendering, but introduces a rendering pipeline and backend infrastructure inconsistent with the static-first project.

## Interaction design

### Ordinary assets

For assets whose indexed package size is at most 250 MiB (`250 * 1024 * 1024` bytes), opening the preview immediately:

1. Displays the sharpest available source thumbnail and asset title.
2. Starts loading the same-origin isolated viewer without a second click.
3. Keeps the image visible beneath a compact loading overlay.
4. Replaces the image with the interactive canvas after the viewer reports ready.

Assets with unknown package sizes follow this automatic path and remain subject to the viewer's resource limits.

### Large packages

For assets above 250 MiB, opening the preview displays the sharp image and a single **Load 3D** confirmation labeled with the indexed package size. The model starts only after that confirmation. The label explains that the size refers to the source package; actual preview transfer may differ because the viewer fetches referenced resources selectively.

### Loading

The loading overlay contains:

- The current stage supplied by the viewer, with a generic **Loading model** label when no stage is available.
- A progress bar and percentage derived from the viewer's real `fraction` value.
- An indeterminate progress state when a valid fraction is unavailable.
- A **Cancel** action.

There is no simulated byte counter or fabricated progress. Models and textures continue to come directly from Hugging Face; no proxy or application server is added.

### Ready, stopped, and failed states

- On ready, crossfade from the image to the interactive canvas and show concise orbit/zoom guidance.
- **Stop 3D**, **Cancel**, closing the preview, and previous/next/filmstrip navigation abort outstanding work and dispose of the viewer and iframe.
- Stopping or cancelling restores the image and offers an explicit reload action.
- On failure, retain or restore the sharp image and show a concise error with **Retry** and source-package access. Never leave a blank canvas.
- Remove the **Explore in 3D** button and the **Image preview** badge. Technical details remain in the existing collapsible panel.

## Image behavior

The detail preview prefers `remoteThumbnailUrl` when available and otherwise uses `thumbnailUrl`. If the remote image fails, it falls back to the bundled/local thumbnail when that is a different URL. Gallery cards retain their current thumbnail behavior, avoiding an unnecessary bandwidth increase across the grid.

No upscaling, generated imagery, thumbnail mirroring requirement, or new image pipeline is introduced. Rebuilding `dist/` with the current source catalog removes the stale preview build from the normal production path.

## Implementation boundaries

- `src/detail.js` owns preview lifecycle, automatic-loading decisions, loading/confirmation/error UI, and cleanup.
- `tools/viewer/main.js` forwards the existing progress stage as well as the fraction to the parent preview.
- `src/styles.css` provides the loading overlay, progress, transition, and responsive states using existing theme variables and reduced-motion conventions.
- The viewer remains isolated and loads only for an opened asset; no 3D code is loaded into the gallery grid.
- Existing model-origin validation, texture limits, geometry limits, abort handling, and same-origin iframe restrictions remain intact.

## Error handling and edge cases

- A missing viewer installation produces the existing actionable setup error within the new image-backed failure state.
- A missing model URL leaves the image visible and explains that no verified model is indexed.
- Navigating during viewer probing or model loading invalidates the previous generation so late events cannot mutate the new asset.
- Duplicate load attempts are prevented while a load is active.
- Large-package confirmation is based on `packageSizeBytes`, not the root-layer size.
- Mobile follows the same behavior and thresholds, using the viewer's existing compact resource limits.

## Verification

Update the browser expectations that currently assert image-first/manual-viewer behavior. Add coverage for:

- Automatic loading for an ordinary asset.
- Confirmation for an asset above 250 MiB.
- Real progress message rendering and transition to ready.
- Cancellation, stopping, navigation cleanup, and late-event isolation.
- Failure fallback, retry, missing-viewer behavior, and remote-to-local image fallback.
- Responsive preview layout and reduced-motion behavior.

Run `npm run check`, `npm test`, `npm run test:browser:memory`, and `npm run build`. Build the isolated viewer and, when network and browser facilities permit, smoke-test at least one small real model and one large-package confirmation against Hugging Face. Record any external validation limitation honestly in `docs/STATUS.md` rather than claiming unexercised integration behavior.

## Acceptance criteria

- Clicking an ordinary asset opens the preview and begins 3D loading without another click.
- Packages above 250 MiB require one clearly sized confirmation.
- The preview displays a sharp source-backed image while loading and after failure.
- Loading exposes real stage/progress information and a working cancel action.
- Ready, failure, retry, stop, close, and navigation states leave no stale iframe, viewer, timer, or late status update.
- The gallery and collection workflows remain unchanged.
- The built app includes the new behavior and current catalog, and all listed local checks pass.
