const STALL_MS = 60000;
const RETRY_DELAY_MS = 1500;
const MAX_AUTO_RETRIES = 1;
const TRANSIENT_ERROR = /could not fetch|failed to fetch|network|timed? ?out|429|50[234]/i;
const REVISION = /^[0-9a-f]{40}$/;
let viewerProbe = null;

/** Mirror first, Hugging Face as fallback. */
export function modelSources({ upstream, usdPath, revision, baseUrl }) {
    const sources = upstream ? [upstream] : [];
    if (!baseUrl) return sources;
    if (!URL.canParse(baseUrl) || new URL(baseUrl).protocol !== 'https:' || !REVISION.test(revision || '') || !usdPath) {
        console.warn('Ignoring invalid model mirror settings', { baseUrl, revision, usdPath });
        return sources;
    }
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return [new URL(`${revision}/${usdPath.split('/').map(encodeURIComponent).join('/')}`, base).href, ...sources];
}

export function isTransientViewerError(message) {
    return TRANSIENT_ERROR.test(String(message || ''));
}

export function viewerErrorMessage(message) {
    if (isTransientViewerError(message)) return 'Couldn’t reach Hugging Face. Check your connection and retry.';
    return `3D preview unavailable: ${String(message || 'unknown error').slice(0, 240)}`;
}

export function clampFraction(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

export function stageLabel(stage) {
    const text = typeof stage === 'string' ? stage.trim().slice(0, 40) : '';
    return text ? `Loading ${text}` : 'Loading model';
}

function probeViewer(entry) {
    viewerProbe ??= fetch(entry, { cache: 'no-cache' }).then(async response => {
        if (!response.ok || !(await response.text()).includes('atlas-usd-viewer')) throw new Error('The 3D viewer is not installed. Run npm run viewer:setup, then rebuild.');
    }).catch(error => { viewerProbe = null; throw error; });
    return viewerProbe;
}

/** One isolated viewer iframe; reports phase changes. */
export function createViewer({ stage, asset, modelUrls, entry, onState }) {
    let frame = null, timer = 0, retryTimer = 0, retries = 0, source = 0, generation = 0, ready = false;

    function stop() {
        generation++; ready = false;
        clearTimeout(timer); clearTimeout(retryTimer);
        frame?.remove(); frame = null;
        stage.classList.remove('is-3d');
    }
    function fail(message) {
        stop();
        onState({ phase: 'error', message });
    }
    async function load() {
        if (frame) return;
        const current = ++generation;
        onState({ phase: 'loading', label: 'Loading model', fraction: null });
        try {
            if (new URL(entry, location.href).origin !== location.origin) throw new Error('The viewer must be installed on the same origin as this site.');
            await probeViewer(entry);
            if (current !== generation) return;
            frame = document.createElement('iframe');
            frame.title = `Interactive 3D: ${asset.name}`;
            frame.referrerPolicy = 'no-referrer';
            frame.src = entry + '#model=' + encodeURIComponent(modelUrls[source]);
            stage.append(frame);
            timer = setTimeout(() => { if (current === generation) onState({ phase: 'loading', label: 'Still loading, large model', fraction: null }); }, STALL_MS);
        } catch (error) {
            if (current === generation) fail(error.message);
        }
    }
    function restart(label, delay) {
        stop();
        onState({ phase: 'loading', label, fraction: null });
        retryTimer = setTimeout(load, delay);
    }
    function retryOrFail(message) {
        if (isTransientViewerError(message) && retries < MAX_AUTO_RETRIES) { retries++; return restart('Connection hiccup, retrying', RETRY_DELAY_MS); }
        if (source < modelUrls.length - 1) { source++; retries = 0; return restart('Trying the original source', 0); }
        fail(viewerErrorMessage(message));
    }
    function onProgress(fraction, stageName) {
        if (ready && (fraction === null || fraction >= 1)) onState({ phase: 'ready' });
        else onState({ phase: 'loading', label: stageLabel(stageName), fraction });
    }
    function onMessage(event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'atlas-viewer') return;
        const data = event.data;
        if (data.type === 'progress') onProgress(clampFraction(data.fraction), data.stage);
        if (data.type === 'ready') { ready = true; retries = 0; clearTimeout(timer); stage.classList.add('is-3d'); onState({ phase: 'ready' }); }
        if (data.type === 'error') {
            console.warn('Atlas viewer error', asset.id, String(data.message || '').slice(0, 300));
            retryOrFail(data.message);
        }
        if (data.type === 'warning') console.warn('Atlas viewer warning', asset.id, String(data.message || '').slice(0, 300));
    }
    window.addEventListener('message', onMessage);
    return { load, stop, dispose() { stop(); window.removeEventListener('message', onMessage); } };
}
