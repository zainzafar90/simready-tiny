import { createR2, describeError } from './r2-client.mjs';
import { currentCatalog, writeCatalog, isMain } from '../../../scripts/io.mjs';

/* writes previewSizeBytes from R2 done markers */
const CONCURRENCY = 16;

export function applyPreviewSizes(assets, sizes) {
    let updated = 0;
    for (const asset of assets) {
        const bytes = sizes.get(asset.packagePath);
        if (!Number.isFinite(bytes)) continue;
        asset.previewSizeBytes = bytes;
        updated++;
    }
    return updated;
}

async function readSizes(r2, revision, packages) {
    const sizes = new Map(), failures = [];
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < packages.length) {
            const name = packages[next++];
            try {
                sizes.set(name, (await r2.getJSON(`${revision}/_done/${name}.json`)).bytesOut);
            } catch (error) {
                failures.push(`${name}: ${describeError(error)}`);
            }
        }
    }));
    return { sizes, failures };
}

async function main() {
    const catalog = await currentCatalog();
    const packages = [...new Set(catalog.assets.map(a => a.packagePath))];
    const { sizes, failures } = await readSizes(createR2(), catalog.revision, packages);
    const updated = applyPreviewSizes(catalog.assets, sizes);
    await writeCatalog(catalog);
    console.log(`Preview sizes: ${updated}/${catalog.assets.length} assets updated, ${failures.length} packages missing.`);
    for (const failure of failures.slice(0, 10)) console.error(failure);
    if (failures.length) process.exitCode = 1;
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`catalog-sizes: ${describeError(error)}`); process.exitCode = 1; });
