const STALL_MS = 60000;
const RETRY_DELAY_MS = 1500;
const MAX_AUTO_RETRIES = 1;
const TRANSIENT_ERROR = /could not fetch|failed to fetch|network|timed? ?out|429|50[234]/i;
const REVISION = /^[0-9a-f]{40}$/;
let viewerProbe = null;

const isHttps = value => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

/** Mirror first, Hugging Face as fallback. */
export function modelSources({ upstream, usdPath, revision, baseUrl }) {
    const sources = upstream ? [upstream] : [];
    if (!baseUrl) return sources;
    if (!isHttps(baseUrl) || !REVISION.test(revision || '') || !usdPath) {
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
    if (isTransientViewerError(message)) return 'Couldn’t download the 3D model. Check your connection and retry.';
    return `3D preview unavailable: ${String(message || 'unknown error').slice(0, 240)}`;
}

function clampFraction(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

function stageLabel(stage) {
    const text = typeof stage === 'string' ? stage.trim().slice(0, 40) : '';
    return text ? `Loading ${text}` : 'Loading model';
}

function probeViewer(entry) {
    viewerProbe ??= fetch(entry, { cache: 'no-cache' }).then(async response => {
        if (!response.ok || !(await response.text()).includes('simready-usd-viewer')) throw new Error('The 3D viewer is not installed. Run npm run viewer:setup, then rebuild.');
    }).catch(error => { viewerProbe = null; throw error; });
    return viewerProbe;
}

const VIEWER_SOURCE = 'simready-viewer';

/** One isolated viewer iframe; reports phase changes. */
class PreviewViewer {
    #frame = null; #timer = 0; #retryTimer = 0; #retries = 0; #source = 0; #generation = 0; #ready = false;

    constructor({ stage, asset, modelUrls, entry, onState }) {
        Object.assign(this, { stage, asset, modelUrls, entry, onState });
        window.addEventListener('message', this.#onMessage);
    }

    stop = () => {
        this.#generation++;
        this.#ready = false;
        clearTimeout(this.#timer);
        clearTimeout(this.#retryTimer);
        this.#frame?.remove();
        this.#frame = null;
        this.stage.classList.remove('is-3d');
    };

    dispose = () => {
        this.stop();
        window.removeEventListener('message', this.#onMessage);
    };

    load = async () => {
        if (this.#frame) return;
        const current = ++this.#generation;
        this.onState({ phase: 'loading', label: 'Loading model', fraction: null });
        try {
            if (new URL(this.entry, location.href).origin !== location.origin) throw new Error('The viewer must be installed on the same origin as this site.');
            await probeViewer(this.entry);
            if (current === this.#generation) this.#mountFrame(current);
        } catch (error) {
            if (current === this.#generation) this.#fail(error.message);
        }
    };

    #mountFrame(current) {
        const frame = document.createElement('iframe');
        frame.title = `Interactive 3D: ${this.asset.name}`;
        frame.referrerPolicy = 'no-referrer';
        frame.src = `${this.entry}#model=${encodeURIComponent(this.modelUrls[this.#source])}`;
        this.stage.append(frame);
        this.#frame = frame;
        this.#timer = setTimeout(() => { if (current === this.#generation) this.onState({ phase: 'loading', label: 'Still loading, large model', fraction: null }); }, STALL_MS);
    }

    #fail(message) {
        this.stop();
        this.onState({ phase: 'error', message });
    }

    #restart(label, delay) {
        this.stop();
        this.onState({ phase: 'loading', label, fraction: null });
        this.#retryTimer = setTimeout(this.load, delay);
    }

    #retryOrFail(message) {
        if (isTransientViewerError(message) && this.#retries < MAX_AUTO_RETRIES) { this.#retries++; return this.#restart('Connection hiccup, retrying', RETRY_DELAY_MS); }
        if (this.#source < this.modelUrls.length - 1) { this.#source++; this.#retries = 0; return this.#restart('Trying the original source', 0); }
        this.#fail(viewerErrorMessage(message));
    }

    #onProgress(fraction, stageName) {
        if (this.#ready && (fraction === null || fraction >= 1)) this.onState({ phase: 'ready' });
        else this.onState({ phase: 'loading', label: stageLabel(stageName), fraction });
    }

    #onReady() {
        this.#ready = true;
        this.#retries = 0;
        clearTimeout(this.#timer);
        this.stage.classList.add('is-3d');
        this.onState({ phase: 'ready' });
    }

    #onMessage = event => {
        if (!this.#frame || event.source !== this.#frame.contentWindow || event.origin !== location.origin || event.data?.source !== VIEWER_SOURCE) return;
        const { type, fraction, stage, message } = event.data;
        const detail = String(message || '').slice(0, 300);
        if (type === 'progress') this.#onProgress(clampFraction(fraction), stage);
        if (type === 'ready') this.#onReady();
        if (type === 'error') { console.warn('Viewer error', this.asset.id, detail); this.#retryOrFail(message); }
        if (type === 'warning') console.warn('Viewer warning', this.asset.id, detail);
    };
}

export function createViewer(options) {
    return new PreviewViewer(options);
}
