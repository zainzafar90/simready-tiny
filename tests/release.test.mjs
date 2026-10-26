import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { carryMirroredFields, remoteThumbnails } from '../scripts/catalog-lib.mjs';
import { deployBlockers } from '../scripts/deploy.mjs';
import { writeCatalog } from '../scripts/io.mjs';
import { previewCatalog } from './fixtures.mjs';

const REV = 'a'.repeat(40);
const fresh = (overrides = {}) => ({ id: 'mug/simready_usd/m.usd', thumbnailPath: 'mug/simready_usd/.thumbs/256x256/m.usd.png', thumbnailUrl: 'https://huggingface.co/x.png', ...overrides });

test('catalog sync keeps local thumbnails and same-revision preview sizes', () => {
    const previous = { revision: REV, assets: [fresh({ thumbnailUrl: '/thumbs/abc-512.webp', previewImageUrl: '/thumbs/abc-1024.webp', previewSizeBytes: 42 })] };
    const { catalog, carried } = carryMirroredFields({ revision: REV, assets: [fresh()] }, previous);
    assert.deepEqual(carried, { thumbnails: 1, sizes: 1 });
    assert.equal(catalog.assets[0].thumbnailUrl, '/thumbs/abc-512.webp');
    assert.equal(catalog.assets[0].previewImageUrl, '/thumbs/abc-1024.webp');
    assert.equal(catalog.assets[0].previewSizeBytes, 42);
});

test('a new revision drops preview sizes; a changed thumbnail drops the local copy', () => {
    const previous = { revision: REV, assets: [fresh({ thumbnailUrl: '/thumbs/abc-512.webp', previewSizeBytes: 42 })] };
    const { catalog } = carryMirroredFields({ revision: 'b'.repeat(40), assets: [fresh({ thumbnailPath: 'mug/other.png' })] }, previous);
    assert.equal(catalog.assets[0].previewSizeBytes, undefined);
    assert.equal(catalog.assets[0].thumbnailUrl, 'https://huggingface.co/x.png');
    assert.equal(remoteThumbnails(catalog), 1);
});

test('deploy refuses partial catalogs, a missing viewer and remote thumbnails', () => {
    const good = { mode: 'snapshot', assets: [fresh({ thumbnailUrl: '/thumbs/a-512.webp' })] };
    assert.deepEqual(deployBlockers(good, true), []);
    assert.equal(deployBlockers({ ...good, mode: 'preview' }, true).length, 1);
    assert.match(deployBlockers(good, false)[0], /viewer/);
    assert.match(deployBlockers({ mode: 'snapshot', assets: [fresh()] }, true)[0], /remote thumbnails/);
});

test('writing a catalog removes older hashed catalogs only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'simready-catalog-'));
    try {
        await mkdir(join(root, 'public/data'), { recursive: true });
        await writeFile(join(root, 'public/data/catalog.abc123.json'), '{}');
        await writeFile(join(root, 'public/data/notes.txt'), '');
        const url = await writeCatalog(previewCatalog(), root);
        assert.deepEqual((await readdir(join(root, 'public/data'))).sort(), [url.split('/').pop(), 'notes.txt'].sort());
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
