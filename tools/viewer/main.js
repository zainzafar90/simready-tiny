import { createViewer } from '@huggingface/usd-web-viewer';
import './style.css';
const host = document.querySelector('#viewer'), message = document.querySelector('#message');
const send = (type, extra = {}) => parent.postMessage({ source: 'atlas-viewer', type, ...extra }, location.origin);
const controller = new AbortController();
const UPSTREAM = 'https://huggingface.co/datasets/nvidia/simready-assets/resolve/';
const PINNED_PATH = /^[0-9a-f]{40}\//;
let viewer;

async function mirrorBase() {
    const response = await fetch('/config.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    const { modelBaseUrl } = await response.json();
    if (typeof modelBaseUrl !== 'string' || !URL.canParse(modelBaseUrl)) return null;
    const base = new URL(modelBaseUrl);
    return base.protocol === 'https:' && !base.search && !base.hash ? base.href.replace(/\/?$/, '/') : null;
}

/* not an arbitrary URL proxy */
function isAllowedModel(url, mirror) {
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (url.href.startsWith(UPSTREAM)) return true;
    return !!mirror && url.href.startsWith(mirror) && PINNED_PATH.test(url.href.slice(mirror.length));
}

async function start() {
    try {
        const url = new URL(new URLSearchParams(location.hash.slice(1)).get('model'));
        if (!isAllowedModel(url, await mirrorBase()))
            throw new Error('Unsupported model origin.');
        const compact = matchMedia('(max-width:600px)').matches;
        viewer = createViewer(host, { background: '#373537', onContextLost: () => send('error', { message: 'GPU context lost. Close and reopen this preview.' }) });
        const { info } = await viewer.load(url.href, {
            textures: 'preview', maxTextureSize: compact ? 512 : 1024, maxConcurrentFetches: 8,
            maxLayerBytes: (compact ? 96 : 192) * 1024 * 1024, maxTextureBytes: (compact ? 48 : 96) * 1024 * 1024,
            maxLayers: 256, maxTriangles: compact ? 2000000 : 5000000, maxInstances: 20000, signal: controller.signal,
            onProgress: progress => { message.textContent = `Loading ${progress.stage || 'model'}…`; send('progress', { stage: progress.stage, fraction: progress.fraction }); }
        });
        message.hidden = true;
        send('ready');
        if (info?.warnings?.length)
            send('warning', { message: info.warnings.map(w => typeof w === 'string' ? w : JSON.stringify(w)).join('; ') });
    }
    catch (error) {
        message.hidden = false;
        message.textContent = error.message;
        send('error', { message: error.message });
    }
}
window.addEventListener('pagehide', () => { controller.abort(); if (typeof viewer?.dispose === 'function')
    viewer.dispose();
else if (typeof viewer?.destroy === 'function')
    viewer.destroy(); });
start();
