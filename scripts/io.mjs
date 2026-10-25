import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogHash, validateCatalog } from './catalog-lib.mjs';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function atomicJSON(path, data) { await mkdir(dirname(path), { recursive: true }); const temp = path + '.tmp'; await writeFile(temp, JSON.stringify(data)); await rename(temp, path); }
export async function readJSON(path, fallback) { try {
    return JSON.parse(await readFile(path, 'utf8'));
}
catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined)
        return fallback;
    throw error;
} }
export async function writeCatalog(catalog, root = ROOT) {
    validateCatalog(catalog);
    const hash = catalogHash(catalog), url = `/data/catalog.${hash}.json`;
    await atomicJSON(resolve(root, 'public' + url), catalog);
    await atomicJSON(resolve(root, 'public/catalog-manifest.json'), { schemaVersion: 1, url, revision: catalog.revision, count: catalog.assets.length, mode: catalog.mode });
    return url;
}
export async function currentCatalog(root = ROOT) { const m = await readJSON(resolve(root, 'public/catalog-manifest.json')); if (!/^\/data\/catalog\.[a-f0-9]+\.json$/.test(m.url))
    throw new Error('Invalid catalog path'); return readJSON(resolve(root, 'public' + m.url)); }
export function arg(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1] ?? fallback; }
export function flag(name) { return process.argv.includes(name); }
export async function loadEnv() {
    try {
        const text = await readFile(resolve(ROOT, '.env'), 'utf8');
        for (const line of text.split(/\r?\n/)) {
            const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
            if (m && !process.env[m[1]])
                process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
}
export function isMain(meta) { return process.argv[1] && fileURLToPath(meta) === resolve(process.argv[1]); }
