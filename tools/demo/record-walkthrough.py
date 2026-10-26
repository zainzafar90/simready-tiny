"""Record a user-style walkthrough: vehicles, then screwdrivers, with real 3D loads.

Run with a server up:  python3 tools/demo/record-walkthrough.py [--base http://127.0.0.1:4173]
Output:                reports/video/walkthrough.mp4
"""
import argparse, asyncio, shutil, subprocess, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports' / 'video'
SIZE = {'width': 1280, 'height': 800}
LOAD_TIMEOUT_MS = 120000
CURSOR = """
addEventListener('DOMContentLoaded', () => {
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #111;pointer-events:none;transition:transform 80ms;display:none';
  document.documentElement.append(dot);
  addEventListener('mousemove', e => { dot.style.display = 'block'; dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  addEventListener('mouseout', e => { if (!e.relatedTarget) dot.style.display = 'none'; }, true);
  addEventListener('mousedown', () => dot.style.transform = 'scale(.7)', true);
  addEventListener('mouseup', () => dot.style.transform = '', true);
});
"""


async def glide(page, locator, steps=25):
    box = await locator.bounding_box()
    await page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, steps=steps)


async def click(page, locator, pause=0.6):
    await glide(page, locator)
    await asyncio.sleep(0.25)
    await locator.click()
    await asyncio.sleep(pause)


async def orbit(page, dx=260, dy=40):
    stage = await page.locator('#detail-preview').bounding_box()
    x, y = stage['x'] + stage['width'] * 0.5, stage['y'] + stage['height'] * 0.5
    await page.mouse.move(x - dx / 2, y, steps=15)
    await page.mouse.down()
    await page.mouse.move(x + dx / 2, y + dy, steps=45)
    await page.mouse.up()
    await asyncio.sleep(0.6)
    await page.mouse.wheel(0, -260)
    await asyncio.sleep(1.2)


async def wait_for_3d(page):
    await page.wait_for_selector('#detail-preview.is-3d', timeout=LOAD_TIMEOUT_MS)
    await page.wait_for_function("document.querySelector('#viewer-progress').hidden", timeout=LOAD_TIMEOUT_MS)
    await asyncio.sleep(0.8)


async def browse_vehicles(page):
    await click(page, page.locator('[data-category="Vehicles"]'), 1.5)
    tag = page.locator('.load-tag').first
    if await tag.count():
        await glide(page, tag); await asyncio.sleep(2)
    await click(page, page.locator('[data-open]').first, 0.5)
    await wait_for_3d(page)
    await orbit(page)
    await click(page, page.locator('[data-detail="next"]'), 0.5)
    await wait_for_3d(page)
    await orbit(page, -240, -30)
    await click(page, page.locator('[data-detail="close"]'), 1)


async def search_screwdrivers(page):
    await click(page, page.locator('#all-assets'), 1)
    await click(page, page.locator('#search'), 0.3)
    await page.keyboard.type('screwdriver', delay=110)
    await page.wait_for_function("document.querySelector('#result-count').textContent.match(/^[1-9]/)")
    await asyncio.sleep(1.5)
    await click(page, page.locator('[data-open]').first, 0.5)
    await wait_for_3d(page)
    await orbit(page)
    await click(page, page.locator('[data-detail="save"]'), 1)
    await click(page, page.locator('[data-detail="close"]'), 1.5)


async def walkthrough(page, base, started):
    """Returns seconds to trim before the gallery is ready."""
    await page.goto(base)
    await page.wait_for_selector('.asset-card img')
    await page.wait_for_function("document.documentElement.dataset.theme === 'dark'")
    await asyncio.sleep(0.4)
    trim_s = time.monotonic() - started
    await asyncio.sleep(1.2)
    await browse_vehicles(page)
    await search_screwdrivers(page)
    return trim_s


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:4173')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport=SIZE, record_video_dir=str(OUT / 'raw'), record_video_size=SIZE, color_scheme='dark', bypass_csp=True)
        await context.add_init_script("localStorage.setItem('atlas.theme', JSON.stringify('dark'))")
        await context.add_init_script(CURSOR)
        page = await context.new_page()
        started = time.monotonic()
        try:
            trim_s = await walkthrough(page, args.base, started)
        finally:
            raw = await page.video.path()
            await context.close()
            await browser.close()
    target = OUT / 'walkthrough.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-ss', f'{trim_s:.2f}', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', str(target)], check=True)
    shutil.rmtree(OUT / 'raw', ignore_errors=True)
    print(f'Wrote {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)')


asyncio.run(main())
