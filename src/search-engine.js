/** Weighted inverted index. Pure JS, shared between worker, tests and benchmark. */
export function normalize(value) {
    return String(value ?? '').replace(/([a-z\d])([A-Z])/g, '$1 $2').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const plurals = { boxes: 'box', knives: 'knife', shelves: 'shelf', tomatoes: 'tomato', potatoes: 'potato', gloves: 'glove', glasses: 'glasses' };
export function tokenize(value) {
    return normalize(value).split(/\s+/).filter(Boolean).map(w => plurals[w] || (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}
export function distance(a, b, max = 2) {
    if (Math.abs(a.length - b.length) > max)
        return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const next = [i];
        let min = i;
        for (let j = 1; j <= b.length; j++) {
            next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            min = Math.min(min, next[j]);
        }
        if (min > max)
            return max + 1;
        prev = next;
    }
    return prev[b.length];
}
export function parseQuery(query) {
    const positive = [], negative = [], phrases = [];
    const parts = String(query).slice(0, 200).match(/-?"[^"]+"|-?\S+/g) || [];
    for (const p of parts.slice(0, 20)) {
        const no = p.startsWith('-'), raw = no ? p.slice(1) : p;
        if (raw.startsWith('"')) {
            (no ? negative : phrases).push(normalize(raw));
        }
        else
            (no ? negative : positive).push(...tokenize(raw));
    }
    return { positive: [...new Set(positive)], negative, phrases };
}
export class SearchEngine {
    constructor(assets) {
        this.assets = assets;
        this.postings = new Map();
        this.byId = new Map();
        this.documents = [];
        this.categories = [...new Set(assets.map(a => a.category))].sort();
        assets.forEach((a, i) => {
            this.byId.set(a.id, i);
            const fields = [[a.name, 9], [(a.aliases || []).join(' '), 5], [(a.tags || []).join(' '), 4], [a.category, 2], [a.description || '', 1], [a.packagePath || a.id, 1]];
            const doc = new Map();
            for (const [text, weight] of fields)
                for (const term of new Set(tokenize(text)))
                    doc.set(term, (doc.get(term) || 0) + weight);
            for (const [term, weight] of doc) {
                if (!this.postings.has(term))
                    this.postings.set(term, new Map());
                this.postings.get(term).set(i, weight);
            }
            this.documents.push({ name: normalize(a.name), text: normalize(fields.map(f => f[0]).join(' ')), terms: new Set(doc.keys()) });
        });
        this.vocabulary = [...this.postings.keys()].sort();
        this.alpha = assets.map((_, i) => i).sort((i, j) => assets[i].name.localeCompare(assets[j].name) || assets[i].id.localeCompare(assets[j].id));
    }
    termScores(term, prefix = true) {
        const out = new Map();
        const add = (key, multiplier) => { for (const [i, w] of this.postings.get(key) || [])
            out.set(i, Math.max(out.get(i) || 0, w * multiplier)); };
        add(term, 1);
        if (prefix && term.length >= 2) {
            let lo = 0, hi = this.vocabulary.length;
            while (lo < hi) {
                const m = (lo + hi) >> 1;
                if (this.vocabulary[m] < term)
                    lo = m + 1;
                else
                    hi = m;
            }
            for (let i = lo; i < this.vocabulary.length && this.vocabulary[i].startsWith(term); i++)
                add(this.vocabulary[i], .72);
        }
        if (!out.size && term.length >= 4) {
            const max = term.length >= 7 ? 2 : 1;
            for (const word of this.vocabulary)
                if (Math.abs(word.length - term.length) <= max) {
                    const d = distance(term, word, max);
                    if (d <= max)
                        add(word, .45 / (d || 1));
                }
        }
        return out;
    }
    search({ query = '', category = '', format = '', saved = false, savedIds = [], sort = 'relevance', preview = false } = {}) {
        const start = performance.now();
        const q = parseQuery(query);
        const favorites = new Set(savedIds);
        let scores = null;
        for (let t = 0; t < q.positive.length; t++) {
            const matches = this.termScores(q.positive[t], t === q.positive.length - 1);
            if (scores === null)
                scores = matches;
            else
                for (const [i, score] of scores) {
                    if (matches.has(i))
                        scores.set(i, score + matches.get(i));
                    else
                        scores.delete(i);
                }
            if (!scores.size)
                break;
        }
        const candidates = scores === null ? this.alpha : [...scores.keys()];
        const facets = Object.fromEntries(this.categories.map(c => [c, 0]));
        const ids = [];
        let totalBeforeCategory = 0;
        for (const i of candidates) {
            const a = this.assets[i], d = this.documents[i];
            if (saved && !favorites.has(a.id))
                continue;
            if (format && a.fileType !== format)
                continue;
            if (preview && !a.thumbnailUrl)
                continue;
            if (q.phrases.some(p => !d.text.includes(p)))
                continue;
            if (q.negative.some(p => p.includes(' ') ? d.text.includes(p) : d.terms.has(p)))
                continue;
            facets[a.category]++;
            totalBeforeCategory++;
            if (category && a.category !== category)
                continue;
            ids.push(i);
        }
        if (sort === 'size') {
            const size = a => a.packageSizeBytes ?? a.usdSizeBytes ?? Infinity;
            ids.sort((i, j) => size(this.assets[i]) - size(this.assets[j]) || this.assets[i].name.localeCompare(this.assets[j].name));
        }
        else if (sort === 'name' || (!q.positive.length && !q.phrases.length))
            ids.sort((i, j) => this.assets[i].name.localeCompare(this.assets[j].name) || this.assets[i].id.localeCompare(this.assets[j].id));
        else {
            const norm = normalize(query);
            const score = i => (scores?.get(i) || 0) + (this.documents[i].name === norm ? 100 : 0) + (this.documents[i].name.startsWith(norm) ? 25 : 0);
            ids.sort((i, j) => score(j) - score(i) || this.assets[i].name.localeCompare(this.assets[j].name));
        }
        return { ids: ids.map(i => this.assets[i].id), facets, totalBeforeCategory, elapsed: performance.now() - start };
    }
}
