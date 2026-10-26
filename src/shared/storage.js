export function readStorage(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key) ?? 'null');
        return v ?? fallback;
    }
    catch {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch {
        return false;
    }
}
