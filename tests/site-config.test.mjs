import test from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl, renderIndex } from '../scripts/site-config.mjs';

test('site URL must be absolute https, normalized with a trailing slash', () => {
    assert.equal(siteUrl({ siteUrl: 'https://example.com' }), 'https://example.com/');
    assert.equal(siteUrl({ siteUrl: 'http://example.com/' }), '/');
    assert.equal(siteUrl({ siteUrl: 'https://example.com/?x=1' }), '/');
    assert.equal(siteUrl({}), '/');
});

test('index placeholders are filled from config', () => {
    const html = '<link rel="canonical" href="%SITE_URL%"><meta content="%SITE_URL%og.jpg">';
    assert.equal(renderIndex(html, { siteUrl: 'https://fork.example/' }), '<link rel="canonical" href="https://fork.example/"><meta content="https://fork.example/og.jpg">');
});
