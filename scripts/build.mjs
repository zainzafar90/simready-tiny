import { readdir, readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { ROOT, currentCatalog, atomicJSON, isMain } from './io.mjs';
import { validateCatalog } from './catalog-lib.mjs';
import { CSP } from './serve.mjs';

const CORE_BUDGET_BYTES = 32768;
const LAZY_FILES = new Set(['preview/preview-dialog.js', 'preview/preview-viewer.js', 'preview/preview-markup.js', 'preview/preview-menus.js']);

export function headersFile(csp = CSP) {
    const viewerCsp = csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'");
    const rules = [
        ['/*', ['X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'Permissions-Policy: camera=(), microphone=(), geolocation=()', 'Strict-Transport-Security: max-age=31536000', 'Cross-Origin-Opener-Policy: same-origin', `Content-Security-Policy: ${csp}`]],
        ['/app/*', ['Cache-Control: public, max-age=31536000, immutable']],
        ['/data/*', ['Cache-Control: public, max-age=31536000, immutable']],
        ['/thumbs/*', ['Cache-Control: public, max-age=2592000']],
        ['/sw.js', ['Cache-Control: no-cache']],
        ['/vendor/usd/*', ['! Content-Security-Policy', `Content-Security-Policy: ${viewerCsp}`]],
        ['/vendor/usd/assets/*', ['Cache-Control: public, max-age=31536000, immutable']],
        ['/catalog-manifest.json', ['Cache-Control: no-cache']],
        ['/config.json', ['Cache-Control: no-cache']],
        ['/', ['Cache-Control: no-cache']],
    ];
    return rules.map(([path, lines]) => [path, ...lines.map(line => `  ${line}`)].join('\n')).join('\n') + '\n';
}

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

async function copyPublic(dist, manifestUrl) {
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    await cp(resolve(ROOT, 'public'), dist, { recursive: true });
    /* publish only the referenced catalog */
    for (const file of await readdir(resolve(dist, 'data')))
        if (file.startsWith('catalog.') && `/data/${file}` !== manifestUrl) await rm(resolve(dist, 'data', file));
}

async function readSources() {
    const names = (await readdir(resolve(ROOT, 'src'), { recursive: true })).map(f => f.split(sep).join('/')).filter(f => /\.(js|css)$/.test(f)).sort();
    return Promise.all(names.map(async file => ({ file, content: await readFile(resolve(ROOT, 'src', file)) })));
}

async function writeApp(dist, sources) {
    const digest = createHash('sha256');
    for (const { file, content } of sources) digest.update(file).update(content);
    const hash = digest.digest('hex').slice(0, 12);
    for (const { file, content } of sources) {
        const target = resolve(dist, 'app', hash, file);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
    }
    const html = (await readFile(resolve(ROOT, 'index.html'), 'utf8')).replaceAll('/src/', `/app/${hash}/`);
    await writeFile(resolve(dist, 'index.html'), html);
    return hash;
}

function sizeReport(sources) {
    const files = sources.map(({ file, content }) => ({ file, bytes: content.length, gzip: gzipSync(content, { level: 9 }).length }));
    return { files, coreGzip: files.filter(f => !LAZY_FILES.has(f.file)).reduce((n, f) => n + f.gzip, 0) };
}

export async function build() {
    const catalog = await currentCatalog();
    validateCatalog(catalog);
    const dist = resolve(ROOT, 'dist');
    const manifest = JSON.parse(await readFile(resolve(ROOT, 'public/catalog-manifest.json'), 'utf8'));
    await copyPublic(dist, manifest.url);
    const sources = await readSources();
    const hash = await writeApp(dist, sources);
    await writeFile(resolve(dist, '_headers'), headersFile());
    const { files, coreGzip } = sizeReport(sources);
    const viewerInstalled = await exists(resolve(dist, 'vendor/usd/index.html'));
    const report = { builtAt: new Date().toISOString(), catalogMode: catalog.mode, assets: catalog.assets.length, appHash: hash, coreGzipBytes: coreGzip, coreBudgetBytes: CORE_BUDGET_BYTES, files, viewerInstalled };
    await atomicJSON(resolve(ROOT, 'reports/build.json'), report);
    if (coreGzip > CORE_BUDGET_BYTES) throw new Error(`Core exceeds 32 KiB gzip budget (${coreGzip}).`);
    console.log(`Built dist/ · ${catalog.assets.length} assets (${catalog.mode}) · core JS + CSS ${Math.round(coreGzip / 1024 * 10) / 10} KiB gzip\n${viewerInstalled ? '3D viewer bundled separately.' : '3D viewer not installed: npm run viewer:setup'}\n${catalog.mode === 'preview' ? 'Preview catalog only: npm run setup before public deployment.' : ''}`);
    return report;
}

if (isMain(import.meta.url))
    build().catch(error => { console.error(error); process.exitCode = 1; });
