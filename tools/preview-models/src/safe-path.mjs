import { resolve, sep } from 'node:path';

const REVISION = /^[0-9a-f]{40}$/;

/** Relative dataset path with no traversal. */
export function isSafeRelative(value) {
    return typeof value === 'string' && value.length > 0 && value.length < 3000 && !value.startsWith('/')
        && !/[\\\x00-\x1f]/.test(value) && !value.split('/').some(part => part === '' || part === '.' || part === '..');
}

export function isRevision(value) {
    return REVISION.test(value || '');
}

/** Resolves strictly inside root, never root itself. */
export function resolveInside(root, relative) {
    if (!isSafeRelative(relative)) throw new Error(`Unsafe path: ${String(relative).slice(0, 200)}`);
    const base = resolve(root), target = resolve(base, relative);
    if (!target.startsWith(base + sep)) throw new Error(`Path escapes ${base}: ${relative.slice(0, 200)}`);
    return target;
}
