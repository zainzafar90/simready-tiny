"""Render brand assets from one wordmark definition.

Run:  python3 tools/brand/render-brand.py
Writes public/og.jpg (1200x630 share image) and docs/assets/logo-{light,dark}.png (README header).
Edit TILES to change which objects appear in the share image.
"""
import asyncio, base64, html, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OG = ROOT / 'public' / 'og.jpg'
LOGOS = {'light': ('#202023', '#ffffff'), 'dark': ('#eeedef', '#171719')}
TILES = ['Vehicle Forklift Blue', 'Banana', 'Kettle', 'Helmet Hard Hat', 'Appliance Toaster', 'Cake', 'Chair Hospital', 'Apple', 'Cart Computer']
CUBE = '<path d="m16 2 12 7v14l-12 7L4 23V9zM4 9l12 7 12-7M16 16v14M10 5.5l12 7v7l-6 3.5-6-3.5v-7l6-3.5 6 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'


def config():
    return json.loads((ROOT / 'public/config.json').read_text())


def brand_parts():
    word, *tag = (config().get('name') or 'SimReady Tiny').split()
    return word, ' '.join(tag)


def wordmark(size, ink, paper):
    """Same proportions as the site header: wordmark plus raised badge."""
    word, tag = brand_parts()
    badge = f'<span class="tag" style="background:{ink};color:{paper}">{html.escape(tag)}</span>' if tag else ''
    return f'''<div class="mark" style="--s:{size}px;color:{ink}"><svg viewBox="0 0 32 32">{CUBE}</svg><span class="word">{html.escape(word)}</span>{badge}</div>'''


MARK_CSS = '''.mark { display: inline-flex; align-items: flex-start; gap: calc(var(--s) * .32); font-family: ''' + FONT + '''; }
.mark svg { width: calc(var(--s) * 1.15); height: calc(var(--s) * 1.15); flex-shrink: 0; }
.word { font-size: var(--s); font-weight: 760; letter-spacing: -.035em; line-height: 1.15; }
.tag { margin: calc(var(--s) * -.08) 0 0 calc(var(--s) * -.12); padding: .2em .4em .18em .48em; border-radius: .38em; font-size: calc(var(--s) * .42); font-weight: 750; letter-spacing: .14em; line-height: 1.2; text-transform: uppercase; }'''


def site_host():
    return config().get('siteUrl', '').split('//')[-1].strip('/') or 'simready'


def load_catalog():
    manifest = json.loads((ROOT / 'public/catalog-manifest.json').read_text())
    return json.loads((ROOT / 'public' / manifest['url'].lstrip('/')).read_text())


def tile_sources(catalog):
    by_name = {a['name']: a for a in catalog['assets']}
    missing = [name for name in TILES if name not in by_name or not by_name[name].get('previewImageUrl')]
    if missing: raise SystemExit(f'Missing local preview images for: {missing}. Run npm run catalog:thumbs first.')
    files = [ROOT / 'public' / by_name[name]['previewImageUrl'].lstrip('/') for name in TILES]
    return ['data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode() for f in files]


def og_page(catalog):
    tiles = ''.join(f'<img src="{html.escape(src)}" alt="">' for src in tile_sources(catalog))
    return f'''<!doctype html><html><head><style>
    * {{ box-sizing: border-box; margin: 0; }}
    body {{ width: 1200px; height: 630px; overflow: hidden; background: #171719; color: #eeedef; font-family: {FONT}; display: flex; align-items: center; padding-left: 72px; }}
    {MARK_CSS}
    .copy {{ flex: 1; display: flex; flex-direction: column; gap: 26px; }}
    .tagline {{ font-size: 30px; line-height: 1.35; color: #c9c8ce; letter-spacing: -.4px; max-width: 520px; }}
    .meta {{ margin-top: 14px; font-size: 18px; color: #8a8990; display: flex; flex-direction: column; gap: 6px; }}
    .meta b {{ color: #eeedef; font-weight: 550; }}
    .grid {{ width: 560px; display: grid; grid-template-columns: repeat(3, 172px); gap: 14px; transform: translateX(28px); }}
    .grid img {{ width: 172px; height: 172px; border-radius: 22px; object-fit: cover; background: #373537; }}
    </style></head><body>
    <div class="copy">
      {wordmark(56, '#eeedef', '#171719')}
      <div class="tagline">{len(catalog['assets']):,} simulation-ready 3D models. Search instantly, preview in 3D, download the originals.</div>
      <div class="meta"><b>{html.escape(site_host())}</b><span>Models by NVIDIA SimReady · CC BY 4.0 · Not affiliated with NVIDIA</span></div>
    </div>
    <div class="grid">{tiles}</div>
    </body></html>'''


def logo_page(ink, paper):
    return f'<!doctype html><html><head><style>* {{ margin: 0; }} .frame {{ display: inline-block; padding: 8px 6px 4px; }} {MARK_CSS}</style></head><body><div class="frame">{wordmark(44, ink, paper)}</div></body></html>'


async def render(browser, content, viewport, path, **shot):
    page = await browser.new_page(viewport=viewport, device_scale_factor=shot.pop('scale', 1))
    await page.set_content(content, wait_until='load')
    await page.evaluate('Promise.all([...document.images].map(i => i.decode()))')
    target = page.locator(shot.pop('selector')) if 'selector' in shot else page
    await target.screenshot(path=str(path), **shot)
    await page.close()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        await render(browser, og_page(load_catalog()), {'width': 1200, 'height': 630}, OG, type='jpeg', quality=88)
        for theme, (ink, paper) in LOGOS.items():
            await render(browser, logo_page(ink, paper), {'width': 800, 'height': 200}, ROOT / 'docs' / 'assets' / f'logo-{theme}.png', selector='.frame', omit_background=True, scale=2)
        await browser.close()
    for path in [OG, *(ROOT / 'docs' / 'assets').glob('logo-*.png')]:
        print(f'Wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)')


asyncio.run(main())
