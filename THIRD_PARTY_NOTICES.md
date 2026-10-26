# Third-party notices

## NVIDIA SimReady dataset

The 3D models, textures, thumbnails and names come from [NVIDIA SimReady](https://huggingface.co/datasets/nvidia/simready-assets). Every package includes the same `LICENSE.txt`: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

What this project distributes, and how it was changed:

- `public/thumbs/`: the dataset's own thumbnails, resized to 512px and 1024px and re-encoded as WebP.
- `tests/fixtures/thumbs/`: copies of 15 of those thumbnails, used by the browser tests.
- The model mirror (optional, hosted separately): every package's `simready_usd` files, with textures larger than 1024px resized. Geometry, materials and physics files are unchanged.

The originals remain on Hugging Face, and every preview links to them. The site credits NVIDIA in its banner. NVIDIA and Hugging Face are named to identify the source. This project is independent and not affiliated with or endorsed by either. Trademarks are not covered by CC BY 4.0.

## Dependencies

The browser app and its Node scripts have no npm dependencies. Optional tools install their own:

| Tool | Packages |
|---|---|
| `tools/viewer` (3D viewer build) | `@huggingface/usd-web-viewer`, `three`, `vite` |
| `tools/preview-models` (model mirror) | `sharp`, `aws4fetch` |
| `tools/tagger` (optional Jev image tagging) | `sharp` |
| Python dev tools and tests | `playwright` |

`npm run viewer:setup` copies the viewer runtime packages' license and notice files into `public/vendor/usd/licenses/`, which ships with the site. Keep them when you redistribute a build.

## Application code

The [MIT license](LICENSE) covers this project's own code only. It does not relicense the dataset, its thumbnails, trademarks or dependencies.
