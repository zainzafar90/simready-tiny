import { escapeHtml as e, safeUrl } from '../shared/html.js';
import { formatBytes } from '../shared/format.js';
import { copyText } from '../shared/browser-io.js';
import { icon } from '../shared/icons.js';
import { createViewer, modelSources } from './preview-viewer.js';
import { shouldAutoLoad, previewBytes } from './load-policy.js';
import { dialogMarkup, nearbyAssets } from './preview-markup.js';
import { createMenus } from './preview-menus.js';

const AUTO_LOAD_DELAY_MS = 250;
const DEFAULT_VIEWER = '/vendor/usd/index.html';

export function packageCommand(asset, revision = 'main') {
    const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
    return `hf download nvidia/simready-assets --repo-type dataset --revision ${quote(revision)} --include ${quote(asset.packagePath + '/*')} --local-dir ./simready`;
}

function viewModel(asset, options) {
    const { revision, context, saved, infoOpen = false } = options;
    const thumb = safeUrl(asset.thumbnailUrl, true);
    return {
        asset, saved, infoOpen, revision, thumb, ids: context.ids, index: context.index, nearby: nearbyAssets(context),
        image: safeUrl(asset.previewImageUrl || asset.remoteThumbnailUrl, true) || thumb,
        source: safeUrl(asset.sourceUrl), root: safeUrl(asset.usdUrl),
        command: packageCommand(asset, revision === 'preview' ? 'main' : revision),
    };
}

function createStageRenderer(dialog) {
    const status = dialog.querySelector('#viewer-status'), progress = dialog.querySelector('#viewer-progress');
    const action = dialog.querySelector('[data-detail="viewer"]');
    return view => {
        progress.hidden = view.phase !== 'loading';
        if (view.phase === 'loading') {
            progress.querySelector('.viewer-progress-label').textContent = view.fraction === null ? view.label : `${view.label} · ${Math.round(view.fraction * 100)}%`;
            progress.classList.toggle('indeterminate', view.fraction === null);
            progress.style.setProperty('--progress', String(view.fraction ?? 0));
        }
        status.textContent = view.phase === 'error' ? view.message : '';
        const label = view.phase === 'error' ? 'Retry' : view.phase === 'idle' ? view.label : '';
        action.hidden = !label;
        action.innerHTML = label ? icon('cube', 16) + e(label) : '';
    };
}

function startViewer(dialog, model, config) {
    const stage = dialog.querySelector('#detail-preview'), render = createStageRenderer(dialog);
    const modelUrls = modelSources({ upstream: model.root, usdPath: model.asset.usdPath, revision: model.revision, baseUrl: config.modelBaseUrl });
    if (!modelUrls.length) {
        dialog.querySelector('#viewer-status').textContent = 'No 3D model is indexed for this object.';
        return { viewer: null, timer: 0 };
    }
    const viewer = createViewer({ stage, asset: model.asset, modelUrls, entry: safeUrl(config.viewerUrl, true) || DEFAULT_VIEWER, onState: render });
    if (shouldAutoLoad(model.asset)) return { viewer, timer: setTimeout(viewer.load, AUTO_LOAD_DELAY_MS) };
    render({ phase: 'idle', label: `Load 3D · ${formatBytes(previewBytes(model.asset))}` });
    return { viewer, timer: 0 };
}

function bindImageFallback(dialog, thumb) {
    const stage = dialog.querySelector('#detail-preview'), image = stage.querySelector('img');
    if (!image) return;
    if (!image.complete) {
        stage.classList.add('is-loading');
        image.addEventListener('load', () => stage.classList.remove('is-loading'), { once: true });
    }
    image.addEventListener('error', function fallback() {
        if (thumb && image.src !== new URL(thumb, location.href).href) { image.src = thumb; return; }
        image.removeEventListener('error', fallback);
        stage.classList.remove('is-loading');
        image.remove();
        stage.insertAdjacentHTML('afterbegin', `<span class="missing-preview">${icon('cube', 54)}Preview unavailable</span>`);
    });
}

