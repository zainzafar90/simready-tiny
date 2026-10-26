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
