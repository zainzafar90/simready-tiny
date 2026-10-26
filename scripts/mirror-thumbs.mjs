import { mkdir, mkdtemp, writeFile, rm, stat, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, currentCatalog, writeCatalog, flag, arg, isMain } from './io.mjs';
import { fetchWithRetry } from './http.mjs';

/* flags: --confirm-rights --limit --dry-run --concurrency */
const run = promisify(execFile);
const SIZES = { grid: 512, preview: 1024 };
const MAX_PNG_BYTES = 4 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const exists = path => stat(path).then(() => true, () => false);
const baseName = (asset, revision) => createHash('sha256').update(`${revision}:${asset.thumbnailPath || asset.id}`).digest('hex').slice(0, 20);
const sourceUrl = asset => [asset.remoteThumbnailUrl, asset.thumbnailUrl].find(url => url?.startsWith('https://huggingface.co/'));

export async function readCapped(body, limit) {
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        total += chunk.length;
        if (total > limit) throw new Error(`Response exceeds ${limit} bytes`);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function downloadPng(url) {
    const response = await fetchWithRetry(url);
    if (Number(response.headers.get('content-length')) > MAX_PNG_BYTES) throw new Error('Thumbnail exceeds 4 MB limit');
    const bytes = await readCapped(response.body, MAX_PNG_BYTES);
    if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) throw new Error('Invalid PNG thumbnail');
    return bytes;
}

async function encodeWebp(png, outputs, scratch) {
    const input = join(scratch, `${process.pid}-${Math.random().toString(36).slice(2)}.png`);
    await writeFile(input, png);
    try {
        for (const [size, output] of outputs) {
            const partial = `${output}.partial`;
            await run('cwebp', ['-quiet', '-resize', String(size), '0', '-q', '78', '-alpha_q', '80', '-m', '6', input, '-o', partial], { timeout: 60000 });
            await rename(partial, output);
        }
    } finally {
        await rm(input, { force: true });
    }
}

async function mirrorAsset(asset, { folder, scratch, revision }) {
    const url = sourceUrl(asset);
    if (!url) return { skipped: true };
    const name = baseName(asset, revision);
    const grid = join(folder, `${name}-${SIZES.grid}.webp`), preview = join(folder, `${name}-${SIZES.preview}.webp`);
    const cached = await exists(grid) && await exists(preview);
    if (!cached) await encodeWebp(await downloadPng(url), [[SIZES.grid, grid], [SIZES.preview, preview]], scratch);
    asset.remoteThumbnailUrl = url;
    asset.thumbnailUrl = `/thumbs/${name}-${SIZES.grid}.webp`;
    asset.previewImageUrl = `/thumbs/${name}-${SIZES.preview}.webp`;
    return { cached, bytes: (await stat(grid)).size + (await stat(preview)).size };
}

function parseOptions(total) {
    if (!flag('--confirm-rights')) throw new Error('Review source redistribution terms first. Re-run with --confirm-rights to mirror thumbnails.');
    const concurrency = Number(arg('--concurrency', 8));
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('--concurrency must be a whole number from 1 to 32.');
    return { concurrency, dryRun: flag('--dry-run'), limit: Number(arg('--limit', total)) };
}

async function requireCwebp() {
    try {
        await run('cwebp', ['-version']);
    } catch (error) {
        throw new Error('cwebp not found. Install it with: brew install webp', { cause: error });
    }
}

async function mirrorAll(assets, context, concurrency) {
    const stats = { done: 0, cached: 0, failed: 0, bytes: 0 };
    let next = 0;
    const worker = async () => {
        while (next < assets.length) {
            const asset = assets[next++];
            try {
                const result = await mirrorAsset(asset, context);
                if (result.skipped) continue;
                stats.done++; stats.bytes += result.bytes; if (result.cached) stats.cached++;
                if (stats.done % 100 === 0) console.log(`${stats.done}/${assets.length} thumbnails`);
            } catch (error) {
                stats.failed++;
                console.error(`${asset.id}: ${error.message}`);
            }
        }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return stats;
}

async function main() {
    const catalog = await currentCatalog();
    const { concurrency, dryRun, limit } = parseOptions(catalog.assets.length);
    await requireCwebp();
    const scratch = await mkdtemp(join(tmpdir(), 'atlas-thumbs-'));
    const folder = dryRun ? scratch : resolve(ROOT, 'public/thumbs');
    await mkdir(folder, { recursive: true });
    let stats;
    try {
        stats = await mirrorAll(catalog.assets.slice(0, limit), { folder, scratch, revision: catalog.revision }, concurrency);
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
    if (!dryRun) await writeCatalog(catalog);
    const kb = stats.done ? (stats.bytes / stats.done / 1024).toFixed(1) : '0';
    console.log(`${dryRun ? 'Dry run: ' : ''}${stats.done} mirrored (${stats.cached} reused), ${stats.failed} failed, ${kb} KB per asset (512 + 1024 px).`);
    if (stats.failed) process.exitCode = 1;
}

if (isMain(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
