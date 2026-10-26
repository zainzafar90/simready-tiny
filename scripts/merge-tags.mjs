import { resolve } from 'node:path';
import { ROOT, currentCatalog, readJSON, writeCatalog, isMain } from './io.mjs';
import { applyEnrichment } from './catalog-lib.mjs';
export async function mergeTags(file = resolve(ROOT, 'tags.enrichment.json')) {
    const catalog = await currentCatalog(), enrichment = await readJSON(file);
    const result = applyEnrichment(catalog, enrichment);
    await writeCatalog(result);
    console.log(`Merged approved tags for ${result.assets.filter(a => a.ai).length} assets. Original source metadata was not changed.`);
}
if (isMain(import.meta.url))
    mergeTags(process.argv[2] ? resolve(process.argv[2]) : undefined).catch(error => { console.error(error.message); process.exitCode = 1; });
