import { createHash } from 'node:crypto';
export const DATASET = 'nvidia/simready-assets';
export const CATEGORY_RULES = [
    [/^food_/i, 'Food & produce', /^food_(produce|prepared)_/i],
    [/^kitchenware_/i, 'Kitchenware', /^kitchenware_/i],
    [/^(ppe|safety)_/i, 'Safety equipment', /^(ppe|safety)_/i],
    [/^(CT_|instrument_|medical_|hospital_|container_system_sterilis)/i, 'Medical & laboratory', null],
    [/^(engine|machine|mechanical|industrial|motor|robot|assembly)/i, 'Machinery & robotics', null],
    [/^(box_|cart_|container_|pallet_|rack_|shelf_|storage_|warehouse_)/i, 'Storage & logistics', null],
    [/^(vehicle|car_|truck_|wheel_|tire_)/i, 'Vehicles', null],
    [/^(fixture|furniture|chair|table|cabinet|sofa)/i, 'Furniture & fixtures', /^(fixture|furniture)_/i],
    [/^(socket|electrical|cable|switch|plug|connector)/i, 'Electronics', null],
    [/^(paint|tool|testingTool|drill|screw|hammer)/i, 'Tools & materials', null],
];
export const CATEGORIES = [...CATEGORY_RULES.map(r => r[1]), 'Other objects'];
const ALIASES = { banana: ['fruit', 'grocery', 'food'], tomato: ['fruit', 'vegetable', 'grocery'], cake: ['dessert', 'bakery'], pan: ['cookware', 'frying pan', 'skillet'], bin: ['trash can', 'garbage bin', 'wastebasket'], gloves: ['hand protection'], engine: ['motor', 'machinery'], rack: ['shelving', 'storage'], cart: ['trolley', 'wheeled cart'], box: ['cardboard', 'packaging', 'parcel', 'storage'], socket: ['outlet', 'electrical'], ct: ['computed tomography', 'medical imaging'], raspatory: ['surgical instrument'], ppe: ['personal protective equipment'], paint: ['painting', 'coating'], tester: ['diagnostics', 'measurement'] };
export function words(value) { return String(value).replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/[_\-/]+/g, ' ').replace(/\b[a-z]\d{2,}\b/gi, ' ').replace(/\s+/g, ' ').trim(); }
export function inferLabels(folder) {
    const rule = CATEGORY_RULES.find(([pattern]) => pattern.test(folder));
    const cleaned = folder.replace(/_([a-z]\d{2,}|\d+)$/i, '').replace(rule?.[2] || /^$/, '');
    const name = words(cleaned).split(' ').map(w => /^(CT|PPE|USB|LED|IV|AC|DC)$/i.test(w) ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)).join(' ');
    const terms = words(folder).toLowerCase().split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w));
    const aliases = [...new Set(terms.flatMap(t => ALIASES[t] || []))];
    return { name, category: rule?.[1] || 'Other objects', tags: [...new Set([...terms, ...aliases])], aliases };
}
export function validPath(value) { return typeof value === 'string' && value.length > 0 && value.length < 3000 && !value.startsWith('/') && !/[\\\x00-\x1f]/.test(value) && !value.split('/').some(s => s === '..' || s === '.' || s === ''); }
export function hfUrl(path, revision = 'main', kind = 'resolve') {
    if (!validPath(path))
        throw new Error('Unsafe repository path: ' + path);
    return `https://huggingface.co/datasets/${DATASET}/${kind}/${encodeURIComponent(revision)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
const PACKAGING_MANIFEST = '/com.nvidia.simready.packaging.json';
const THUMB = /^(.*)\/\.thumbs\/(\d+)x(\d+)\/([^/]+\.(?:usd|usda|usdc|usdz))\.png$/i;
const TOP_LAYER = /^[^/]+\/simready_usd\/[^/]+\.(usd|usda|usdc|usdz)$/i;
const NOT_ENTRY = /\/(materials|textures|source_assets|\.thumbs)\//i;

function indexFiles(entries, issues) {
    const files = new Map();
    for (const entry of entries) {
        if (entry.type !== 'file') continue;
        if (validPath(entry.path)) files.set(entry.path, entry);
        else issues.push({ path: String(entry.path), reason: 'unsafe-path' });
    }
    return files;
}

function packageStats(files) {
    const sizes = new Map(), manifests = new Set();
    for (const [path, file] of files) {
        const pkg = path.split('/')[0];
        if (Number.isFinite(file.size) && file.size >= 0) sizes.set(pkg, (sizes.get(pkg) || 0) + file.size);
        if (path.endsWith(PACKAGING_MANIFEST)) manifests.add(path.slice(0, -PACKAGING_MANIFEST.length));
    }
    return { sizes, manifests };
}

function entryLayers(files, issues) {
    const candidates = new Map();
    /* previews pair with same-named layers */
    for (const path of files.keys()) {
        const match = path.match(THUMB);
        if (!match) continue;
        const usdPath = `${match[1]}/${match[4]}`;
        if (!files.has(usdPath)) { issues.push({ path, reason: 'thumbnail-without-matching-layer' }); continue; }
        const score = Math.abs(Number(match[2]) - 256);
        if (!candidates.has(usdPath) || score < candidates.get(usdPath).score) candidates.set(usdPath, { thumb: path, score });
    }
    /* keep top-level layers without previews */
    for (const path of files.keys()) if (TOP_LAYER.test(path) && !candidates.has(path)) candidates.set(path, { thumb: null });
    return candidates;
}

function buildAsset(usdPath, thumb, files, sizes, revision) {
    const packagePath = usdPath.split('/')[0];
    const thumbnailUrl = thumb ? hfUrl(thumb, revision) : null;
    return { id: usdPath, ...inferLabels(packagePath), packagePath, usdPath, fileType: usdPath.split('.').at(-1).toLowerCase(), usdSizeBytes: files.get(usdPath)?.size, packageSizeBytes: sizes.get(packagePath), thumbnailUrl, remoteThumbnailUrl: thumbnailUrl, thumbnailPath: thumb, usdUrl: hfUrl(usdPath, revision), sourceUrl: hfUrl(packagePath, revision, 'tree'), viewerSourceUrl: hfUrl(usdPath, revision, 'blob'), metadataSource: 'filename+taxonomy' };
}

export function normalizeCatalog(entries, revision, { now = new Date().toISOString() } = {}) {
    const issues = [];
    const files = indexFiles(entries, issues);
    const { sizes, manifests } = packageStats(files);
    const assets = [...entryLayers(files, issues)]
        .filter(([usdPath]) => !NOT_ENTRY.test(usdPath))
        .map(([usdPath, { thumb }]) => buildAsset(usdPath, thumb, files, sizes, revision))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const discovered = new Set(assets.map(a => a.packagePath));
    for (const path of manifests) if (!discovered.has(path.split('/')[0])) issues.push({ path, reason: 'manifest-without-indexed-entry-layer' });
    return { schemaVersion: 1, dataset: DATASET, revision, mode: 'snapshot', generatedAt: now, assets, stats: { listedFiles: files.size, packages: discovered.size, entryLayers: assets.length, thumbnails: assets.filter(a => a.thumbnailUrl).length }, issues };
}
/** Keeps mirrored thumbnails and preview sizes across syncs. */
export function carryMirroredFields(catalog, previous) {
    const before = new Map((previous?.assets || []).map(a => [a.id, a]));
    const sameRevision = previous?.revision === catalog.revision;
    let thumbnails = 0, sizes = 0;
    const assets = catalog.assets.map(asset => {
        const old = before.get(asset.id), next = { ...asset };
        if (old?.thumbnailUrl?.startsWith('/thumbs/') && old.thumbnailPath === asset.thumbnailPath) {
            Object.assign(next, { thumbnailUrl: old.thumbnailUrl, previewImageUrl: old.previewImageUrl });
            thumbnails++;
        }
        if (sameRevision && Number.isFinite(old?.previewSizeBytes)) { next.previewSizeBytes = old.previewSizeBytes; sizes++; }
        return next;
    });
    return { catalog: { ...catalog, assets }, carried: { thumbnails, sizes } };
}

export function remoteThumbnails(catalog) {
    return catalog.assets.filter(a => a.thumbnailUrl && !a.thumbnailUrl.startsWith('/thumbs/')).length;
}

export function applyEnrichment(catalog, enrichment) {
    const clean = list => Array.isArray(list) ? [...new Set(list.filter(v => typeof v === 'string' && v.trim().length && v.length <= 60).map(v => v.trim().toLowerCase()))].slice(0, 20) : [];
    return { ...catalog, assets: catalog.assets.map(a => {
            const { ai: previous, ...base } = a;
            const baseTags = a.tags.filter(t => !previous?.addedTags?.includes(t));
            const baseAliases = a.aliases.filter(t => !previous?.addedAliases?.includes(t));
            const ai = Object.hasOwn(enrichment, a.id) ? enrichment[a.id] : null;
            if (!ai || typeof ai !== 'object' || ai.status !== 'approved')
                return { ...base, tags: baseTags, aliases: baseAliases };
            const tags = clean(ai.tags), aliases = clean(ai.aliases);
            return { ...base, tags: [...new Set([...baseTags, ...tags])], aliases: [...new Set([...baseAliases, ...aliases])], ai: { tags, aliases, addedTags: tags.filter(t => !baseTags.includes(t)), addedAliases: aliases.filter(t => !baseAliases.includes(t)), provider: typeof ai.provider === 'string' ? ai.provider.slice(0, 60) : 'manual', status: 'approved' } };
        }) };
}
export function catalogHash(catalog) { return createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16); }
export function validateCatalog(catalog) {
    if (!catalog || catalog.dataset !== DATASET || !Array.isArray(catalog.assets) || !catalog.assets.length)
        throw new Error('Catalog is empty or invalid. Existing catalog was not replaced.');
    const ids = new Set();
    for (const a of catalog.assets) {
        if (!a.id || ids.has(a.id))
            throw new Error('Duplicate or missing asset ID: ' + a.id);
        ids.add(a.id);
        if (!validPath(a.packagePath) || !validPath(a.usdPath))
            throw new Error('Unsafe asset path');
        if (typeof a.name !== 'string' || !a.name || !CATEGORIES.includes(a.category))
            throw new Error('Invalid catalog labels');
        if (!['usd', 'usda', 'usdc', 'usdz'].includes(a.fileType))
            throw new Error('Unsupported USD extension');
    }
    return true;
}
