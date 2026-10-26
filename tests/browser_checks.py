"""Gallery, preview and collection scenarios for the browser suite."""
from dataclasses import dataclass, field
from pathlib import Path

REPORTS = Path(__file__).resolve().parent.parent / 'reports'


@dataclass
class Session:
    page: object
    catalog: dict
    in_memory: bool
    checks: list = field(default_factory=list)
    errors: list = field(default_factory=list)

    def passed(self, name):
        self.checks.append(name)
        print('PASS', name, flush=True)

    async def results(self, text, page=None):
        await (page or self.page).wait_for_function('(text) => document.querySelector("#result-count").textContent === text', arg=text)

    async def shot(self, name):
        # Focus rings from scripted input are not part of the visual baseline.
        await self.page.evaluate('document.activeElement?.blur()')
        await self.page.screenshot(path=str(REPORTS / name), full_page=True)


async def check_gallery(s):
    page = s.page
    await s.results('15 assets')
    assert await page.locator('html').get_attribute('data-theme') == 'light'
    s.passed('Fresh install defaults to light even with a dark OS preference')
    assert await page.locator('#asset-grid .asset-card').count() <= 15
    assert await page.locator('.asset-card').first.evaluate('el=>el.clientWidth') >= 180
    assert await page.evaluate("new Set([...document.querySelectorAll('.asset-card')].map(c=>c.style.left)).size") >= 5
    s.passed('Desktop layout fits five or more object columns')
    assert await page.locator('iframe,canvas').count() == 0
    s.passed('Browsing does not create a WebGL canvas or 3D iframe')
    await s.shot('desktop.png')


async def check_search_and_filters(s):
    page = s.page
    await page.locator('#search').fill('bannana')
    await s.results('1 asset')
    assert await page.locator('.asset-name').inner_text() == 'Banana'
    s.passed('Typo-tolerant search uses the real Web Worker')
    await page.locator('#search').fill('zqxwkjgfr')
    await s.results('0 assets')
    assert await page.locator('#empty-state').is_visible()
    await page.locator('#empty-state [data-action="reset"]').click()
    await s.results('15 assets')
    s.passed('Empty search recovers to the full gallery')
    await page.locator('[data-category="Food & produce"]').click()
    await s.results('3 assets')
    assert await page.locator('#page-title').inner_text() == 'Food & produce'
    s.passed('Category selection updates the title, counts, and results')
    await page.locator('[data-action="reset-category"]').first.click()
    await s.results('15 assets')
    await page.locator('#sort').select_option('name')
    await s.results('15 assets')
    assert await page.locator('#sort').input_value() == 'name'
    await page.locator('#sort').select_option('relevance')
    s.passed('Inline sort control works')
    await page.locator('[data-view="list"]').click()
    await page.wait_for_selector('.asset-card.list')
    await page.locator('[data-view="grid"]').click()
    await page.wait_for_selector('.asset-card:not(.list)')
    s.passed('List and grid views share the same search state')


async def check_saving(s):
    page = s.page
    await page.locator('.asset-card').first.hover()
    await page.locator('[data-save]').first.click()
    assert await page.locator('#saved-count').inner_text() == '1'
    await page.locator('#saved-assets').click()
    await s.results('1 asset')
    await page.locator('#all-assets').click()
    await s.results('15 assets')
    s.passed('Heart buttons and both saved navigation entry points work')


async def check_preview_navigation(s):
    page = s.page
    await page.locator('[data-open]').first.click()
    await page.wait_for_selector('#asset-dialog[open]')
    assert await page.locator('#detail-title').inner_text() == 'Banana'
    assert await page.locator('#asset-info').is_visible()
    assert await page.locator('.film-thumb').count() == 9
    assert await page.locator('iframe,canvas').count() == 0
    s.passed('Full-screen preview shows details on desktop and nine thumbnails')
    await s.shot('detail.png')
    await page.locator('[data-detail="next"]').click()
    await page.wait_for_function('document.querySelector("#detail-title").textContent !== "Banana"')
    await page.keyboard.press('ArrowLeft')
    await page.wait_for_function('document.querySelector("#detail-title").textContent === "Banana"')
    assert await page.locator('[data-detail="previous"]').is_disabled()
    s.passed('Next/previous buttons and arrow keys follow the current results')
    await page.locator('.film-thumb').nth(2).click()
    await page.wait_for_function('document.querySelector("#detail-title").textContent === "CT injection system"')
    await page.keyboard.press('s')
    assert await page.locator('[data-detail="save"]').get_attribute('aria-pressed') == 'true'
    s.passed('Thumbnail navigation and save shortcut work')


async def check_preview_panels(s):
    page = s.page
    assert await page.locator('#asset-info').is_visible()
    await page.keyboard.press('i')
    assert await page.locator('#asset-info').is_hidden()
    await page.keyboard.press('i')
    assert await page.locator('#asset-info').is_visible()
    await s.shot('detail-info.png')
    await page.locator('[data-detail="info-close"]').click()
    assert await page.locator('#asset-info').is_hidden()
    s.passed('Desktop opens details by default; the panel still collapses')
    await page.locator('[data-detail="download"]').click()
    assert await page.locator('#download-menu').is_visible()
    await page.keyboard.press('Escape')
    assert await page.locator('#download-menu').is_hidden()
    assert await page.locator('#asset-dialog').evaluate('el=>el.open')
    s.passed('Escape dismisses download options before closing the preview')
    if s.in_memory:
        await page.locator('[data-detail="more"]').click()
        await page.locator('[data-detail="share"]').click()
        shared = await page.evaluate('window.__copied')
        assert '?asset=' in shared and 'collection=' not in shared and 'saved=' not in shared
        s.passed('Shared asset links exclude device-local filters and collections')
        await page.locator('[data-detail="download"]').click()
        await page.locator('#download-menu [data-detail="command"]').click()
        assert '--include' in await page.evaluate('window.__copied')
        s.passed('Full-package download command can be copied')


async def check_preview_viewer_and_close(s):
    page = s.page
    await page.wait_for_function('document.querySelector("#viewer-status").textContent.includes("not installed")')
    assert await page.locator('iframe').count() == 0
    assert await page.locator('#detail-preview img').count() == 1
    assert 'Retry' in await page.locator('[data-detail="viewer"]').inner_text()
    s.passed('3D loads automatically; a missing viewer keeps the image and offers Retry')
    await page.keyboard.press('Tab')
    assert await page.evaluate('document.querySelector("#asset-dialog").contains(document.activeElement)')
    s.passed('Native modal keeps keyboard focus inside the preview')
    await page.keyboard.press('Escape')
    await page.wait_for_function('!document.querySelector("#asset-dialog").open')
    assert await page.locator('#asset-dialog').evaluate('el=>el.children.length') == 0
    s.passed('Closing clears preview content and restores the gallery')
