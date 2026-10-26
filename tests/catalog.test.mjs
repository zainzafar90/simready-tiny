import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog, inferLabels, validPath, hfUrl, applyEnrichment, validateCatalog } from '../scripts/catalog-lib.mjs';
import { previewCatalog } from './fixtures.mjs';
const p = 'food_produce_banana_m01', root = `${p}/simready_usd/sm_${p}_01.usd`;
const file = (path, size = 100) => ({ path, size, type: 'file' });
const fixtures = [file(`${p}/com.nvidia.simready.packaging.json`), file(root, 2048), file(`${p}/simready_usd/.thumbs/256x256/sm_${p}_01.usd.png`, 200), file(`${p}/simready_usd/Textures/banana.png`, 10000)];
test('import discovers canonical entry layer and thumbnail', () => { const c = normalizeCatalog(fixtures, 'a'.repeat(40)); assert.equal(c.assets.length, 1); assert.equal(c.assets[0].name, 'Banana'); assert.ok(c.assets[0].thumbnailUrl.includes('/resolve/' + ('a'.repeat(40)) + '/')); });
test('package size is not confused with root-layer size', () => { const a = normalizeCatalog(fixtures, 'x').assets[0]; assert.equal(a.usdSizeBytes, 2048); assert.equal(a.packageSizeBytes, 12348); });
test('variants are retained instead of arbitrarily collapsed', () => { const c = normalizeCatalog([...fixtures, file(`${p}/simready_usd/alternate.usda`)], 'x'); assert.equal(c.assets.length, 2); });
test('root layers without thumbnails remain discoverable', () => { const c = normalizeCatalog([file(root)], 'x'); assert.equal(c.assets.length, 1); assert.equal(c.assets[0].thumbnailUrl, null); });
test('material layers with thumbnails are not indexed as objects', () => { const c = normalizeCatalog([...fixtures, file(`${p}/simready_usd/materials/metal.usd`), file(`${p}/simready_usd/materials/.thumbs/256x256/metal.usd.png`)], 'x'); assert.deepEqual(c.assets.map(a => a.name), ['Banana']); });
test('the thumbnail closest to 256px wins', () => { const c = normalizeCatalog([file(`${p}/simready_usd/.thumbs/512x512/sm_${p}_01.usd.png`), ...fixtures], 'x'); assert.match(c.assets[0].thumbnailPath, /256x256/); });
test('orphan thumbnails are reported', () => { const c = normalizeCatalog([...fixtures, file(`${p}/simready_usd/.thumbs/256x256/nope.usd.png`)], 'x'); assert.ok(c.issues.some(i => i.reason === 'thumbnail-without-matching-layer')); });
test('unresolved packaging manifests are reported', () => { const c = normalizeCatalog([file('other/com.nvidia.simready.packaging.json')], 'x'); assert.ok(c.issues.some(i => i.reason === 'manifest-without-indexed-entry-layer')); });
test('invalid paths are discarded', () => { const c = normalizeCatalog([file('../bad/simready_usd/bad.usd')], 'x'); assert.equal(c.assets.length, 0); assert.ok(c.issues.some(i => i.reason === 'unsafe-path')); });
test('path validation rejects traversal and control characters', () => { for (const p of ['../x', 'x/../y', '/x', 'x\\y', 'x\0y', 'x//y'])
    assert.equal(validPath(p), false); assert.equal(validPath('a/' + 'b'.repeat(3000)), false); assert.equal(validPath('nice object/root.usd'), true); });
test('source URLs encode path segments', () => assert.ok(hfUrl('nice object/root.usd', 'main').includes('nice%20object')));
test('testing tools are not mislabeled medical', () => assert.equal(inferLabels('testingTool_emission_tester_b01').category, 'Tools & materials'));
test('source snapshot schema validates', () => assert.equal(validateCatalog(previewCatalog()), true));
test('empty catalog cannot replace an existing catalog', () => assert.throws(() => validateCatalog({ dataset: 'nvidia/simready-assets', assets: [] })));
test('duplicate IDs are rejected', () => { const c = previewCatalog(); c.assets.push(c.assets[0]); assert.throws(() => validateCatalog(c), /Duplicate/); });
test('unknown categories, file types and unsafe paths are rejected', () => {
    for (const [change, message] of [[{ category: 'Evil' }, /labels/], [{ fileType: 'exe' }, /extension/], [{ usdPath: '../x.usd' }, /Unsafe/]]) {
        const c = previewCatalog(); Object.assign(c.assets[0], change);
        assert.throws(() => validateCatalog(c), message);
    }
});
test('pending AI tags are not published', () => { const c = previewCatalog(); assert.equal(applyEnrichment(c, { [c.assets[0].id]: { tags: ['yellow'], status: 'pending-review' } }).assets[0].ai, undefined); });
test('AI cannot overwrite physics, licensing, category or source paths', () => { const c = previewCatalog(), a = c.assets[0]; a.license = 'original'; a.mass = 99; const n = applyEnrichment(c, { [a.id]: { status: 'approved', tags: ['yellow'], license: 'CC0', mass: 1, usdUrl: 'evil', category: 'Evil' } }).assets[0]; assert.equal(n.license, 'original'); assert.equal(n.mass, 99); assert.equal(n.usdUrl, a.usdUrl); assert.equal(n.category, a.category); assert.ok(n.tags.includes('yellow')); });
test('tag values are capped and type checked', () => { const c = previewCatalog(); const a = applyEnrichment(c, { [c.assets[0].id]: { status: 'approved', tags: [42, null, 'x'.repeat(100), 'yellow', 'yellow'] } }).assets[0]; assert.deepEqual(a.ai.tags, ['yellow']); });
test('AI tags are lowercased and capped at 20', () => { const c = previewCatalog(), tags = Array.from({ length: 25 }, (_, i) => `Tag${i}`); const a = applyEnrichment(c, { [c.assets[0].id]: { status: 'approved', tags } }).assets[0]; assert.deepEqual(a.ai.tags, tags.slice(0, 20).map(t => t.toLowerCase())); });
test('rejected AI contribution is removed on remerge without deleting source labels', () => { const c = previewCatalog(), id = c.assets[0].id; const first = applyEnrichment(c, { [id]: { status: 'approved', tags: ['yellow', c.assets[0].tags[0]] } }); const second = applyEnrichment(first, { [id]: { status: 'rejected' } }); assert.equal(second.assets[0].ai, undefined); assert.deepEqual(second.assets[0].tags, c.assets[0].tags); });
test('editing AI tags replaces previous generated tags', () => { const c = previewCatalog(), id = c.assets[0].id; const first = applyEnrichment(c, { [id]: { status: 'approved', tags: ['yellow'] } }); const second = applyEnrichment(first, { [id]: { status: 'approved', tags: ['curved'] } }); assert.equal(second.assets[0].tags.includes('yellow'), false); assert.ok(second.assets[0].tags.includes('curved')); });
