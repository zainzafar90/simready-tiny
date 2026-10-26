import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isSafeRelative } from './safe-path.mjs';

/* run on the Mac: needs .cache tree */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../manifest.json.gz');

export function previewFiles(entries) {
    const packages = {};
    for (const entry of entries) {
        if (entry.type !== 'file') continue;
        const cut = entry.path.indexOf('/simready_usd/');
        if (cut < 0 || entry.path.includes('/.thumbs/') || entry.path.includes('/source_assets/')) continue;
        const name = entry.path.slice(0, cut), relative = entry.path.slice(cut + 1);
        if (!isSafeRelative(name) || name.includes('/') || !isSafeRelative(relative)) throw new Error(`Unsafe dataset path: ${entry.path.slice(0, 200)}`);
        (packages[name] ??= []).push([relative, entry.size]);
    }
    return packages;
}

async function main() {
    const manifest = JSON.parse(await readFile(resolve(ROOT, 'public/catalog-manifest.json'), 'utf8'));
    const tree = JSON.parse(await readFile(resolve(ROOT, `.cache/tree-${manifest.revision}.json`), 'utf8'));
    const packages = previewFiles(tree.entries);
    await writeFile(OUT, gzipSync(JSON.stringify({ revision: manifest.revision, packages })));
    console.log(`Wrote manifest: ${Object.keys(packages).length} packages`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
