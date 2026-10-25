# Start here — Gallery edition 1.1.0

## Open the included app

Node.js 22.12+ is the only prerequisite for the core app.

```sh
cd simready-atlas
npm start
```

Visit http://localhost:4173. This opens the working 15-object local preview.

## Replace the preview with the real source catalog

```sh
npm run setup
npm start
```

Run setup while online. It fetches the dataset's file metadata and builds the optional USD viewer; it does not download the entire model collection. This setup was not able to run in the authoring environment. Inspect `reports/catalog-sync.json` and try several 3D models before publishing.

## Already have the previous archive?

Keep the old folder as a backup. See `docs/UPGRADING.md` before copying files over an imported catalog. Browser-saved objects remain compatible when served from the same origin.

## Change the design

Edit `src/styles.css` and `index.html`, then refresh. Brand name and subtitle are in `public/config.json`. More in `docs/EDITING.md`.

## Publish after online validation

```sh
npm run deploy
```

Wrangler uses your own Cloudflare account. Domain setup is optional. Preview-only publishing needs explicit `npm run deploy -- --allow-preview` and is not a full-catalog launch.

## Read next

`README.md` explains features and commands. `docs/STATUS.md` distinguishes tested behavior from unverified external integrations. `docs/TAGGING.md` explains optional Jev enrichment and review.
