import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './io.mjs';

const SITE_URL = '%SITE_URL%', ASSET_COUNT = '%ASSET_COUNT%';

export function readSiteConfig(root = ROOT) {
    return JSON.parse(readFileSync(resolve(root, 'public/config.json'), 'utf8'));
}

/** Absolute https site URL with trailing slash, else '/'. */
export function siteUrl(config) {
    const value = config?.siteUrl;
    if (typeof value !== 'string' || !URL.canParse(value)) return '/';
    const url = new URL(value);
    return url.protocol === 'https:' && !url.search && !url.hash ? url.href.replace(/\/?$/, '/') : '/';
}

export function readAssetCount(root = ROOT) {
    return JSON.parse(readFileSync(resolve(root, 'public/catalog-manifest.json'), 'utf8')).count;
}

export function renderIndex(html, config, assetCount) {
    if (!Number.isInteger(assetCount) || assetCount < 1) throw new Error(`index.html needs a positive asset count, got ${assetCount}.`);
    return html.replaceAll(SITE_URL, siteUrl(config)).replaceAll(ASSET_COUNT, assetCount.toLocaleString('en-US'));
}
