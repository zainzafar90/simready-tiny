import { inferLabels, hfUrl } from './catalog-lib.mjs';
export const previewPackages = [
    ['CT_injection_system_a01', 'CT injection system'], ['box_corrugated_brown_b08', 'Corrugated cardboard box'], ['cart_mobile_e01', 'Mobile storage cart'], ['container_system_sterilising_a02', 'Sterilizing container'], ['engineAssembly_v6_engine_a01', 'V6 engine assembly'], ['fixture_trashBin_wallMounted_a01', 'Wall-mounted waste bin'], ['food_prepared_cake_a01', 'Slice of cake'], ['food_produce_banana_m01', 'Banana'], ['food_produce_tomato_a01', 'Tomato'], ['instrument_raspatory_a01', 'Surgical raspatory'], ['kitchenware_pan_n01', 'Frying pan'], ['paint_container_bottle_green_a03', 'Green paint bottle'], ['ppe_gloves_cloth_a01', 'Protective cloth gloves'], ['socket_b01', 'Electrical socket'], ['testingTool_emission_tester_b01', 'Emission tester']
];
export function previewCatalog() {
    return { schemaVersion: 1, dataset: 'nvidia/simready-assets', revision: 'preview', mode: 'preview', generatedAt: '2026-10-26T00:00:00Z', provenance: '15 real source paths verified against Hugging Face. Local thumbnail crops come from the user-provided screenshot. Not a full dataset snapshot.', assets: previewPackages.map(([p, name]) => {
            const path = `${p}/simready_usd/sm_${p}_01.usd`, thumb = `${p}/simready_usd/.thumbs/256x256/sm_${p}_01.usd.png`, labels = inferLabels(p);
            return { id: path, ...labels, name, packagePath: p, usdPath: path, fileType: 'usd', thumbnailUrl: `/thumbs/${p}.webp`, remoteThumbnailUrl: hfUrl(thumb), thumbnailPath: thumb, usdUrl: hfUrl(path), sourceUrl: hfUrl(p, 'main', 'tree'), viewerSourceUrl: hfUrl(path, 'main', 'blob'), metadataSource: 'filename+taxonomy', thumbnailProvenance: 'user-supplied screenshot crop' };
        }).sort((a, b) => a.name.localeCompare(b.name)), issues: [] };
}
