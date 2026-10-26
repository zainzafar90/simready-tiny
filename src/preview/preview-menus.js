/** Download and More menus inside the preview. */
export function createMenus(dialog) {
    const menus = { download: dialog.querySelector('#download-menu'), more: dialog.querySelector('#more-menu') };
    const trigger = name => dialog.querySelector(`[data-detail="${name}"]`);

    function set(name, open) {
        menus[name].hidden = !open;
        trigger(name).setAttribute('aria-expanded', String(open));
        if (open) menus[name].querySelector('a,button')?.focus();
    }
    function closeAll() {
        for (const name of Object.keys(menus)) if (!menus[name].hidden) set(name, false);
    }
    return {
        closeAll,
        toggle(name) {
            const wasOpen = !menus[name].hidden;
            closeAll();
            if (!wasOpen) set(name, true);
        },
        /* returns true when a menu was closed */
        closeOpen() {
            const name = Object.keys(menus).find(key => !menus[key].hidden);
            if (!name) return false;
            set(name, false);
            trigger(name).focus();
            return true;
        },
    };
}
