import { escapeHtml as e } from '../shared/html.js';
import { $ } from './app-dom.js';
import { store } from './app-store.js';

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;

function applyBrand(name) {
    const [word, ...tag] = name.split(/\s+/);
    $('#brand-name').innerHTML = e(word) + (tag.length ? `<span class="brand-tag">${e(tag.join(' '))}</span>` : '');
    $('.brand').setAttribute('aria-label', name + ' home');
    document.title = document.title.replace(/^[^—]+—/, `${name} —`);
}

function applyContact(email) {
    const link = $('#removal-link');
    link.href = 'mailto:' + encodeURIComponent(email).replace('%40', '@') + '?subject=SimReady%20Tiny%20removal%20request';
    link.hidden = false;
}

export function applySiteConfig(config) {
    store.config = { ...store.config, ...config };
    if (typeof config.name === 'string' && config.name.trim()) applyBrand(config.name.trim().slice(0, 40));
    if (typeof config.subtitle === 'string') $('.brand-sub').textContent = config.subtitle.slice(0, 60);
    if (typeof config.contactEmail === 'string' && EMAIL.test(config.contactEmail.trim())) applyContact(config.contactEmail.trim());
}

export async function loadSiteConfig() {
    try {
        const response = await fetch('/config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        applySiteConfig(await response.json());
    } catch (error) {
        console.warn('Site config unavailable; using defaults', error.message);
    }
}
