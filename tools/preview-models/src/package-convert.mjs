import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from './safe-path.mjs';
import { download, hfUrl } from './hf-download.mjs';
import { isTexture, shrinkTexture } from './texture-shrink.mjs';

/** Stops taking work after the first failure, then rethrows it. */
export async function pool(items, size, worker) {
    let next = 0, failure = null;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (!failure && next < items.length) {
            try { await worker(items[next++]); } catch (error) { failure ??= error; }
        }
    }));
    if (failure) throw failure;
}

/** Converts one package: download, shrink textures, upload. */
export async function convertPackage({ revision, name, files, r2, workDir, maxTexture, concurrency, dryRun }) {
    const dir = resolveInside(workDir, name);
    const stats = { files: files.length, bytesIn: 0, bytesOut: 0, resized: 0 };
    await rm(dir, { recursive: true, force: true });
    try {
        await pool(files, concurrency, async ([relative, size]) => {
            const path = `${name}/${relative}`, local = resolveInside(dir, relative);
            await mkdir(dirname(local), { recursive: true });
            const received = await download(hfUrl(revision, path), local, size);
            const resized = isTexture(relative) && await shrinkTexture(local, maxTexture);
            const sent = dryRun ? (await stat(local)).size : await r2.putFile(`${revision}/${path}`, local);
            stats.bytesIn += received; stats.bytesOut += sent; stats.resized += resized ? 1 : 0;
            await rm(local, { force: true });
        });
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
    return stats;
}
