import { readFileSync } from 'node:fs';

const PREVIEW_CATALOG = readFileSync(new URL('./fixtures/preview-catalog.json', import.meta.url), 'utf8');

/** The 15-object fixture also served to the browser suite; fresh copy per call. */
export const previewCatalog = () => JSON.parse(PREVIEW_CATALOG);

/** Synthetic stress fixtures, never published as real NVIDIA catalog entries. */
export function stressAssets(count = 2575) {
    const objects = ['Banana', 'Tomato', 'Storage cart', 'Corrugated box', 'Medical instrument', 'Office chair', 'Engine assembly', 'Frying pan', 'Paint bottle', 'Protective gloves', 'Warehouse rack', 'Socket', 'Wooden pallet', 'Tool case', 'Surgical container', 'Plastic bin', 'Forklift', 'Bench', 'Cabinet', 'Green plant'];
    const categories = ['Food & produce', 'Storage & logistics', 'Medical & laboratory', 'Tools & materials', 'Furniture & fixtures'];
    const colors = ['red', 'blue', 'yellow', 'green', 'black', 'white', 'silver'];
    return Array.from({ length: count }, (_, i) => ({ id: `synthetic_${i}/simready_usd/root.usd`, name: `${objects[i % objects.length]} ${String(i).padStart(4, '0')}`, category: categories[i % categories.length], tags: [colors[i % colors.length], objects[i % objects.length].toLowerCase(), 'synthetic', `variant${i % 150}`], aliases: i % 20 === 2 ? ['trolley', 'mobile cart'] : [], description: `Synthetic benchmark record ${i}, not a real asset listing.`, packagePath: `synthetic_${i}`, usdPath: `synthetic_${i}/simready_usd/root.usd`, fileType: 'usd', usdSizeBytes: 10000 + i * 11, thumbnailUrl: '/thumbs/food_produce_banana_m01.webp' }));
}
