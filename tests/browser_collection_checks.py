"""Collection and library import/export scenarios for the browser suite."""
import json


async def check_collections(s):
    page = s.page
    await page.locator('[data-action="new-collection"]').first.click()
    await page.locator('#collection-name').fill('Robot workshop')
    await page.locator('#collection-form button[type="submit"]').click()
    await s.results('0 assets')
    assert await page.locator('#page-title').inner_text() == 'Robot workshop'
    assert await page.locator('#collections [data-collection]').count() == 1
    s.passed('New named collections persist and have an intentional empty state')
    await page.locator('#all-assets').click()
    await s.results('15 assets')
    await page.locator('[data-open]').first.click()
    await page.locator('[data-detail="more"]').click()
    await page.locator('[data-detail="collection"]').click()
    await page.locator('.collection-choice input').check()
    await page.locator('#collection-picker button[type="submit"]').click()
    assert not await page.locator('#collection-dialog').evaluate('el=>el.open')
    assert await page.locator('#asset-dialog').evaluate('el=>el.open')
    await page.keyboard.press('Escape')
    await page.locator('#collections [data-collection]').click()
    await s.results('1 asset')
    assert await page.locator('.asset-name').inner_text() == 'Banana'
    s.passed('Collection membership is editable from a nested preview dialog')
    await page.locator('#collection-manage').click()
    await page.locator('#collection-name').fill('Kitchen scene')
    await page.locator('#collection-form button[type="submit"]').click()
    await page.wait_for_function('document.querySelector("#page-title").textContent === "Kitchen scene"')
    s.passed('Renaming a collection updates sidebar and gallery')


async def check_library_transfer(s):
    if not s.in_memory: return
    page, first_id = s.page, s.catalog['assets'][1]['id']
    await page.locator('[data-action="export"]').click()
    exported = await page.evaluate('window.__exported.data')
    assert exported['version'] == 2 and exported['collections'][0]['name'] == 'Kitchen scene'
    s.passed('Library export includes saved IDs and named collections')
    imported = {'version': 2, 'dataset': 'nvidia/simready-assets', 'ids': [first_id], 'collections': [{'id': 'imported', 'name': 'Imported collection', 'ids': [first_id]}]}
    await page.locator('#import-file').set_input_files({'name': 'atlas-library.json', 'mimeType': 'application/json', 'buffer': json.dumps(imported).encode()})
    await page.wait_for_function('document.querySelectorAll("#collections [data-collection]").length === 2')
    s.passed('Versioned collection import merges without replacing existing collections')


async def check_collection_delete(s):
    page = s.page
    await page.locator('#collection-manage').click()
    await page.locator('#delete-collection').click()
    await page.locator('#cancel-delete').click()
    assert await page.locator('#collection-name').input_value() == 'Kitchen scene'
    await page.locator('#delete-collection').click()
    await page.locator('#confirm-delete').click()
    await s.results('15 assets')
    s.passed('Collection deletion requires confirmation and does not delete objects')
