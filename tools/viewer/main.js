import { createViewer } from '@huggingface/usd-web-viewer';
import './style.css';
const host = document.querySelector('#viewer'), message = document.querySelector('#message');
const send = (type, extra = {}) => parent.postMessage({ source: 'atlas-viewer', type, ...extra }, location.origin);
const controller = new AbortController();
let viewer;
async function start() {
    try {
        const raw = new URLSearchParams(location.hash.slice(1)).get('model');
        const url = new URL(raw);
        /* not an arbitrary URL proxy */
        const mirror = url.protocol === 'https:' && url.hostname === 'simready-models.zainzafar.net' && /^\/[0-9a-f]{40}\//.test(url.pathname);
        const upstream = url.protocol === 'https:' && url.hostname === 'huggingface.co' && url.pathname.startsWith('/datasets/nvidia/simready-assets/resolve/');
        const selfHosted = url.origin === location.origin && url.pathname.startsWith('/preview-models/');
        if (!mirror && !upstream && !selfHosted)
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
