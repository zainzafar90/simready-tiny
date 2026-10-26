const STALL_MS = 60000;
let viewerProbe = null;

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
export function createViewer({ stage, asset, modelUrl, entry, onState }) {
    let frame = null, timer = 0, generation = 0, ready = false;

    function stop() {
        generation++; ready = false;
        clearTimeout(timer);
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
            frame.src = entry + '#model=' + encodeURIComponent(modelUrl);
            stage.append(frame);
            timer = setTimeout(() => { if (current === generation) onState({ phase: 'loading', label: 'Still loading, large model', fraction: null }); }, STALL_MS);
        } catch (error) {
            if (current === generation) fail(error.message);
        }
    }
    function onProgress(fraction, stageName) {
        if (ready && (fraction === null || fraction >= 1)) onState({ phase: 'ready' });
        else onState({ phase: 'loading', label: stageLabel(stageName), fraction });
    }
    function onMessage(event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'atlas-viewer') return;
        const data = event.data;
        if (data.type === 'progress') onProgress(clampFraction(data.fraction), data.stage);
        if (data.type === 'ready') { ready = true; clearTimeout(timer); stage.classList.add('is-3d'); onState({ phase: 'ready' }); }
        if (data.type === 'error') fail(`3D preview unavailable: ${String(data.message || 'unknown error').slice(0, 240)}`);
        if (data.type === 'warning') console.warn('Atlas viewer warning', asset.id, String(data.message || '').slice(0, 300));
    }
    window.addEventListener('message', onMessage);
    return { load, stop, dispose() { stop(); window.removeEventListener('message', onMessage); } };
}
