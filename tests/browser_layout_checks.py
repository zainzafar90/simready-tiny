"""Keyboard, history, responsive and large-catalog scenarios for the browser suite."""
import json, subprocess
from browser_harness import ROOT, memory_mount

WIDTHS = [1280, 800, 768, 390, 320]
MAX_MOUNTED_CARDS = 32


async def check_keyboard_and_theme(s):
    page = s.page
    await page.locator('[data-open]').first.focus()
    await page.keyboard.press('ArrowRight')
    assert await page.evaluate('document.activeElement.closest("[data-index]").dataset.index === "1"')
    await page.keyboard.press('/')
    assert await page.locator('#search').evaluate('el=>el===document.activeElement')
    s.passed('Gallery arrow keys and slash-to-search remain accessible')
    await page.locator('[data-action="theme"]').click()
    assert await page.locator('html').get_attribute('data-theme') == 'dark'
    await s.shot('dark.png')
    await page.locator('[data-action="theme"]').click()
    s.passed('Optional dark mode keeps the same visual hierarchy')


async def history_step(s, direction):
    if s.in_memory: await s.page.evaluate(f'window.__atlasHistory.{direction}()')
    elif direction == 'back': await s.page.go_back()
    else: await s.page.go_forward()


async def check_history(s):
    await s.page.locator('[data-category="Food & produce"]').click()
    await s.results('3 assets')
    await history_step(s, 'back')
    await s.results('15 assets')
    await history_step(s, 'forward')
    await s.results('3 assets')
    await s.page.locator('#all-assets').click()
    await s.results('15 assets')
    s.passed('Browser back and forward restore gallery state')


async def check_responsive_gallery(s):
    page = s.page
    for width in WIDTHS:
        await page.set_viewport_size({'width': width, 'height': 844})
        await page.wait_for_timeout(70)
        assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}px'
    s.passed('Gallery has no horizontal overflow at 1280, 800, 768, 390, and 320px')
    await page.set_viewport_size({'width': 390, 'height': 844})
    await page.wait_for_timeout(80)
    assert await page.locator('.asset-card').nth(1).evaluate('el=>Math.round(parseFloat(el.style.top))') == 0
    assert await page.locator('.asset-card').nth(2).evaluate('el=>parseFloat(el.style.top)') > 0
    s.passed('Mobile gallery keeps two columns')
    await s.shot('mobile.png')


async def check_mobile_drawer(s):
    page = s.page
    await page.locator('.filter-mobile').click()
    assert await page.locator('.workspace').evaluate('el=>el.inert')
    await page.locator('[data-category="Food & produce"]').click()
    await s.results('3 assets')
    assert not await page.locator('.workspace').evaluate('el=>el.inert')
    s.passed('Mobile drawer closes after navigation and releases inert state')
    await page.locator('.filter-mobile').click()
    await page.keyboard.press('Escape')
    assert not await page.locator('#sidebar').evaluate('el=>el.classList.contains("open")')
    s.passed('Escape closes the mobile navigation drawer')


async def check_mobile_preview(s):
    page = s.page
    await page.locator('.filter-mobile').click()
    await page.locator('#all-assets').click()
    await s.results('15 assets')
    await page.locator('[data-open]').first.click()
    assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
    await s.shot('mobile-detail.png')
    await page.locator('[data-detail="more"]').click()
    await page.locator('[data-detail="info"]').click()
    assert await page.locator('#asset-info').is_visible()
    assert await page.locator('#asset-info').evaluate('el=>el.getBoundingClientRect().right<=innerWidth+1')
    await s.shot('mobile-info.png')
    await page.locator('[data-detail="info-close"]').click()
    s.passed('Mobile preview and details sheet fit the viewport')
    await page.set_viewport_size({'width': 320, 'height': 568})
    await page.wait_for_timeout(80)
    rect = await page.locator('.stage-frame').evaluate('el=>({w:el.clientWidth,h:el.clientHeight})')
    assert abs(rect['w'] - rect['h']) <= 1
    assert await page.locator('.preview-actions').evaluate('el=>el.getBoundingClientRect().right<=innerWidth')
    s.passed('Compact 320px preview keeps square media and visible actions')
    await page.keyboard.press('Escape')


async def open_stress_page(s, context, url):
    """Synthetic records measure bounded UI cost, not the live catalog."""
    stress = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import{stressAssets}from'./tests/fixtures.mjs';console.log(JSON.stringify(stressAssets(2575)))"], cwd=ROOT))
    stress_catalog = {**s.catalog, 'assets': stress, 'mode': 'snapshot', 'revision': 'synthetic-test-only'}
    page = await context.new_page()
    await page.set_viewport_size({'width': 1440, 'height': 1000})
    page.on('pageerror', lambda error: s.errors.append(str(error)))
    if s.in_memory: await memory_mount(page, stress_catalog)
    else:
        await page.route('**/catalog-manifest.json', lambda route: route.fulfill(json={'url': '/data/catalog.abcdef.json'}))
        await page.route('**/data/catalog.abcdef.json', lambda route: route.fulfill(json=stress_catalog))
        await page.goto(url)
    await s.results('2,575 assets', page)
    return page


async def check_stress(s, context, url):
    page = await open_stress_page(s, context, url)
    mounted = await page.locator('.asset-card').count()
    assert mounted <= MAX_MOUNTED_CARDS
    s.passed(f'2,575-item desktop gallery mounts only {mounted} cards')
    await page.locator('#results-scroll').evaluate('el=>el.scrollTop=el.scrollHeight')
    await page.wait_for_timeout(100)
    assert await page.locator('.asset-card').count() <= MAX_MOUNTED_CARDS
    s.passed('Deep scrolling keeps the card DOM bounded')
    before = await page.locator('#results-scroll').evaluate('el=>el.scrollTop')
    await page.locator('[data-open]').last.click()
    await page.wait_for_selector('#asset-dialog[open]')
    assert await page.locator('.film-thumb').count() <= 9
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Escape')
    await page.wait_for_function('!document.querySelector("#asset-dialog").open')
    await page.wait_for_timeout(100)
    after = await page.locator('#results-scroll').evaluate('el=>el.scrollTop')
    assert abs(before - after) < 2, (before, after)
    s.passed('Preview navigation and close preserve deep gallery scroll')
    await page.locator('#search').fill('banana')
    await s.results('129 assets', page)
    s.passed('Search remains correct after 2,575-item deep-scroll navigation')
    return mounted
