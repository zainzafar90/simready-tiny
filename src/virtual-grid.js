import { escapeHtml as e, safeUrl, formatBytes } from './utils.js';
import { icon } from './icons.js';
/** Only visible cards + overscan are mounted. Existing image nodes are retained on scroll. */
export class VirtualGrid {
    constructor(stage, scroll, onOpen) {
        this.stage = stage;
        this.scroll = scroll;
        this.onOpen = onOpen;
        this.items = [];
        this.saved = new Set();
        this.view = 'grid';
        this.nodes = new Map();
        this.frame = 0;
        this.resize = new ResizeObserver(() => this.schedule(true));
        this.resize.observe(scroll);
        scroll.addEventListener('scroll', () => this.schedule(), { passive: true });
        stage.addEventListener('keydown', event => this.navigate(event));
        stage.addEventListener('error', event => {
            if (event.target instanceof HTMLImageElement) {
                const host = event.target.parentElement;
                event.target.remove();
                const fallback = document.createElement('span');
                fallback.className = 'missing-preview';
                fallback.innerHTML = icon('cube', 30) + 'Preview unavailable';
                host.prepend(fallback);
            }
        }, true);
    }
    set(items, saved, view = this.view) {
        const unchanged = view === this.view && items.length === this.items.length && items.every((a, i) => a.id === this.items[i].id);
        if (unchanged) {
            this.items = items;
            this.stage.setAttribute('aria-busy', 'false');
            this.updateSaved(saved);
            this.layout();
            return;
        }
        this.items = items;
        this.saved = saved;
        this.view = view;
        this.scroll.scrollTop = 0;
        this.nodes.clear();
        this.stage.replaceChildren();
        this.stage.setAttribute('aria-busy', 'false');
        this.layout();
    }
    updateSaved(saved) {
        this.saved = saved;
        for (const [i, node] of this.nodes) {
            const a = this.items[i], button = node.querySelector('[data-save]');
            const on = saved.has(a.id);
            button.classList.toggle('is-saved', on);
            button.setAttribute('aria-pressed', String(on));
            button.setAttribute('aria-label', `${on ? 'Unsave' : 'Save'} ${a.name}`);
        }
    }
    schedule(force = false) { if (force)
        this.dirty = true; if (this.frame)
        return; this.frame = requestAnimationFrame(() => { this.frame = 0; if (this.dirty) {
        this.dirty = false;
        this.layout();
    }
    else
        this.paint(); }); }
    layout() {
        this.width = this.stage.clientWidth;
        this.gap = this.view === 'list' ? 8 : (this.width < 500 ? 12 : 18);
        const min = this.width < 500 ? 140 : 248;
        this.cols = this.view === 'list' ? 1 : Math.max(1, Math.floor((this.width + this.gap) / (min + this.gap)));
        this.cardWidth = (this.width - this.gap * (this.cols - 1)) / this.cols;
        this.cardHeight = this.view === 'list' ? 75 : Math.round(this.cardWidth) + 62;
        this.rowHeight = this.cardHeight + this.gap;
        this.stage.style.height = `${Math.max(0, Math.ceil(this.items.length / this.cols) * this.rowHeight - this.gap)}px`;
        this.paint();
    }
    paint() {
        if (!this.rowHeight)
            return;
        const from = Math.max(0, Math.floor(this.scroll.scrollTop / this.rowHeight) - 1) * this.cols;
        const to = Math.min(this.items.length, (Math.ceil((this.scroll.scrollTop + this.scroll.clientHeight) / this.rowHeight) + 1) * this.cols);
        const needed = new Set();
        for (let i = from; i < to; i++)
            needed.add(i);
        const focused = document.activeElement?.closest('[data-index]');
        if (focused && this.stage.contains(focused))
            needed.add(Number(focused.dataset.index));
        for (const [i, node] of this.nodes)
            if (!needed.has(i)) {
                node.remove();
                this.nodes.delete(i);
            }
        for (const i of [...needed].sort((a, b) => a - b)) {
            const a = this.items[i];
            if (!a)
                continue;
            let node = this.nodes.get(i);
            if (!node) {
                node = this.card(a, i);
                this.nodes.set(i, node);
                const next = [...this.stage.children].find(el => Number(el.dataset.index) > i);
                this.stage.insertBefore(node, next || null);
            }
            node.style.width = `${this.cardWidth}px`;
            node.style.height = `${this.cardHeight}px`;
            node.style.left = `${(i % this.cols) * (this.cardWidth + this.gap)}px`;
            node.style.top = `${Math.floor(i / this.cols) * this.rowHeight}px`;
        }
    }
    card(a, i) {
        const on = this.saved.has(a.id), url = safeUrl(a.thumbnailUrl, true);
        const node = document.createElement('article');
        node.className = `asset-card ${this.view === 'list' ? 'list' : ''}`;
        node.dataset.index = String(i);
        node.setAttribute('role', 'listitem');
        node.setAttribute('aria-posinset', String(i + 1));
        node.setAttribute('aria-setsize', String(this.items.length));
        node.innerHTML = `<button class="asset-open" data-open="${e(a.id)}" aria-label="Preview ${e(a.name)}"><span class="asset-image">${url ? `<img src="${e(url)}" alt="" loading="${i < this.cols ? 'eager' : 'lazy'}" decoding="async" width="256" height="256" draggable="false" referrerpolicy="no-referrer">` : `<span class="missing-preview">${icon('cube', 30)}No preview</span>`}<span class="format-chip">${e((a.fileType || 'USD').toUpperCase())}</span></span><span class="asset-caption"><span class="asset-name" title="${e(a.name)}">${e(a.name)}</span><span class="asset-subline"><span class="asset-category">${e(a.category)}</span><span>${this.view === 'list' ? e(formatBytes(a.usdSizeBytes)) : ''}</span></span></span></button><button class="save-btn ${on ? 'is-saved' : ''}" data-save="${e(a.id)}" aria-label="${on ? 'Unsave' : 'Save'} ${e(a.name)}" aria-pressed="${on}">${icon('heart', 16)}</button>`;
        return node;
    }
    navigate(event) {
        const open = event.target.closest('[data-open]');
        if (!open)
            return;
        const index = Number(open.closest('[data-index]').dataset.index);
        const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: this.cols, ArrowUp: -this.cols, Home: -index, End: this.items.length - 1 - index }[event.key];
        if (delta === undefined)
            return;
        event.preventDefault();
        const next = Math.max(0, Math.min(this.items.length - 1, index + delta));
        const top = Math.floor(next / this.cols) * this.rowHeight;
        if (top < this.scroll.scrollTop)
            this.scroll.scrollTop = top;
        else if (top + this.cardHeight > this.scroll.scrollTop + this.scroll.clientHeight)
            this.scroll.scrollTop = top + this.cardHeight - this.scroll.clientHeight;
        this.paint();
        this.nodes.get(next)?.querySelector('[data-open]')?.focus({ preventScroll: true });
    }
    destroy() { this.resize.disconnect(); cancelAnimationFrame(this.frame); }
}
