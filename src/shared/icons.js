const paths = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    folderPlus: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 10v7m-3.5-3.5h7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrowLeft: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    panel: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18"/>',
    share: '<path d="M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',

    search: '<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    cube: '<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
    bookmark: '<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8z"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    fruit: '<path d="M12 8c-8-5-12 4-6 11 2 3 4 1 6 1s4 2 6-1c6-7 2-16-6-11zm0 0c0-4 2-6 5-6-1 4-3 5-5 6z"/>',
    tools: '<path d="m14 7 3 3 4-4c2 7-3 10-7 8L6 22l-4-4 8-8C8 6 11 1 18 3z"/>',
    medical: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M9 5V3h6v2M12 9v7m-3-3.5h6"/>',
    storage: '<path d="m3 7 9-4 9 4v13H3zM3 7h18M8 11h8m-8 4h8"/>',
    vehicle: '<path d="m3 13 2-7h14l2 7v6H3zm0 0h18M7 19v2m10-2v2M6 16h2m8 0h2"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8L21 9h-8z"/>',
    furniture: '<path d="M5 10V4h14v6M3 9h4v6h10V9h4v10H3zm2 10v3m14-3v3"/>',
    leaf: '<path d="M3 21c1-6 7-8 12-13M5 17C-1 5 10 1 21 3c0 12-5 18-16 14z"/>',
    shield: '<path d="m12 3 9 4c0 9-5 13-9 15-4-2-9-6-9-15z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
};
export const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
export function categoryIcon(category) {
    const key = category.toLowerCase();
    if (/food|produce/.test(key))
        return 'fruit';
    if (/medical/.test(key))
        return 'medical';
    if (/storage|logistics/.test(key))
        return 'storage';
    if (/tool|machinery/.test(key))
        return 'tools';
    if (/vehicle/.test(key))
        return 'vehicle';
    if (/elect/.test(key))
        return 'bolt';
    if (/furniture/.test(key))
        return 'furniture';
    if (/nature/.test(key))
        return 'leaf';
    if (/safety/.test(key))
        return 'shield';
    return 'cube';
}
