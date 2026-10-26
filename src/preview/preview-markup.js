import { escapeHtml as e, safeUrl } from '../shared/html.js';
import { formatBytes } from '../shared/format.js';
import { icon } from '../shared/icons.js';

const STRIP_SIZE = 9;

export function nearbyAssets({ ids, index, assets }) {
    const start = Math.max(0, Math.min(index - 4, ids.length - STRIP_SIZE));
    return ids.slice(start, start + STRIP_SIZE).map(id => assets.get(id)).filter(Boolean);
}

function filmstripMarkup(model) {
    return model.nearby.map(a => {
        const url = safeUrl(a.thumbnailUrl, true);
        const thumb = url ? `<img src="${e(url)}" alt="" width="38" height="38" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : icon('cube', 19);
        return `<button class="film-thumb" data-detail-id="${e(a.id)}" aria-label="Preview ${e(a.name)}" aria-current="${a.id === model.asset.id}" title="${e(a.name)}">${thumb}</button>`;
    }).join('');
}

function downloadMenuMarkup({ source, root }) {
    const sourceLink = source ? `<a href="${e(source)}" target="_blank" rel="noopener noreferrer">${icon('external', 15)}Open full source package</a>` : '';
    const rootLink = root ? `<a href="${e(root)}" target="_blank" rel="noopener noreferrer">${icon('download', 15)}Download root layer only</a>` : '';
    return `<div class="menu-wrap"><button class="button soft" data-detail="download" aria-label="Download options" aria-expanded="false" aria-controls="download-menu">${icon('download', 16)}<span>Download</span></button><div id="download-menu" class="download-menu" hidden>${sourceLink}<button data-detail="command">${icon('copy', 15)}Copy package command</button>${rootLink}</div></div>`;
}

function moreMenuMarkup({ infoOpen }) {
    return `<div class="menu-wrap"><button class="icon-btn" data-detail="more" aria-label="More actions" aria-expanded="false" aria-controls="more-menu" title="More">${icon('more', 17)}</button><div id="more-menu" class="download-menu" hidden><button data-detail="info" aria-expanded="${infoOpen}" aria-controls="asset-info">${icon('panel', 15)}<span>${infoOpen ? 'Hide details' : 'Show details'}</span><kbd>I</kbd></button><button data-detail="collection">${icon('folderPlus', 15)}Add to collection</button><button data-detail="share">${icon('share', 15)}Copy link</button></div></div>`;
}

function topbarMarkup(model) {
    const { index, ids, saved } = model;
    return `<header class="preview-topbar">
        <div class="preview-top-left"><button class="icon-btn preview-close" data-detail="close" aria-label="Close asset preview" title="Close (Esc)">${icon('close')}</button><span class="preview-position">${index + 1} / ${ids.length.toLocaleString()}</span></div>
        <nav class="filmstrip" aria-label="Nearby search results">${filmstripMarkup(model)}</nav>
        <div class="preview-actions">${downloadMenuMarkup(model)}${moreMenuMarkup(model)}<button class="button soft" data-detail="save" aria-label="Save asset" aria-pressed="${saved}">${icon('heart', 16)}<span>${saved ? 'Saved' : 'Save asset'}</span></button></div>
      </header>`;
}

function stageMarkup({ asset, image, index, ids }) {
    const media = image ? `<img src="${e(image)}" alt="${e(asset.name)} preview" width="660" height="660" decoding="async" fetchpriority="high" referrerpolicy="no-referrer">` : `<span class="missing-preview">${icon('cube', 54)}No preview available</span>`;
    return `<div class="preview-main">
          <button class="icon-btn preview-nav preview-prev" data-detail="previous" aria-label="Previous object" title="Previous (←)" ${index <= 0 ? 'disabled' : ''}>${icon('arrowLeft')}</button>
          <div class="stage-frame"><div class="detail-preview" id="detail-preview">${media}<div class="viewer-progress" id="viewer-progress" hidden><span class="viewer-progress-label"></span><span class="viewer-progress-bar"><i></i></span></div></div></div>
          <div class="preview-caption"><div><h2 id="detail-title">${e(asset.name)}</h2><p>${e(asset.category)}</p></div><button class="button" data-detail="viewer" hidden></button></div>
          <div class="viewer-status" id="viewer-status" role="status" aria-live="polite"></div>
          <button class="icon-btn preview-nav preview-next" data-detail="next" aria-label="Next object" title="Next (→)" ${index >= ids.length - 1 ? 'disabled' : ''}>${icon('arrow')}</button>
        </div>`;
}

function tagsMarkup(asset) {
    const aiTags = new Set(asset.ai?.tags || []);
    return (asset.tags || []).slice(0, 20).map(tag => `<button class="tag ${aiTags.has(tag) ? 'ai' : ''}" data-tag="${e(tag)}" title="${aiTags.has(tag) ? 'Reviewed AI suggestion, not a verified physical property' : 'Filename / curated taxonomy'}">${e(tag)}</button>`).join('');
}

function metadataMarkup(asset) {
    const preview = Number.isFinite(asset.previewSizeBytes) ? `<div><dt>3D preview</dt><dd>${e(formatBytes(asset.previewSizeBytes))}</dd></div>` : '';
    return `<dl class="metadata"><div><dt>Format</dt><dd>${e(asset.fileType.toUpperCase())}</dd></div><div><dt>Root layer</dt><dd>${e(formatBytes(asset.usdSizeBytes))}</dd></div>${preview}<div><dt>Full package</dt><dd>${e(formatBytes(asset.packageSizeBytes))}</dd></div></dl>`;
}

function infoMarkup({ asset, infoOpen, command, revision }) {
    return `<aside id="asset-info" class="detail-info" aria-label="Asset details" ${infoOpen ? '' : 'hidden'}>
          <div class="info-heading"><strong>Object details</strong><button class="small-icon" data-detail="info-close" aria-label="Hide asset details">${icon('close', 16)}</button></div>
          <span class="detail-category">${e(asset.category)}</span><h3>${e(asset.name)}</h3>
          ${asset.description ? `<p class="detail-description">${e(asset.description)}</p>` : ''}
          <p class="section-label">DISCOVERY TAGS</p><div class="tag-list">${tagsMarkup(asset)}</div>
          <p class="section-label">SOURCE DETAILS</p>${metadataMarkup(asset)}
          <div class="command-wrap"><p>DOWNLOAD FULL PACKAGE · HUGGING FACE CLI</p><code>${e(command)}</code><button data-detail="command">${icon('copy', 12)} Copy command</button></div>
          <p class="detail-footer">${e(asset.packagePath)} · ${e(revision.slice(0, 12))}<br>Visual preview only. Check the source package for physics and license.</p>
        </aside>`;
}

/** Every dynamic value is escaped here. */
export function dialogMarkup(model) {
    return `${topbarMarkup(model)}<div class="preview-body">${stageMarkup(model)}${infoMarkup(model)}</div>`;
}
