import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './io.mjs';

const PLACEHOLDER = '%SITE_URL%';

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

export function renderIndex(html, config) {
    return html.replaceAll(PLACEHOLDER, siteUrl(config));
}
