import { $ } from './app-dom.js';

export const sidebarOpen = () => $('#sidebar').classList.contains('open');

export function toggleSidebar(force) {
    const open = typeof force === 'boolean' ? force : !sidebarOpen();
    $('#sidebar').classList.toggle('open', open);
    $('#sidebar-shade').hidden = !open;
    $('.workspace').inert = open;
    $('.filter-mobile').setAttribute('aria-expanded', String(open));
    if (open) $('#all-assets').focus();
    else if (matchMedia('(max-width:800px)').matches) $('.filter-mobile').focus();
}

export function closeSidebar() {
    if (sidebarOpen()) toggleSidebar(false);
}

function trapFocus(event) {
    if (event.key !== 'Tab' || !sidebarOpen()) return;
    const nodes = [...$('#sidebar').querySelectorAll('button,a')].filter(el => !el.disabled && el.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
}

export function bindSidebar() {
    matchMedia('(min-width:801px)').addEventListener('change', event => { if (event.matches) toggleSidebar(false); });
    $('#sidebar').addEventListener('keydown', trapFocus);
}
