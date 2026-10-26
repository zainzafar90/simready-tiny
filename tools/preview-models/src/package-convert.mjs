import { mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { download, hfUrl } from './hf-download.mjs';
import { isTexture, shrinkTexture } from './texture-shrink.mjs';

async function pool(items, size, worker) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (next < items.length) await worker(items[next++]);
    }));
}

/** Converts one package: download, shrink textures, upload. */
export async function convertPackage({ revision, name, files, r2, workDir, maxTexture, concurrency, dryRun }) {
    const dir = join(workDir, name);
    const stats = { files: files.length, bytesIn: 0, bytesOut: 0, resized: 0 };
    await rm(dir, { recursive: true, force: true });
    try {
        await pool(files, concurrency, async ([relative, size]) => {
            const path = `${name}/${relative}`, local = join(dir, relative);
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
