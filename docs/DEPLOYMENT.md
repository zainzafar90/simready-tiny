# Deployment

The site is static files on Cloudflare Workers static assets. The optional model mirror is a Cloudflare R2 bucket.

## 1. Configure

Set your values in `public/config.json`:

| Key | Purpose |
|---|---|
| `name`, `subtitle` | Brand in the sidebar and title. The first word is the wordmark; the rest becomes the badge. |
| `siteUrl` | Your public https URL, used for canonical and share-card tags. |
| `modelBaseUrl` | Your model mirror (https). Remove it to load models from Hugging Face. |
| `contactEmail` | Shows a **Request removal** link. Remove it to hide the link. |
| `viewerUrl` | Path of the built viewer (default `/vendor/usd/`). |

The CSP and the viewer's allowed hosts are derived from this file.

In `wrangler.jsonc`, set `name` to your Worker name and either point `routes` at your own custom domain (its zone must be in your Cloudflare account) or remove `routes` to use a `workers.dev` URL. Keep `assets.not_found_handling` at `"none"`: missing files must return 404, not a cached copy of `index.html`. Each build also ships the previous two app versions, so tabs opened before a deploy keep working.

Then regenerate the share image and README logos with your name and domain: `python3 tools/brand/render-brand.py`.

## 2. Build and deploy

```sh
npm run viewer:setup   # once, and after changing tools/viewer
npm run check && npm test
npx wrangler login
npm run deploy
```

`npm run deploy` runs the build and then `wrangler deploy`. It refuses to publish the small preview catalog or a build without the viewer, unless you pass `--allow-preview`.

The build writes `dist/`:

- `index.html` with `%SITE_URL%` filled in from `config.json`
- `app/<hash>/…`: every source module, content-hashed
- `data/catalog.<hash>.json`: only the catalog the manifest points to
- `_headers`: CSP, HSTS, COOP, referrer and permissions policies, and cache rules
- `thumbs/`, `vendor/usd/`, `sw.js`, `og.jpg`, `config.json`

The build fails if the core JavaScript and CSS exceed 32 KiB gzip.

## 3. Model mirror (optional)

Without a mirror, models load from Hugging Face. To host the smaller copies yourself:

1. Create a bucket: `npx wrangler r2 bucket create <bucket>`.
2. Create an R2 **Account API token** with *Object Read & Write* on that bucket, and keep the Access Key ID and Secret Access Key outside the repo (for example `~/.config/<name>/r2.env`, mode 600).
3. Build the manifest and run the converter. Shards can run in parallel on several machines (`box-run.sh` wraps one shard, reads credentials from `R2_ENV`, default `./r2.env`, and pauses processes matching `PAUSE_PATTERN` meanwhile):

   ```sh
   cd tools/preview-models && npm ci
   npm run manifest                    # needs .cache from npm run catalog:sync
   set -a; . ~/.config/<name>/r2.env; set +a
   node src/convert.mjs --shard 1/4    # ... through --shard 4/4
   ```

   Each finished package writes a `_done/` marker, so reruns skip completed work.
4. Write real preview sizes into the catalog: `npm run sizes` (from `tools/preview-models`, with the R2 variables loaded).
5. Edit the origins in `tools/preview-models/r2-cors.json`, then `npx wrangler r2 bucket cors set <bucket> --file tools/preview-models/r2-cors.json`.
6. Connect a custom domain to the bucket (dashboard, or `wrangler r2 bucket domain add`). Use a first-level subdomain, so Cloudflare's free certificate covers it.
7. Set `modelBaseUrl` in `config.json` to that domain, then rebuild and deploy.

The full run is about 245 GB downloaded and 45 GB stored (about $0.50 a month on R2; downloads are free).

## Updating the catalog

```sh
npm run catalog:sync                          # metadata only; resumable
npm run catalog:thumbs -- --confirm-rights    # new thumbnails only
npm test && npm run deploy
```

The sync pins a dataset commit and refuses to shrink an existing catalog by more than 15% unless you pass `--allow-shrink`. A new commit also needs a new mirror run, because mirror paths include the commit.

## Limits and dependencies

- Cloudflare static assets allow at most 20,000 files and 25 MiB per file. This build has about 5,200 files; the largest is the 2.3 MB viewer WASM.
- Hugging Face serves the fallback models and the source links; anonymous traffic is rate limited per IP (about 3,000 file requests per 5 minutes).
- If the zone has Cloudflare bot protection on, Cloudflare injects an inline script that the CSP blocks. It's harmless and only shows as a console warning.
