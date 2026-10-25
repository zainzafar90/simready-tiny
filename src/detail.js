import { escapeHtml as e, safeUrl, formatBytes, copyText } from './utils.js';
import { icon } from './icons.js';

export function packageCommand(asset, revision = 'main') {
    const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
    return `hf download nvidia/simready-assets --repo-type dataset --revision ${quote(revision)} --include ${quote(asset.packagePath + '/*')} --local-dir ./simready`;
}
/** A thumbnail-first modal. No viewer dependency is imported by the gallery. */
export function openDetail(dialog, asset, options) {
    const { revision, config, onSave, onTag, onClose, onCollection, onNavigate, toast, context, infoOpen = false } = options;
    let saved = options.saved;
    const command = packageCommand(asset, revision === 'preview' ? 'main' : revision);
    const thumb = safeUrl(asset.thumbnailUrl, true), source = safeUrl(asset.sourceUrl), root = safeUrl(asset.usdUrl);
    const aiTags = new Set(asset.ai?.tags || []);
    const { ids, index, assets } = context;
    const stripStart = Math.max(0, Math.min(index - 4, ids.length - 9));
    const nearby = ids.slice(stripStart, stripStart + 9).map(id => assets.get(id)).filter(Boolean);
    let alive = true, frame = null, viewerTimer = 0, loadGeneration = 0, controller = null;

    dialog.innerHTML = `
      <header class="preview-topbar">
        <div class="preview-top-left"><button class="icon-btn preview-close" data-detail="close" aria-label="Close asset preview" title="Close (Esc)">${icon('close')}</button><span class="preview-position">${index + 1} / ${ids.length.toLocaleString()}</span></div>
        <nav class="filmstrip" aria-label="Nearby search results">${nearby.map(a => {
            const url = safeUrl(a.thumbnailUrl, true);
            return `<button class="film-thumb" data-detail-id="${e(a.id)}" aria-label="Preview ${e(a.name)}" aria-current="${a.id === asset.id}" title="${e(a.name)}">${url ? `<img src="${e(url)}" alt="" width="38" height="38" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : icon('cube', 19)}</button>`;
        }).join('')}</nav>
        <div class="preview-actions">
          <div class="download-wrap"><button class="icon-btn" data-detail="download" aria-label="Download options" aria-expanded="false" aria-controls="download-menu" title="Download options">${icon('download', 17)}</button><div id="download-menu" class="download-menu" hidden>${source ? `<a href="${e(source)}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}Open full source package</a>` : ''}<button data-detail="command">${icon('copy', 15)}Copy package command</button>${root ? `<a href="${e(root)}" target="_blank" rel="noopener noreferrer">${icon('download', 15)}Download root layer only</a>` : ''}<p>USD layers can reference textures and other files. Keep the full package together.</p></div></div>
          <button class="icon-btn" data-detail="share" aria-label="Copy asset link" title="Copy link">${icon('share', 17)}</button>
          <button class="icon-btn" data-detail="collection" aria-label="Add to collection" title="Add to collection">${icon('folderPlus', 17)}</button>
          <button class="icon-btn ${infoOpen ? 'active' : ''}" data-detail="info" aria-label="Show asset details" aria-expanded="${infoOpen}" aria-controls="asset-info" title="Details (I)">${icon('panel', 17)}</button>
          <button class="button soft" data-detail="save" aria-label="Save asset" aria-pressed="${saved}">${icon('heart', 16)}<span>${saved ? 'Saved' : 'Save asset'}</span></button>
        </div>
      </header>
      <div class="preview-body">
        <div class="preview-main">
          <button class="icon-btn preview-nav preview-prev" data-detail="previous" aria-label="Previous object" title="Previous (←)" ${index <= 0 ? 'disabled' : ''}>${icon('arrowLeft')}</button>
          <div class="stage-frame"><div class="detail-preview" id="detail-preview">${thumb ? `<img src="${e(thumb)}" alt="${e(asset.name)} preview" width="660" height="660" decoding="async" referrerpolicy="no-referrer">` : `<span class="missing-preview">${icon('cube', 54)}No preview available</span>`}<span class="preview-type">${icon('cube', 12)}${e(asset.fileType.toUpperCase())} · Image preview</span></div></div>
          <div class="preview-caption"><div><h2 id="detail-title">${e(asset.name)}</h2><p>${e(asset.category)}</p></div><div class="preview-controls"><button class="button" data-detail="viewer">${icon('cube', 16)}Explore in 3D</button><button class="button" data-detail="stop" hidden>Stop 3D</button></div></div>
          <div class="viewer-status" id="viewer-status" role="status" aria-live="polite"></div>
          <div class="preview-hint"><span><kbd>←</kbd><kbd>→</kbd> to browse</span><span><kbd>S</kbd> to save</span><span><kbd>I</kbd> for details</span></div>
          <button class="icon-btn preview-nav preview-next" data-detail="next" aria-label="Next object" title="Next (→)" ${index >= ids.length - 1 ? 'disabled' : ''}>${icon('arrow')}</button>
        </div>
        <aside id="asset-info" class="detail-info" aria-label="Asset details" ${infoOpen ? '' : 'hidden'}>
          <div class="info-heading"><strong>Object details</strong><button class="small-icon" data-detail="info-close" aria-label="Hide asset details">${icon('close', 16)}</button></div>
          <span class="detail-category">${e(asset.category)}</span><h3>${e(asset.name)}</h3>
          <p class="detail-description">${e(asset.description || `${asset.name}, from NVIDIA’s SimReady collection. Explore the source package for its layers, materials, and metadata.`)}</p>
          <p class="section-label">DISCOVERY TAGS</p><div class="tag-list">${(asset.tags || []).slice(0, 20).map(tag => `<button class="tag ${aiTags.has(tag) ? 'ai' : ''}" data-tag="${e(tag)}" title="${aiTags.has(tag) ? 'Reviewed AI suggestion, not a verified physical property' : 'Filename / curated taxonomy'}">${e(tag)}</button>`).join('')}</div>
          <p class="section-label">SOURCE DETAILS</p><dl class="metadata"><div><dt>Format</dt><dd>${e(asset.fileType.toUpperCase())}</dd></div><div><dt>Root layer size</dt><dd>${e(formatBytes(asset.usdSizeBytes))}</dd></div><div><dt>Indexed package</dt><dd>${e(formatBytes(asset.packageSizeBytes))}</dd></div><div><dt>Catalog labels</dt><dd>Filename + taxonomy${asset.ai ? ' + AI' : ''}</dd></div><div><dt>Physical properties</dt><dd>Not verified by Atlas</dd></div><div><dt>License</dt><dd>Check source package</dd></div></dl>
          <div class="detail-warning"><strong>A visual preview, not a simulation.</strong>Check source metadata for physical behavior. Model and thumbnail rights belong to their original owners. Confirm licensing before reuse.</div>
          <div class="detail-actions">${source ? `<a class="button" href="${e(source)}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}Open source package</a>` : ''}</div>
          <div class="command-wrap"><p>DOWNLOAD FULL PACKAGE · HUGGING FACE CLI</p><code>${e(command)}</code><button data-detail="command">${icon('copy', 12)} Copy command</button></div>
          <p class="detail-footer">${e(asset.packagePath)}<br>Revision: ${e(revision)}${asset.ai ? '<br>Dashed tags are AI suggestions, not simulation metadata.' : ''}</p>
        </aside>
      </div>`;
    const status = dialog.querySelector('#viewer-status');
    const stage = dialog.querySelector('#detail-preview');
    const loadButton = dialog.querySelector('[data-detail="viewer"]');
    const stopButton = dialog.querySelector('[data-detail="stop"]');
    const info = dialog.querySelector('#asset-info');
    const downloadMenu = dialog.querySelector('#download-menu');

    function stop() {
        loadGeneration++;
        controller?.abort(); controller = null;
        clearTimeout(viewerTimer); frame?.remove(); frame = null;
        loadButton.disabled = false; loadButton.innerHTML = icon('cube', 16) + 'Explore in 3D';
        stopButton.hidden = true;
    }
    async function load() {
        if (!root) { status.textContent = 'No verified model URL is indexed. Run npm run catalog:sync first.'; return; }
        const generation = ++loadGeneration;
        controller = new AbortController();
        loadButton.disabled = true; stopButton.hidden = false;
        status.textContent = 'Preparing 3D viewer. Large models may take a moment.';
        try {
            const entry = safeUrl(config.viewerUrl, true) || '/vendor/usd/index.html';
            if (new URL(entry, location.href).origin !== location.origin) throw new Error('The viewer must be installed on the same origin as Atlas.');
            const probe = await fetch(entry, { signal: controller.signal, cache: 'no-cache' });
            if (!probe.ok || !(await probe.text()).includes('atlas-usd-viewer')) throw new Error('The 3D viewer is not installed. Run npm run viewer:setup, then rebuild. The source package is still available.');
            if (!alive || generation !== loadGeneration) return;
            frame = document.createElement('iframe');
            frame.title = `Interactive 3D: ${asset.name}`;
            frame.referrerPolicy = 'no-referrer';
            frame.src = entry + '#model=' + encodeURIComponent(root);
            stage.append(frame); loadButton.innerHTML = icon('cube', 16) + '3D preview active';
            viewerTimer = setTimeout(() => { if (alive && generation === loadGeneration) status.textContent = 'Still loading. Large models may exceed browser limits. Stop 3D or open the source package.'; }, 60000);
        } catch (error) {
            if (!alive || generation !== loadGeneration || error.name === 'AbortError') return;
            stop(); status.textContent = error.message;
        }
    }
    function onMessage(event) {
        if (!alive || !frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'atlas-viewer') return;
        const data = event.data;
        if (data.type === 'ready') { clearTimeout(viewerTimer); status.textContent = 'Drag to orbit · Scroll to zoom · Stop 3D to release the viewer'; }
        if (data.type === 'progress') status.textContent = `Loading model… ${Math.round(Math.min(1, Math.max(0, Number(data.fraction) || 0)) * 100)}%`;
        if (data.type === 'error') { stop(); status.textContent = `Preview unavailable: ${String(data.message || 'Open the source package instead.').slice(0, 300)}`; }
        if (data.type === 'warning') status.textContent = `Preview warning: ${String(data.message || '').slice(0, 300)}`;
    }
    function toggleInfo(force) {
        info.hidden = typeof force === 'boolean' ? !force : !info.hidden;
        const button = dialog.querySelector('[data-detail="info"]');
        button.setAttribute('aria-expanded', String(!info.hidden));
        button.classList.toggle('active', !info.hidden);
        if (!info.hidden && matchMedia('(max-width:800px)').matches) info.querySelector('button').focus();
        else if (info.hidden) button.focus();
    }
    function save() {
        saved = onSave(asset.id);
        const button = dialog.querySelector('[data-detail="save"]');
        button.setAttribute('aria-pressed', String(saved));
        button.setAttribute('aria-label', saved ? 'Unsave asset' : 'Save asset');
        button.querySelector('span').textContent = saved ? 'Saved' : 'Save asset';
    }
    function navigate(delta) { if (ids[index + delta]) onNavigate(ids[index + delta]); }
    function closeDownload() { downloadMenu.hidden = true; dialog.querySelector('[data-detail="download"]').setAttribute('aria-expanded', 'false'); }
    dialog.onclick = async event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const tag = target.closest('[data-tag]');
        const stripItem = target.closest('[data-detail-id]');
        if (tag) { onTag(tag.dataset.tag); return; }
        if (stripItem) { if (stripItem.dataset.detailId !== asset.id) onNavigate(stripItem.dataset.detailId); return; }
        const action = target.closest('[data-detail]')?.dataset.detail;
        if (!target.closest('.download-wrap')) closeDownload();
        try {
            if (action === 'close') onClose();
            if (action === 'previous') navigate(-1);
            if (action === 'next') navigate(1);
            if (action === 'info' || action === 'info-close') toggleInfo(action === 'info-close' ? false : undefined);
            if (action === 'viewer') await load();
            if (action === 'stop') { stop(); status.textContent = '3D stopped. The isolated viewer has been removed.'; }
            if (action === 'save') save();
            if (action === 'collection') onCollection();
            if (action === 'download') {
                downloadMenu.hidden = !downloadMenu.hidden;
                dialog.querySelector('[data-detail="download"]').setAttribute('aria-expanded', String(!downloadMenu.hidden));
                if (!downloadMenu.hidden) downloadMenu.querySelector('a,button')?.focus();
            }
            if (action === 'command') { await copyText(command); closeDownload(); toast('Package download command copied'); }
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
        if (!downloadMenu.hidden) { closeDownload(); dialog.querySelector('[data-detail="download"]').focus(); }
        else onClose();
    };
    dialog.querySelector('.detail-preview > img')?.addEventListener('error', event => {
        event.target.remove(); stage.insertAdjacentHTML('afterbegin', `<span class="missing-preview">${icon('cube', 54)}Preview unavailable</span>`);
    }, { once: true });
    window.addEventListener('message', onMessage);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-detail="close"]').focus({ preventScroll: true });
    dialog.querySelector('.film-thumb[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    return ({ keepOpen = false } = {}) => {
        alive = false; stop(); window.removeEventListener('message', onMessage);
        dialog.onclick = null; dialog.oncancel = null; dialog.onkeydown = null;
        if (!keepOpen && dialog.open) dialog.close();
        dialog.replaceChildren();
    };
}
