import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeUrl, formatBytes, parseState, stateUrl, validatedSaved } from '../src/utils.js';
import { makeQuestions, normalizeJev } from '../scripts/jev-lib.mjs';
test('HTML escape prevents markup injection', () => assert.equal(escapeHtml('<img onerror="bad">'), '&lt;img onerror=&quot;bad&quot;&gt;'));
test('URL sanitizer rejects executable URLs and protocol-relative URLs', () => { for (const u of ['javascript:alert(1)', 'data:text/html,hi', '//evil.test', 'http://example.com'])
    assert.equal(safeUrl(u, true), ''); });
test('URL sanitizer allows verified HTTPS and local thumbnails', () => { assert.equal(safeUrl('/thumbs/a.webp', true), '/thumbs/a.webp'); assert.ok(safeUrl('https://huggingface.co/a')); });
test('format size handles unknown and zero', () => { assert.equal(formatBytes(undefined), 'Not indexed'); assert.equal(formatBytes(0), '0 B'); assert.equal(formatBytes(1024), '1.0 KB'); });
test('URL state round trip', () => { const s = { query: 'fruit & veg', category: 'Food & produce', format: 'usd', saved: true, sort: 'name', preview: true, asset: 'a/root.usd', collection: '' }; assert.deepEqual(parseState(stateUrl(s)), s); });
test('invalid query settings are normalized', () => { const s = parseState('/?sort=evil&format=exe&q=' + ('a'.repeat(500))); assert.equal(s.sort, 'relevance'); assert.equal(s.format, ''); assert.equal(s.query.length, 200); });
test('saved import removes unknown IDs and duplicates', () => assert.deepEqual(validatedSaved({ ids: ['a', 'a', 'b', 1] }, new Set(['a'])), ['a']));
test('invalid import is rejected', () => assert.throws(() => validatedSaved({ data: 'bad' }, new Set())));
test('Jev textual mode does not ask for visual attributes', () => assert.deepEqual(Object.keys(makeQuestions()), ['category', 'scenario']));
test('Jev low-confidence answers stay out of tags', () => { const q = makeQuestions({ images: true }); const n = normalizeJev({ color: { choice: 'yellow', confidence: .5 } }, q); assert.equal(n.tags.length, 0); assert.ok(n.reviewFields.includes('color')); });
test('Jev output remains pending even above confidence threshold', () => { const q = makeQuestions({ images: true }); const n = normalizeJev({ color: { choice: 'yellow', confidence: .95 }, shape: { choice: 'unknown', confidence: 1 } }, q); assert.deepEqual(n.tags, ['yellow']); assert.equal(n.status, 'pending-review'); });
