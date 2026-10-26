import test from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl, renderIndex } from '../scripts/site-config.mjs';

test('site URL must be absolute https, normalized with a trailing slash', () => {
    assert.equal(siteUrl({ siteUrl: 'https://example.com' }), 'https://example.com/');
    assert.equal(siteUrl({ siteUrl: 'http://example.com/' }), '/');
    assert.equal(siteUrl({ siteUrl: 'https://example.com/?x=1' }), '/');
    assert.equal(siteUrl({}), '/');
});

test('index placeholders are filled from config and catalog size', () => {
    const html = '<link rel="canonical" href="%SITE_URL%"><meta content="%SITE_URL%og.jpg"><title>%ASSET_COUNT% models</title>';
    assert.equal(renderIndex(html, { siteUrl: 'https://fork.example/' }, 12500), '<link rel="canonical" href="https://fork.example/"><meta content="https://fork.example/og.jpg"><title>12,500 models</title>');
    assert.throws(() => renderIndex(html, {}, undefined), /asset count/);
});
