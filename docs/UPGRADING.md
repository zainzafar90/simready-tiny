# Upgrade from the previous Atlas archive

## Fresh start

Extract `simready-atlas-gallery.zip` into a new folder and run `npm start` inside `simready-atlas/`. The archive contains source, a prebuilt `dist/`, and the 15-object local preview. Node 22.12+ is sufficient; no package install is required to browse.

## Keep a catalog or viewer you already imported

Back up the existing folder. Do not overwrite your generated catalog with the bundled preview.

Copy these new source files/directories into the existing project:

```text
index.html
src/                         entire directory, including collections.js
package.json
scripts/build.mjs
tests/
docs/
README.md
START_HERE.md
CHANGELOG.md
```

Keep your existing `public/data/`, `public/catalog-manifest.json`, `public/thumbs/`, `public/vendor/`, `.env`, tags/enrichment output and custom `wrangler.jsonc`. `public/config.json` still uses the same schema; the new archive capitalizes the default brand to “Atlas.” Preserve your own branding instead if already customized.

Rebuild, then test:

```sh
npm run check
npm test
npm run build
npm start
```

The browser fixture suite expects the 15-object preview and no installed viewer; run that suite from the clean new archive, not the catalog you already imported. Manually verify the upgraded full catalog on its real origin before deployment.

## Browser data

`atlas.saved`, `atlas.theme` and `atlas.view` retain the same keys. Explicit old dark-mode preferences are honored. New named collections use `atlas.collections`.

Storage belongs to the origin. `localhost:4173`, `127.0.0.1:4173`, another port and your deployed domain have separate libraries. Use **Help & shortcuts → Export library / Import library** to move your saved objects and collections across origins.

No automatic cloud sync, account migration or database is involved.
