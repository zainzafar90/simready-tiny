import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCollections, createCollection, collectionName, mergeCollections } from '../src/library/collections.js';
import { parseState, stateUrl } from '../src/shared/url-state.js';

test('Collection normalization rejects non-arrays', () => {
    for (const input of [null, {}, 'bad', 42]) assert.deepEqual(normalizeCollections(input), []);
});
test('Collection normalization removes invalid and duplicate records', () => {
    const raw = [{ id: 'a', name: ' Test ', ids: ['x', 'x', 'y', 2] }, { id: 'a', name: 'Duplicate', ids: [] }, { id: '<script>', name: 'bad', ids: [] }, { id: 'b', name: '', ids: [] }];
    assert.deepEqual(normalizeCollections(raw), [{ id: 'a', name: 'Test', ids: ['x', 'y'] }]);
});
test('Collection normalization bounds counts and name length', () => {
    const raw = Array.from({ length: 250 }, (_, i) => ({ id: String(i), name: 'a'.repeat(100), ids: [] }));
    const result = normalizeCollections(raw);
    assert.equal(result.length, 200);
    assert.ok(result.every(c => c.name.length === 60));
});
test('Collection normalization retains unknown IDs for later catalog sync', () => {
    assert.deepEqual(normalizeCollections([{ id: 'a', name: 'My project', ids: ['not-in-preview-catalog'] }])[0].ids, ['not-in-preview-catalog']);
});
test('Collection name requires a nonempty bounded string', () => {
    assert.throws(() => collectionName('   '));
    assert.throws(() => collectionName('a'.repeat(61)));
    assert.equal(collectionName(' Hello '), 'Hello');
});
test('New collection has an explicit ID and no fabricated objects', () => {
    assert.deepEqual(createCollection([], 'Kitchen', 'abc'), { id: 'abc', name: 'Kitchen', ids: [] });
});
test('Collection names are unique ignoring case', () => {
    assert.throws(() => createCollection([{ id: 'a', name: 'Kitchen', ids: [] }], 'kItChEn', 'b'));
});
test('Collection creation enforces the count limit', () => {
    assert.throws(() => createCollection(Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: String(i), ids: [] })), 'new', 'new'));
});
test('Import merge combines memberships without overwriting local names', () => {
    const original = [{ id: 'a', name: 'Local', ids: ['x'] }];
    const result = mergeCollections(original, [{ id: 'a', name: 'Remote', ids: ['x', 'y'] }, { id: 'b', name: 'New', ids: ['z'] }]);
    assert.deepEqual(result, [{ id: 'a', name: 'Local', ids: ['x', 'y'] }, { id: 'b', name: 'New', ids: ['z'] }]);
    assert.deepEqual(original[0].ids, ['x']);
});
test('Malformed collection imports cannot replace a good library', () => {
    const existing = [{ id: 'ok', name: 'Keep me', ids: ['x'] }];
    assert.deepEqual(mergeCollections(existing, '<script>'), existing);
});
test('Collection filter survives URL round trip', () => {
    const state = parseState('/?collection=project-123&q=banana');
    assert.equal(parseState(stateUrl(state)).collection, 'project-123');
});
test('Invalid collection URL symbols are stripped and length bounded', () => {
    assert.match(parseState('/?collection=%3Cbad%3E').collection, /^[a-zA-Z0-9_-]*$/);
    assert.equal(parseState('/?collection=' + 'a'.repeat(200)).collection.length, 80);
});
test('Collection membership and merged collection counts stay bounded', () => {
    const big = normalizeCollections([{ id: 'a', name: 'Big', ids: Array.from({ length: 100001 }, (_, i) => String(i)) }]);
    assert.equal(big[0].ids.length, 100000);
    const full = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, ids: [] }));
    assert.equal(mergeCollections(full, [{ id: 'extra', name: 'Extra', ids: [] }]).length, 200);
});
