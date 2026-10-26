import { readdir, readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import { resolve, join, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { ROOT, currentCatalog, atomicJSON, isMain } from './io.mjs';
import { validateCatalog } from './catalog-lib.mjs';
import { CSP } from './serve.mjs';
export async function build() {
    const catalog = await currentCatalog();
    validateCatalog(catalog);
    const dist = resolve(ROOT, 'dist');
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    await cp(resolve(ROOT, 'public'), dist, { recursive: true, filter: source => !source.startsWith(resolve(ROOT, 'public/preview-models')) });
    const manifest = JSON.parse(await readFile(resolve(ROOT, 'public/catalog-manifest.json'), 'utf8'));
    /* publish only the referenced catalog */
    for (const file of await readdir(resolve(dist, 'data')))
        if (file.startsWith('catalog.') && '/data/' + file !== manifest.url)
            await rm(resolve(dist, 'data', file));
    const files = (await readdir(resolve(ROOT, 'src'), { recursive: true })).map(f => f.split(sep).join('/')).filter(f => f.endsWith('.js') || f.endsWith('.css')).sort();
    const contents = await Promise.all(files.map(f => readFile(resolve(ROOT, 'src', f))));
    const digest = createHash('sha256');
    for (let i = 0; i < files.length; i++)
        digest.update(files[i]).update(contents[i]);
    const hash = digest.digest('hex').slice(0, 12);
    const app = resolve(dist, 'app', hash);
    await mkdir(app, { recursive: true });
    for (let i = 0; i < files.length; i++) {
        await mkdir(dirname(resolve(app, files[i])), { recursive: true });
        await writeFile(resolve(app, files[i]), contents[i]);
    }
    const html = (await readFile(resolve(ROOT, 'index.html'), 'utf8')).replaceAll('/src/', `/app/${hash}/`);
    await writeFile(resolve(dist, 'index.html'), html);
    await writeFile(resolve(dist, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ${CSP}\n/app/*\n  Cache-Control: public, max-age=31536000, immutable\n/data/*\n  Cache-Control: public, max-age=31536000, immutable\n/thumbs/*\n  Cache-Control: public, max-age=2592000\n/sw.js\n  Cache-Control: no-cache\n/vendor/usd/*\n  ! Content-Security-Policy\n  Content-Security-Policy: ${CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'")}\n/vendor/usd/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/catalog-manifest.json\n  Cache-Control: no-cache\n/config.json\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n`);
    const sizes = files.map((f, i) => ({ file: f, bytes: contents[i].length, gzip: gzipSync(contents[i], { level: 9 }).length }));
    const lazyFiles = new Set(['preview/preview-dialog.js', 'preview/preview-viewer.js']);
    const coreGzip = sizes.filter(f => !lazyFiles.has(f.file)).reduce((n, f) => n + f.gzip, 0);
    const report = { builtAt: new Date().toISOString(), catalogMode: catalog.mode, assets: catalog.assets.length, appHash: hash, coreGzipBytes: coreGzip, coreBudgetBytes: 32768, files: sizes, viewerInstalled: await stat(resolve(dist, 'vendor/usd/index.html')).then(() => true).catch(() => false) };
    await atomicJSON(resolve(ROOT, 'reports/build.json'), report);
    if (coreGzip > 32768)
        throw new Error(`Core exceeds 32 KiB gzip budget (${coreGzip}).`);
    console.log(`Built dist/ · ${catalog.assets.length} assets (${catalog.mode}) · core JS + CSS ${Math.round(coreGzip / 1024 * 10) / 10} KiB gzip\n${report.viewerInstalled ? '3D viewer bundled separately.' : '3D viewer not installed: npm run viewer:setup'}\n${catalog.mode === 'preview' ? 'Preview catalog only: npm run setup before public deployment.' : ''}`);
    return report;
}
if (isMain(import.meta.url))
    build().catch(error => { console.error(error); process.exitCode = 1; });
