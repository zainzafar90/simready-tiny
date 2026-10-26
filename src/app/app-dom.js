const TOAST_MS = 3500;
let toastTimer = 0;

export const $ = selector => document.querySelector(selector);

export const modalOpen = () => [...document.querySelectorAll('dialog')].some(dialog => dialog.open);

export function keepToast() {
    document.body.append($('#toast'));
}

export function toast(message) {
    const el = $('#toast');
    /* open dialogs sit in the top layer */
    (document.querySelector('#collection-dialog[open], #asset-dialog[open]') || document.body).append(el);
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; keepToast(); }, TOAST_MS);
}
