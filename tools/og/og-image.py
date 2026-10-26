"""Render the 1200x630 social preview image from real catalog thumbnails.

Run:  python3 tools/og/og-image.py   ->  public/og.jpg
Edit TILES to change which objects appear.
"""
import asyncio, base64, html, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'og.jpg'
TILES = ['Vehicle Forklift Blue', 'Banana', 'Kettle', 'Helmet Hard Hat', 'Appliance Toaster', 'Cake', 'Chair Hospital', 'Apple', 'Cart Computer']
LOGO = '<svg viewBox="0 0 32 32" width="44" height="44"><path d="m16 2 12 7v14l-12 7L4 23V9zM4 9l12 7 12-7M16 16v14M10 5.5l12 7v7l-6 3.5-6-3.5v-7l6-3.5 6 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'


def load_catalog():
    manifest = json.loads((ROOT / 'public/catalog-manifest.json').read_text())
    return json.loads((ROOT / 'public' / manifest['url'].lstrip('/')).read_text())


def tile_paths(catalog):
    by_name = {a['name']: a for a in catalog['assets']}
    missing = [name for name in TILES if name not in by_name or not by_name[name].get('previewImageUrl')]
    if missing: raise SystemExit(f'Missing local preview images for: {missing}. Run npm run catalog:thumbs first.')
    files = [ROOT / 'public' / by_name[name]['previewImageUrl'].lstrip('/') for name in TILES]
    return ['data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode() for f in files]


def page(catalog):
    count = f"{len(catalog['assets']):,}"
    tiles = ''.join(f'<img src="{html.escape(src)}" alt="">' for src in tile_paths(catalog))
    return f'''<!doctype html><html><head><style>
    * {{ box-sizing: border-box; margin: 0; }}
    body {{ width: 1200px; height: 630px; overflow: hidden; background: #171719; color: #eeedef; font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif; display: flex; align-items: center; padding: 0 0 0 72px; }}
    .copy {{ flex: 1; display: flex; flex-direction: column; gap: 22px; }}
    .brand {{ display: flex; align-items: center; gap: 16px; font-size: 58px; font-weight: 750; letter-spacing: -2px; }}
    .tagline {{ font-size: 30px; line-height: 1.35; color: #c9c8ce; letter-spacing: -.4px; max-width: 520px; }}
    .meta {{ margin-top: 18px; font-size: 18px; color: #8a8990; display: flex; flex-direction: column; gap: 6px; }}
    .meta b {{ color: #eeedef; font-weight: 550; }}
    .grid {{ width: 560px; height: 630px; display: grid; grid-template-columns: repeat(3, 172px); gap: 14px; align-content: center; transform: translateX(28px); }}
    .grid img {{ width: 172px; height: 172px; border-radius: 22px; object-fit: cover; background: #373537; }}
    </style></head><body>
    <div class="copy">
      <div class="brand">{LOGO}SimReady Tiny</div>
      <div class="tagline">{count} simulation-ready 3D models. Search instantly, preview in 3D, download the originals.</div>
      <div class="meta"><b>simready.zainzafar.net</b><span>Models by NVIDIA SimReady · CC BY 4.0 · Not affiliated with NVIDIA</span></div>
    </div>
    <div class="grid">{tiles}</div>
    </body></html>'''


async def main():
    catalog = load_catalog()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        view = await context.new_page()
        await view.set_content(page(catalog), wait_until='load')
        await view.evaluate('Promise.all([...document.images].map(i => i.decode()))')
        await view.screenshot(path=str(OUT), type='jpeg', quality=88)
        await browser.close()
    print(f'Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)')


asyncio.run(main())
