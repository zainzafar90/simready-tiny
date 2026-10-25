# Tagging without slowing down search

## Start without AI

Every imported asset gets labels from its filename and a curated taxonomy. For example, `food_produce_banana_m01` becomes a readable banana entry in Food & produce. Categories and aliases are maintained in `scripts/catalog-lib.mjs`.

These are discovery labels, not evidence about physical behavior. The importer currently reads file listing metadata, not every USD layer's properties. It does not validate weight, material composition, center of mass, friction, licensing, collision configuration or robot suitability.

## Optional Jev enrichment

The integration uses Jev as a typed classifier. It asks about browsing category and plausible environment; optional image mode also asks about visible color and shape. It does not generate long prose captions. Categories remain the deterministic taxonomy's value; a category answer is retained for review, not allowed to overwrite it.

```sh
cp .env.example .env
# Set TYPESAFE_API_KEY in .env. It is ignored by Git and never copied to dist/.
# JEV_MODEL defaults to jev-latest; pin a model if reproducibility is important.

npm run tag:jev -- --limit 10
npm run tag:jev -- --limit 10 --execute
```

The first command prints the plan and makes no requests. `--execute` explicitly enables paid requests. The default batch size is 20 or the catalog length, whichever is smaller. Increase `--limit` after inspecting a small batch. Results are checkpointed after each successful item. An unchanged input hash is skipped on subsequent runs. Remove an entry's `inputHash` to force a fresh review of that asset. Keep a backup of accepted entries.

The script calls the documented `/v1/systemone` endpoint with structured Choice questions and reads `answers`, `choice`, `confidence` and `usage`. A confidence threshold of 0.85 filters proposed tags; that score is **not** a calibrated guarantee. Every result is still `pending-review`.

## Visual mode is experimental

TypeSafe currently labels image functionality experimental and requires an explicit image header. Its documented minimum image dimensions exceed the dataset's 256px previews. The adapter opts in only with `--images`, loads the source PNG, and resizes/pads to 320 × 320. Upscaling satisfies the API input size requirement; it does not add visual detail or improve image evidence.

```sh
npm install --prefix tools/tagger
npm run tag:jev -- --images --limit 10          # dry run
npm run tag:jev -- --images --limit 10 --execute
```

This installs Sharp only for the CLI, not the browser. Source URLs need to be reachable. No API calls were executed in the authoring environment, so validate a small batch and its charges before increasing the limit. Retried POST requests can incur additional charges. Visual suggestions are aids, never proof of real material or physical properties.

## Review and publish

`tags.enrichment.json` is a complete overlay keyed by asset ID:

```json
{
  "food_produce_banana_m01/simready_usd/sm_food_produce_banana_m01_01.usd": {
    "tags": ["yellow", "curved"],
    "aliases": ["banana fruit"],
    "provider": "manual-review",
    "status": "approved"
  }
}
```

Review names, images and suggested tags. Change only accepted entries to `"approved"`; remove questionable labels and leave other entries pending or rejected.

```sh
npm run catalog:tags
npm run build
```

The merger accepts only tags and aliases from approved entries. Source URLs, identity, taxonomy category, file sizes, physics and licensing cannot be overwritten. Values are type-checked, length-limited and deduplicated. AI tags are shown separately in the details panel. Changes replace old AI-only tags rather than accumulating stale suggestions. Entries absent from the overlay are removed as AI contributions on remerge; keep the full overlay as the source of truth.

Commit the reviewed overlay to your own repository if useful. Never commit `.env`.

## Optional local thumbnails

The gallery otherwise loads source thumbnails directly. After verifying your redistribution rights, mirror thumbnails only:

```sh
npm run catalog:thumbs -- --confirm-rights
npm run build
```

`--limit 20` can test a small subset. This avoids mirroring model data, but it does not grant any redistribution license. Check public asset-hosting limits and the deployment report when adding many local files.
