import { escapeHtml as e, safeUrl, formatBytes, copyText } from './utils.js';
import { icon } from './icons.js';
import { createViewer, modelSources } from './detail-viewer.js';
import { shouldAutoLoad, previewBytes } from './load-policy.js';

const AUTO_LOAD_DELAY_MS = 250;

export function packageCommand(asset, revision = 'main') {
    const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
    return `hf download nvidia/simready-assets --repo-type dataset --revision ${quote(revision)} --include ${quote(asset.packagePath + '/*')} --local-dir ./simready`;
}
/** A 3D-first modal backed by a sharp image. */
export function openDetail(dialog, asset, options) {
    const { revision, config, onSave, onTag, onClose, onCollection, onNavigate, onInfoToggle, toast, context, infoOpen = false } = options;
    let saved = options.saved;
    const command = packageCommand(asset, revision === 'preview' ? 'main' : revision);
    const thumb = safeUrl(asset.thumbnailUrl, true), image = safeUrl(asset.previewImageUrl || asset.remoteThumbnailUrl, true) || thumb, source = safeUrl(asset.sourceUrl), root = safeUrl(asset.usdUrl);
    const aiTags = new Set(asset.ai?.tags || []);
    const { ids, index, assets } = context;
    const stripStart = Math.max(0, Math.min(index - 4, ids.length - 9));
    const nearby = ids.slice(stripStart, stripStart + 9).map(id => assets.get(id)).filter(Boolean);
    let autoTimer = 0;

    dialog.innerHTML = `
      <header class="preview-topbar">
        <div class="preview-top-left"><button class="icon-btn preview-close" data-detail="close" aria-label="Close asset preview" title="Close (Esc)">${icon('close')}</button><span class="preview-position">${index + 1} / ${ids.length.toLocaleString()}</span></div>
        <nav class="filmstrip" aria-label="Nearby search results">${nearby.map(a => {
            const url = safeUrl(a.thumbnailUrl, true);
            return `<button class="film-thumb" data-detail-id="${e(a.id)}" aria-label="Preview ${e(a.name)}" aria-current="${a.id === asset.id}" title="${e(a.name)}">${url ? `<img src="${e(url)}" alt="" width="38" height="38" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : icon('cube', 19)}</button>`;
        }).join('')}</nav>
        <div class="preview-actions">
          <div class="menu-wrap"><button class="button soft" data-detail="download" aria-label="Download options" aria-expanded="false" aria-controls="download-menu">${icon('download', 16)}<span>Download</span></button><div id="download-menu" class="download-menu" hidden>${source ? `<a href="${e(source)}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}Open full source package</a>` : ''}<button data-detail="command">${icon('copy', 15)}Copy package command</button>${root ? `<a href="${e(root)}" target="_blank" rel="noopener noreferrer">${icon('download', 15)}Download root layer only</a>` : ''}</div></div>
          <div class="menu-wrap"><button class="icon-btn" data-detail="more" aria-label="More actions" aria-expanded="false" aria-controls="more-menu" title="More">${icon('more', 17)}</button><div id="more-menu" class="download-menu" hidden><button data-detail="info" aria-expanded="${infoOpen}" aria-controls="asset-info">${icon('panel', 15)}<span>${infoOpen ? 'Hide details' : 'Show details'}</span><kbd>I</kbd></button><button data-detail="collection">${icon('folderPlus', 15)}Add to collection</button><button data-detail="share">${icon('share', 15)}Copy link</button></div></div>
          <button class="button soft" data-detail="save" aria-label="Save asset" aria-pressed="${saved}">${icon('heart', 16)}<span>${saved ? 'Saved' : 'Save asset'}</span></button>
        </div>
      </header>
      <div class="preview-body">
        <div class="preview-main">
          <button class="icon-btn preview-nav preview-prev" data-detail="previous" aria-label="Previous object" title="Previous (←)" ${index <= 0 ? 'disabled' : ''}>${icon('arrowLeft')}</button>
          <div class="stage-frame"><div class="detail-preview" id="detail-preview">${image ? `<img src="${e(image)}" alt="${e(asset.name)} preview" width="660" height="660" decoding="async" fetchpriority="high" referrerpolicy="no-referrer">` : `<span class="missing-preview">${icon('cube', 54)}No preview available</span>`}<div class="viewer-progress" id="viewer-progress" hidden><span class="viewer-progress-label"></span><span class="viewer-progress-bar"><i></i></span></div></div></div>
          <div class="preview-caption"><div><h2 id="detail-title">${e(asset.name)}</h2><p>${e(asset.category)}</p></div><button class="button" data-detail="viewer" hidden></button></div>
          <div class="viewer-status" id="viewer-status" role="status" aria-live="polite"></div>
          <button class="icon-btn preview-nav preview-next" data-detail="next" aria-label="Next object" title="Next (→)" ${index >= ids.length - 1 ? 'disabled' : ''}>${icon('arrow')}</button>
        </div>
        <aside id="asset-info" class="detail-info" aria-label="Asset details" ${infoOpen ? '' : 'hidden'}>
          <div class="info-heading"><strong>Object details</strong><button class="small-icon" data-detail="info-close" aria-label="Hide asset details">${icon('close', 16)}</button></div>
          <span class="detail-category">${e(asset.category)}</span><h3>${e(asset.name)}</h3>
          ${asset.description ? `<p class="detail-description">${e(asset.description)}</p>` : ''}
          <p class="section-label">DISCOVERY TAGS</p><div class="tag-list">${(asset.tags || []).slice(0, 20).map(tag => `<button class="tag ${aiTags.has(tag) ? 'ai' : ''}" data-tag="${e(tag)}" title="${aiTags.has(tag) ? 'Reviewed AI suggestion, not a verified physical property' : 'Filename / curated taxonomy'}">${e(tag)}</button>`).join('')}</div>
          <p class="section-label">SOURCE DETAILS</p><dl class="metadata"><div><dt>Format</dt><dd>${e(asset.fileType.toUpperCase())}</dd></div><div><dt>Root layer</dt><dd>${e(formatBytes(asset.usdSizeBytes))}</dd></div>${Number.isFinite(asset.previewSizeBytes) ? `<div><dt>3D preview</dt><dd>${e(formatBytes(asset.previewSizeBytes))}</dd></div>` : ''}<div><dt>Full package</dt><dd>${e(formatBytes(asset.packageSizeBytes))}</dd></div></dl>
          <div class="command-wrap"><p>DOWNLOAD FULL PACKAGE · HUGGING FACE CLI</p><code>${e(command)}</code><button data-detail="command">${icon('copy', 12)} Copy command</button></div>
          <p class="detail-footer">${e(asset.packagePath)} · ${e(revision.slice(0, 12))}<br>Visual preview only. Check the source package for physics and license.</p>
        </aside>
      </div>`;
    const status = dialog.querySelector('#viewer-status');
    const stage = dialog.querySelector('#detail-preview');
    const actionButton = dialog.querySelector('[data-detail="viewer"]');
    const progress = dialog.querySelector('#viewer-progress');
    const info = dialog.querySelector('#asset-info');
    const menus = { download: dialog.querySelector('#download-menu'), more: dialog.querySelector('#more-menu') };

    function showAction(label) {
        actionButton.hidden = !label;
        actionButton.innerHTML = label ? icon('cube', 16) + e(label) : '';
    }
    function render(view) {
        progress.hidden = view.phase !== 'loading';
        if (view.phase === 'loading') {
            progress.querySelector('.viewer-progress-label').textContent = view.fraction === null ? view.label : `${view.label} · ${Math.round(view.fraction * 100)}%`;
            progress.classList.toggle('indeterminate', view.fraction === null);
            progress.style.setProperty('--progress', String(view.fraction ?? 0));
        }
        status.textContent = view.phase === 'error' ? view.message : '';
        showAction(view.phase === 'error' ? 'Retry' : view.phase === 'idle' ? view.label : '');
    }
    const modelUrls = modelSources({ upstream: root, usdPath: asset.usdPath, revision, baseUrl: config.modelBaseUrl });
    const viewer = modelUrls.length ? createViewer({ stage, asset, modelUrls, entry: safeUrl(config.viewerUrl, true) || '/vendor/usd/index.html', onState: render }) : null;
    if (!viewer) status.textContent = 'No 3D model is indexed for this object.';
    else if (shouldAutoLoad(asset)) autoTimer = setTimeout(viewer.load, AUTO_LOAD_DELAY_MS);
    else render({ phase: 'idle', label: `Load 3D · ${formatBytes(previewBytes(asset))}` });

    function toggleInfo(force) {
        info.hidden = typeof force === 'boolean' ? !force : !info.hidden;
        const item = dialog.querySelector('#more-menu [data-detail="info"]');
        item.setAttribute('aria-expanded', String(!info.hidden));
        item.querySelector('span').textContent = info.hidden ? 'Show details' : 'Hide details';
        onInfoToggle?.(!info.hidden);
        if (!info.hidden && matchMedia('(max-width:800px)').matches) info.querySelector('button').focus();
        else if (info.hidden) dialog.querySelector('[data-detail="more"]').focus();
    }
    function save() {
        saved = onSave(asset.id);
        const button = dialog.querySelector('[data-detail="save"]');
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', saved ? 'Unsave asset' : 'Save asset');
        button.querySelector('span').textContent = saved ? 'Saved' : 'Save asset';
    }
    function navigate(delta) { if (ids[index + delta]) onNavigate(ids[index + delta]); }
    function setMenu(name, open) {
        menus[name].hidden = !open;
        dialog.querySelector(`[data-detail="${name}"]`).setAttribute('aria-expanded', String(open));
        if (open) menus[name].querySelector('a,button')?.focus();
    }
    const openMenu = () => Object.keys(menus).find(name => !menus[name].hidden);
    function closeMenus() { for (const name of Object.keys(menus)) if (!menus[name].hidden) setMenu(name, false); }
    function toggleMenu(name) {
        const wasOpen = !menus[name].hidden;
        closeMenus();
        if (!wasOpen) setMenu(name, true);
    }
    dialog.onclick = async event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const tag = target.closest('[data-tag]');
        const stripItem = target.closest('[data-detail-id]');
        if (tag) { onTag(tag.dataset.tag); return; }
        if (stripItem) { if (stripItem.dataset.detailId !== asset.id) onNavigate(stripItem.dataset.detailId); return; }
        const action = target.closest('[data-detail]')?.dataset.detail;
        if (!target.closest('.menu-wrap') || target.closest('.download-menu a, .download-menu [data-detail]')) closeMenus();
        try {
            if (action === 'close') onClose();
            if (action === 'previous') navigate(-1);
            if (action === 'next') navigate(1);
            if (action === 'info' || action === 'info-close') toggleInfo(action === 'info-close' ? false : undefined);
            if (action === 'viewer') await viewer?.load();
            if (action === 'save') save();
            if (action === 'collection') onCollection();
            if (action === 'download' || action === 'more') toggleMenu(action);
            if (action === 'command') { await copyText(command); toast('Package download command copied'); }
            if (action === 'share') {
                const url = new URL(location.pathname, location.origin); url.searchParams.set('asset', asset.id);
                await copyText(url.href); toast('Asset link copied');
            }
        } catch (error) { toast(error.message); }
    };
    dialog.onkeydown = event => {
        if (event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName))) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
        if (event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
        if (event.key.toLowerCase() === 'i') { event.preventDefault(); toggleInfo(); }
    };
    dialog.oncancel = event => {
        event.preventDefault();
        const name = openMenu();
        if (name) { setMenu(name, false); dialog.querySelector(`[data-detail="${name}"]`).focus(); }
        else onClose();
    };
    const previewImage = dialog.querySelector('.detail-preview > img');
    if (previewImage && !previewImage.complete) {
        stage.classList.add('is-loading');
        previewImage.addEventListener('load', () => stage.classList.remove('is-loading'), { once: true });
    }
    previewImage?.addEventListener('error', function fallback(event) {
        if (thumb && event.target.src !== new URL(thumb, location.href).href) { event.target.src = thumb; return; }
        event.target.removeEventListener('error', fallback);
        stage.classList.remove('is-loading');
        event.target.remove(); stage.insertAdjacentHTML('afterbegin', `<span class="missing-preview">${icon('cube', 54)}Preview unavailable</span>`);
    });
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-detail="close"]').focus({ preventScroll: true });
    dialog.querySelector('.film-thumb[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    return ({ keepOpen = false } = {}) => {
        clearTimeout(autoTimer); viewer?.dispose();
        dialog.onclick = null; dialog.oncancel = null; dialog.onkeydown = null;
        if (!keepOpen && dialog.open) dialog.close();
        dialog.replaceChildren();
    };
}
