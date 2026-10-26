import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSecurityPolicy, modelHosts } from '../scripts/serve.mjs';
import { headersFile } from '../scripts/build.mjs';
import { readCapped } from '../scripts/mirror-thumbs.mjs';

test('CSP only allows the model mirror and Hugging Face hosts', () => {
    const csp = contentSecurityPolicy({ modelBaseUrl: 'https://models.example.com/' });
    assert.match(csp, /connect-src 'self' https:\/\/models\.example\.com https:\/\/huggingface\.co/);
    assert.doesNotMatch(csp, /(connect|img)-src[^;]* https: /);
    assert.equal(modelHosts({ modelBaseUrl: 'http://insecure.example.com/' }).includes('insecure'), false);
    assert.equal(modelHosts({ modelBaseUrl: 'not a url' }).includes('not'), false);
});

test('deployed headers include HSTS, COOP and a viewer-only framing exception', () => {
    const headers = headersFile("default-src 'self'; frame-ancestors 'none'");
    assert.match(headers, /Strict-Transport-Security: max-age=31536000/);
    assert.match(headers, /Cross-Origin-Opener-Policy: same-origin/);
    assert.match(headers, /\/vendor\/usd\/\*\n {2}! Content-Security-Policy\n {2}Content-Security-Policy: [^\n]*frame-ancestors 'self'/);
});

test('thumbnail reads stop at the size cap', async () => {
    async function* body() { yield Buffer.alloc(3); yield Buffer.alloc(3); }
    await assert.rejects(readCapped(body(), 5), /exceeds 5 bytes/);
    assert.equal((await readCapped(body(), 6)).length, 6);
});
