import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR2, describeError } from './r2-client.mjs';
import { convertPackage } from './package-convert.mjs';

/* flags: --shard i/n --limit --dry-run --max-texture --concurrency */
const HERE = dirname(fileURLToPath(import.meta.url));
const MB = 1024 * 1024;

export function parseArgs(argv) {
    const value = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
    const [index, count] = String(value('--shard', '1/1')).split('/').map(Number);
    const options = { index, count, limit: Number(value('--limit', Infinity)), maxTexture: Number(value('--max-texture', 1024)), concurrency: Number(value('--concurrency', 6)), dryRun: argv.includes('--dry-run'), workDir: value('--work-dir', join(tmpdir(), 'simready-tiny')) };
    if (!(Number.isInteger(index) && Number.isInteger(count) && index >= 1 && index <= count)) throw new Error('--shard must look like 1/4');
    if (!(Number.isInteger(options.concurrency) && options.concurrency >= 1 && options.concurrency <= 32)) throw new Error('--concurrency must be 1-32');
    if (!(options.maxTexture >= 256)) throw new Error('--max-texture must be at least 256');
    return options;
}

export function shardPackages(names, index, count) {
    return [...names].sort().filter((_, i) => i % count === index - 1);
}

const mb = bytes => (bytes / MB).toFixed(1);

async function main() {
    const options = parseArgs(process.argv);
    const { revision, packages } = JSON.parse(gunzipSync(await readFile(resolve(HERE, '../manifest.json.gz'))));
    const mine = shardPackages(Object.keys(packages), options.index, options.count).slice(0, options.limit);
    const r2 = options.dryRun ? null : createR2();
    const tag = `[shard ${options.index}/${options.count}]`;
    const total = { done: 0, skipped: 0, failed: 0, bytesIn: 0, bytesOut: 0 };
    console.log(`${tag} ${mine.length} packages, revision ${revision.slice(0, 12)}${options.dryRun ? ' (dry run)' : ''}`);
    for (const [i, name] of mine.entries()) {
        const marker = `${revision}/_done/${name}.json`;
        try {
            if (r2 && await r2.exists(marker)) { total.skipped++; continue; }
            const started = Date.now();
            const stats = await convertPackage({ revision, name, files: packages[name], r2, ...options });
            if (r2) await r2.putJSON(marker, { ...stats, maxTexture: options.maxTexture, finishedAt: new Date().toISOString() });
            total.done++; total.bytesIn += stats.bytesIn; total.bytesOut += stats.bytesOut;
            console.log(`${tag} ${i + 1}/${mine.length} ${name}: ${stats.files} files, ${mb(stats.bytesIn)} MB -> ${mb(stats.bytesOut)} MB, ${stats.resized} textures resized, ${((Date.now() - started) / 1000).toFixed(0)}s`);
        } catch (error) {
            total.failed++;
            console.error(`${tag} ${i + 1}/${mine.length} ${name} FAILED: ${describeError(error)}`);
        }
    }
    console.log(`${tag} finished: ${total.done} converted, ${total.skipped} already done, ${total.failed} failed, ${mb(total.bytesIn)} MB -> ${mb(total.bytesOut)} MB`);
    if (total.failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(`convert: ${error.message}`); process.exitCode = 1; });
