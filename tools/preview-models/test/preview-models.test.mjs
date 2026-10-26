import test from 'node:test';
import assert from 'node:assert/strict';
import { previewFiles } from '../src/manifest-build.mjs';
import { parseArgs, shardPackages } from '../src/convert.mjs';
import { isTransient, hfUrl } from '../src/hf-download.mjs';
import { encodeKey, contentType } from '../src/r2-client.mjs';

test('manifest keeps only viewer files', () => {
    const packages = previewFiles([
        { type: 'file', path: 'mug/simready_usd/sm_mug.usd', size: 10 },
        { type: 'file', path: 'mug/simready_usd/textures/a.png', size: 20 },
        { type: 'file', path: 'mug/simready_usd/.thumbs/256x256/a.png', size: 5 },
        { type: 'file', path: 'mug/simready_usd/source_assets/raw.png', size: 99 },
        { type: 'file', path: 'mug/.metadata/LICENSE.txt', size: 1 },
    ]);
    assert.deepEqual(packages, { mug: [['simready_usd/sm_mug.usd', 10], ['simready_usd/textures/a.png', 20]] });
});

test('shards split packages without overlap', () => {
    const names = ['d', 'a', 'c', 'b', 'e'];
    const shards = [1, 2].map(i => shardPackages(names, i, 2));
    assert.deepEqual(shards, [['a', 'c', 'e'], ['b', 'd']]);
});

test('argument parsing rejects bad shards and concurrency', () => {
    assert.equal(parseArgs(['node', 'x', '--shard', '2/4']).index, 2);
    assert.throws(() => parseArgs(['node', 'x', '--shard', '5/4']), /shard/);
    assert.throws(() => parseArgs(['node', 'x', '--concurrency', 'x']), /concurrency/);
});

test('only rate limits, timeouts and server errors retry', () => {
    assert.deepEqual([408, 429, 500, 503, 404, 403].map(isTransient), [true, true, true, true, false, false]);
});

test('keys and URLs encode each path segment', () => {
    assert.equal(encodeKey('rev/a b/c#d.png'), 'rev/a%20b/c%23d.png');
    assert.equal(hfUrl('r', 'p/x y.usd'), 'https://huggingface.co/datasets/nvidia/simready-assets/resolve/r/p/x%20y.usd');
    assert.equal(contentType('a/b.PNG'), 'image/png');
});

test('dataset paths cannot escape the work directory', async () => {
    const { resolveInside, isSafeRelative } = await import('../src/safe-path.mjs');
    assert.equal(isSafeRelative('mug/simready_usd/a.png'), true);
    for (const bad of ['..', '../x', 'a/../../b', '/etc/passwd', 'a//b', 'a\\b', '']) assert.equal(isSafeRelative(bad), false, bad);
    assert.match(resolveInside('/srv/work', 'mug/a.png'), /\/srv\/work\/mug\/a\.png$/);
    assert.throws(() => resolveInside('/srv/work', '../r2.env'), /Unsafe path/);
});

test('manifest builder rejects traversal in dataset listings', () => {
    assert.throws(() => previewFiles([{ type: 'file', path: '../simready_usd/model.usd', size: 1 }]), /Unsafe dataset path/);
});

test('only real PNG or JPEG content reaches the image decoder', async () => {
    const { sniffImage } = await import('../src/texture-shrink.mjs');
    assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
    assert.equal(sniffImage(Buffer.from('<svg xmlns=')), null);
});

test('downloads stop as soon as they pass the byte limit', async () => {
    const { byteLimit } = await import('../src/hf-download.mjs');
    const { Readable, Writable } = await import('node:stream');
    const { pipeline } = await import('node:stream/promises');
    const sink = new Writable({ write(chunk, encoding, done) { done(); } });
    await assert.rejects(pipeline(Readable.from([Buffer.alloc(6), Buffer.alloc(6)]), byteLimit(10), sink), /exceeded 10 bytes/);
});

test('a failed file stops the package instead of downloading the rest', async () => {
    const { pool } = await import('../src/package-convert.mjs');
    const started = [];
    await assert.rejects(pool([1, 2, 3, 4, 5, 6], 1, async item => {
        started.push(item);
        if (item === 2) throw new Error('boom');
    }), /boom/);
    assert.deepEqual(started, [1, 2]);
});

test('R2 existence checks retry server errors and only treat 404 as missing', async () => {
    const { createR2 } = await import('../src/r2-client.mjs');
    const statuses = [503, 404, 404];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('', { status: statuses.shift() });
    try {
        const r2 = createR2({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET: 'd' });
        assert.equal(await r2.exists('x'), false);
        await assert.rejects(r2.getJSON('missing.json'), /R2 GET 404/);
        assert.equal(statuses.length, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.throws(() => createR2({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c' }), /R2_BUCKET/);
});

test('textures shrink to the size cap, keep aspect ratio and skip small or fake images', async t => {
    const { default: sharp } = await import('sharp');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { shrinkTexture } = await import('../src/texture-shrink.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'simready-texture-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const noise = (width, height) => sharp(Buffer.from(Array.from({ length: width * height * 3 }, () => Math.random() * 256)), { raw: { width, height, channels: 3 } }).png();
    const big = join(dir, 'big.png'), small = join(dir, 'small.png'), fake = join(dir, 'fake.png');
    await noise(1024, 512).toFile(big);
    await noise(128, 128).toFile(small);
    await writeFile(fake, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    assert.equal(await shrinkTexture(big, 256), true);
    const meta = await sharp(big).metadata();
    assert.deepEqual([meta.width, meta.height], [256, 128]);
    assert.equal(await shrinkTexture(small, 256), false);
    assert.equal(await shrinkTexture(fake, 256), false);
});

test('preview sizes apply only to packages with a finished R2 marker', async () => {
    const { applyPreviewSizes } = await import('../src/catalog-sizes.mjs');
    const assets = [{ packagePath: 'mug' }, { packagePath: 'pan' }, { packagePath: 'cup' }];
    assert.equal(applyPreviewSizes(assets, new Map([['mug', 42], ['pan', undefined]])), 1);
    assert.deepEqual(assets.map(a => a.previewSizeBytes), [42, undefined, undefined]);
});
