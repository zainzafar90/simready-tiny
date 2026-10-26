import { resolve } from 'node:path';
import { DATASET, normalizeCatalog, applyEnrichment } from './catalog-lib.mjs';
import { ROOT, atomicJSON, readJSON, writeCatalog, currentCatalog, arg, flag, loadEnv, isMain } from './io.mjs';
import { fetchWithRetry, nextLink } from './http.mjs';
export async function crawlTree({ revision, origin = 'https://huggingface.co', fetcher = fetchWithRetry, checkpoint = async () => { }, resume = null, log = console.log }) {
    let url = resume?.next || `${origin}/api/datasets/${DATASET}/tree/${encodeURIComponent(revision)}?recursive=true&limit=1000`;
    const entries = resume?.entries || [], seen = new Set();
    let pages = resume?.pages || 0;
    if (resume?.complete)
        return resume.entries;
    while (url) {
        if (seen.has(url))
            throw new Error('Pagination loop detected');
        seen.add(url);
        const parsed = new URL(url);
        if (parsed.origin !== origin || !parsed.pathname.startsWith(`/api/datasets/${DATASET}/tree/`))
            throw new Error('Unsafe tree pagination URL');
        const response = await fetcher(url);
        const batch = await response.json();
        if (!Array.isArray(batch))
            throw new Error('Unexpected Hugging Face tree response');
        entries.push(...batch);
        pages++;
        if (pages > 5000)
            throw new Error('Safety stop: over 5,000 tree pages. Catalog was not changed.');
        url = nextLink(response.headers.get('link'), origin);
        await checkpoint({ revision, next: url, complete: !url, entries, pages });
        log(`  ${pages} pages · ${entries.length.toLocaleString()} file/directory records`);
    }
    return entries;
}
export async function syncCatalog() {
    await loadEnv();
    const headers = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};
    const fetcher = url => fetchWithRetry(url, { headers });
    let revision = arg('--revision', 'main');
    console.log('Importing NVIDIA SimReady metadata. No model or texture files are downloaded.');
    if (!/^[a-f0-9]{40}$/i.test(revision)) {
        const info = await (await fetcher(`https://huggingface.co/api/datasets/${DATASET}/revision/${encodeURIComponent(revision)}`)).json();
        if (!/^[a-f0-9]{40}$/i.test(info.sha || ''))
            throw new Error('Could not pin a dataset commit. Catalog left unchanged.');
        revision = info.sha;
    }
    const cache = resolve(ROOT, '.cache', `tree-${revision}.json`);
    const resume = flag('--fresh') ? null : await readJSON(cache, null);
    const entries = await crawlTree({ revision, fetcher, resume, checkpoint: state => atomicJSON(cache, state) });
    let catalog = normalizeCatalog(entries, revision);
    const enrichment = await readJSON(resolve(ROOT, 'tags.enrichment.json'), {});
    catalog = applyEnrichment(catalog, enrichment);
    const previous = await currentCatalog().catch(error => {
        if (error.code === 'ENOENT') return null;
        throw new Error(`Existing catalog is unreadable: ${error.message}`, { cause: error });
    });
    /* fail closed on incomplete snapshots */
    if (previous?.mode === 'snapshot' && catalog.assets.length < previous.assets.length * .85 && !flag('--allow-shrink'))
        throw new Error(`Catalog shrank from ${previous.assets.length} to ${catalog.assets.length}. Inspect .cache and retry with --allow-shrink only after review.`);
    const url = await writeCatalog(catalog);
    await atomicJSON(resolve(ROOT, 'reports/catalog-sync.json'), { revision, ...catalog.stats, issues: catalog.issues });
    console.log(`\nIndexed ${catalog.assets.length} entry layers in ${catalog.stats.packages} packages. ${catalog.issues.length} items need review.\n${url}\nBuild again to publish this snapshot. Counts may differ from the Hub’s asset count because variants are retained.`);
    return catalog;
}
if (isMain(import.meta.url))
    syncCatalog().catch(error => { console.error('\nSync failed:', error.message, '\nExisting catalog was preserved. Retry resumes the same commit.'); process.exitCode = 1; });
