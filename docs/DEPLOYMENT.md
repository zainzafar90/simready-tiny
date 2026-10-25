# Cloudflare deployment

The project publishes static HTML, JavaScript, CSS, metadata and any local thumbnails. It does not require an application Worker, D1, KV, R2, a server process, or an AI key to search. Large models remain on Hugging Face.

## Before publishing

1. Run `npm run setup` on a network-connected machine. Inspect `reports/catalog-sync.json` and resolve unexpected omissions or counts.
2. Review source/package licenses and service usage terms. Replace the screenshot-derived preview thumbnails before public redistribution.
3. Run `npm run check`, `npm test`, `npm run build` and the live acceptance checks in `TESTING.md`.
4. Test direct thumbnail loading and several interactive USD previews from the deployment origin. CORS, redirects, model dependencies and browser GPU limits can differ from a local run.

## Deploy

Change `name` in `wrangler.jsonc` to the application name you want in your account, then:

```sh
npm run deploy
```

The script builds `dist/` and invokes `npx --yes wrangler@4 deploy`. Wrangler may request authentication. No account, billing change or deployment was performed by the authoring process. Keep account tokens in your shell/CI secret store, never in public files.

The convenience command resolves the latest Wrangler major-4 release. For repeatable CI, pin and lock an approved exact Wrangler version in your own repository. Likewise, commit the optional viewer's generated lockfile after a successful installation; only its direct versions could be pinned in this offline archive.

## Deliberate preview deployment

```sh
npm run deploy -- --allow-preview
```

This explicitly bypasses both the full-catalog and viewer-bundle checks. It is for reviewing the included demo, not for silently publishing a supposedly complete collection. The preview notice remains visible.

## Updates and caching

```sh
npm run catalog:sync
npm test
npm run deploy
```

HTML, config and catalog manifest are revalidated. App files and catalog files have content-hashed paths with immutable cache headers. `_headers` also supplies security/referrer controls. A rebuild is required for changed tags, source or data; editing `public/` alone does not update a deployed site.

The importer pins one commit and stores `.cache/tree-<commit>.json`. Retry a failed command to resume. `--fresh` re-fetches a listing; `--revision <commit>` reproduces a previous snapshot. `--allow-shrink` is an explicit override only after inspecting why a catalog shrank more than the default safety threshold.

## Operational limits

Cloudflare's static asset quotas and per-file limits still apply, especially to the optional WASM bundle. Inspect the built output before publishing. Do not work around quotas by assuming the entire 472 GB collection belongs in the static upload. Use separate model hosting if you later decide to mirror it.

Hugging Face serving, rate limits, CORS and upstream availability remain dependencies. A mirror or proxy is not automatically authorized by public access. R2 is not required by this app; adding it changes cost, licensing and cache architecture and should be a separate decision.

## Costs

No model storage is allocated by the supplied deployment, and no API inference runs on search. This is not a promise of a permanently zero bill: check current Cloudflare plan limits, optional domains, source delivery terms and any manually enabled Jev usage. Official references are in `SOURCES.md`.
