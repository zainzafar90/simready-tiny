import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, currentCatalog, writeCatalog, flag, arg } from './io.mjs';
import { fetchWithRetry } from './http.mjs';
if (!flag('--confirm-rights')) {
    console.error('Review source redistribution terms first. Re-run with --confirm-rights to download thumbnails only.');
    process.exitCode = 1;
}
else {
    const catalog = await currentCatalog(), folder = resolve(ROOT, 'public/thumbs');
    await mkdir(folder, { recursive: true });
    const limit = Number(arg('--limit', catalog.assets.length));
    let next = 0, failures = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < Math.min(limit, catalog.assets.length)) {
            const a = catalog.assets[next++], url = a.remoteThumbnailUrl || a.thumbnailUrl;
            if (!url?.startsWith('https://huggingface.co/'))
                continue;
            try {
                const response = await fetchWithRetry(url), declared = Number(response.headers.get('content-length'));
                if (declared > 2 * 1024 * 1024)
                    throw new Error('Thumbnail exceeds 2 MB limit');
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > 2 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
                    throw new Error('Invalid PNG thumbnail');
                const name = createHash('sha256').update(bytes).digest('hex').slice(0, 20) + '.png';
                await writeFile(resolve(folder, name), bytes);
                a.thumbnailUrl = '/thumbs/' + name;
                a.remoteThumbnailUrl = url;
            }
            catch (error) {
                failures++;
                console.error(a.id, error.message);
            }
        }
    }));
    await writeCatalog(catalog);
    console.log(`Thumbnails mirrored. ${failures} failures retain remote URLs.`);
    if (failures)
        process.exitCode = 1;
}
