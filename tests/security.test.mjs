import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSecurityPolicy, modelHosts } from '../scripts/serve.mjs';
import { headersFile } from '../scripts/build.mjs';
import { readCapped } from '../scripts/mirror-thumbs.mjs';
import { dialogMarkup } from '../src/preview/preview-markup.js';

test('CSP only allows the model mirror and Hugging Face hosts', () => {
    const csp = contentSecurityPolicy({ modelBaseUrl: 'https://models.example.com/' });
    assert.match(csp, /connect-src 'self' https:\/\/models\.example\.com https:\/\/huggingface\.co/);
    assert.match(csp, /img-src 'self' data: blob: https:\/\/models\.example\.com https:\/\/huggingface\.co/);
    assert.doesNotMatch(csp, /(connect|img)-src[^;]*\shttps:[\s;]/);
    assert.equal(modelHosts({ modelBaseUrl: 'http://insecure.example.com/' }).includes('insecure'), false);
    assert.equal(modelHosts({ modelBaseUrl: 'not a url' }).includes('not'), false);
});

test('deployed headers include HSTS, COOP and a viewer-only framing exception', () => {
    const headers = headersFile("default-src 'self'; frame-ancestors 'none'");
    assert.match(headers, /Strict-Transport-Security: max-age=31536000/);
    assert.match(headers, /Cross-Origin-Opener-Policy: same-origin/);
    assert.match(headers, /X-Content-Type-Options: nosniff/);
    assert.match(headers, /\/vendor\/usd\/\*\n {2}! Content-Security-Policy\n {2}Content-Security-Policy: [^\n]*frame-ancestors 'self'/);
});

test('thumbnail reads stop at the size cap', async () => {
    async function* body() { yield Buffer.alloc(3); yield Buffer.alloc(3); }
    await assert.rejects(readCapped(body(), 5), /exceeds 5 bytes/);
    assert.equal((await readCapped(body(), 6)).length, 6);
});

test('asset preview markup escapes hostile catalog values', () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const asset = { id: evil, name: evil, category: evil, tags: [evil], packagePath: evil, fileType: 'usd', description: evil, thumbnailUrl: 'javascript:alert(1)' };
    const html = dialogMarkup({ asset, nearby: [asset], ids: [asset.id], index: 0, saved: false, infoOpen: true, image: '', command: evil, revision: evil, source: '', root: '' });
    assert.equal(html.includes('<img src=x'), false);
    assert.equal(html.includes('javascript:'), false);
    assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
});