const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(target.tagName));

function createControls(dialog, model, options) {
    let saved = model.saved;
    const info = dialog.querySelector('#asset-info');
    const navigate = delta => { const id = model.ids[model.index + delta]; if (id) options.onNavigate(id); };
    function toggleInfo(force) {
        info.hidden = typeof force === 'boolean' ? !force : !info.hidden;
        const item = dialog.querySelector('#more-menu [data-detail="info"]');
        item.setAttribute('aria-expanded', String(!info.hidden));
        item.querySelector('span').textContent = info.hidden ? 'Show details' : 'Hide details';
        options.onInfoToggle?.(!info.hidden);
        if (!info.hidden && matchMedia('(max-width:800px)').matches) info.querySelector('button').focus();
        else if (info.hidden) dialog.querySelector('[data-detail="more"]').focus();
    }
    function save() {
        saved = options.onSave(model.asset.id);
        const button = dialog.querySelector('[data-detail="save"]');
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', saved ? 'Unsave asset' : 'Save asset');
        button.querySelector('span').textContent = saved ? 'Saved' : 'Save asset';
    }
    return { navigate, toggleInfo, save };
}

function shareLink(assetId) {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('asset', assetId);
    return url.href;
}

function bindEvents(dialog, model, options, { controls, menus, viewer }) {
    const { navigate, toggleInfo, save } = controls, { toast } = options;
    const actions = {
        close: options.onClose, previous: () => navigate(-1), next: () => navigate(1), save, collection: options.onCollection,
        info: () => toggleInfo(), 'info-close': () => toggleInfo(false), viewer: () => viewer?.load(),
        download: () => menus.toggle('download'), more: () => menus.toggle('more'),
        command: async () => { await copyText(model.command); toast('Package download command copied'); },
        share: async () => { await copyText(shareLink(model.asset.id)); toast('Asset link copied'); },
    };
    dialog.onclick = async ({ target }) => {
        if (!(target instanceof Element)) return;
        const tag = target.closest('[data-tag]'), strip = target.closest('[data-detail-id]');
        if (tag) return options.onTag(tag.dataset.tag);
        if (strip) return strip.dataset.detailId !== model.asset.id && options.onNavigate(strip.dataset.detailId);
        if (!target.closest('.menu-wrap') || target.closest('.download-menu a, .download-menu [data-detail]')) menus.closeAll();
        try { await actions[target.closest('[data-detail]')?.dataset.detail]?.(); } catch (error) { toast(error.message); }
    };
    const keys = { arrowright: () => navigate(1), arrowleft: () => navigate(-1), s: save, i: () => toggleInfo() };
    dialog.onkeydown = event => {
        const run = keys[event.key.toLowerCase()];
        if (!run || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        run();
    };
    dialog.oncancel = event => {
        event.preventDefault();
        if (!menus.closeOpen()) options.onClose();
    };
}

/** A 3D-first modal backed by a sharp image. */
export function openDetail(dialog, asset, options) {
    const model = viewModel(asset, options);
    dialog.innerHTML = dialogMarkup(model);
    const { viewer, timer } = startViewer(dialog, model, options.config);
    bindEvents(dialog, model, options, { controls: createControls(dialog, model, options), menus: createMenus(dialog), viewer });
    bindImageFallback(dialog, model.thumb);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-detail="close"]').focus({ preventScroll: true });
    dialog.querySelector('.film-thumb[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    return ({ keepOpen = false } = {}) => {
        clearTimeout(timer);
        viewer?.dispose();
        dialog.onclick = null; dialog.onkeydown = null;
        /* block native close while the next preview renders */
        dialog.oncancel = keepOpen ? event => event.preventDefault() : null;
        if (!keepOpen && dialog.open) dialog.close();
        dialog.replaceChildren();
    };
}
