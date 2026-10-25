import { expect, test } from './fixtures'

// Second revision round: hero slideshow, looping carousels, floating assistant, sign-in page and demo helpers.

test('hero slideshow cycles on its own, pauses on interaction and keeps the search in place', async ({ page }) => {
  await page.goto('/app')
  const controls = page.getByRole('group', { name: 'Slideshow controls' })
  await expect(controls.getByText('1/10')).toBeVisible()
  // No visible pause button; it advances by itself about every 3 seconds.
  await expect(page.getByRole('button', { name: /Pause slideshow|Play slideshow/ })).toHaveCount(0)
  await expect(controls.getByText('2/10')).toBeVisible({ timeout: 8000 })
  // Pointer on the controls holds the current photo.
  await controls.hover()
  const held = await controls.locator('span[aria-label^="Photo"]').textContent()
  await page.waitForTimeout(3600)
  await expect(controls.locator('span[aria-label^="Photo"]')).toHaveText(held!)
  await controls.getByRole('button', { name: 'Previous photo' }).click()
  await controls.getByRole('button', { name: 'Previous photo' }).click()
  await controls.getByRole('button', { name: 'Next photo' }).click()
  await controls.getByRole('button', { name: 'Next photo' }).click()
  await expect(controls.locator('span[aria-label^="Photo"]')).toHaveText(held!)
  await page.goto('/app')
  await controls.getByRole('button', { name: 'Next photo' }).click()
  await expect(controls.getByText('2/10')).toBeVisible()
  await controls.getByRole('button', { name: 'Previous photo' }).click()
  await controls.getByRole('button', { name: 'Previous photo' }).click()
  await expect(controls.getByText('10/10')).toBeVisible()
  await expect(page.getByRole('search', { name: 'Find a trip' }).or(page.getByLabel('Find a trip')).first()).toBeVisible()
})

test('carousels loop with edge arrows and count each card once for keyboard users', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/app')
  const rail = page.getByRole('region', { name: /Leaving soon|Popular|Recommended|tours/i }).first()
  await rail.scrollIntoViewIfNeeded()
  const next = page.getByRole('button', { name: /^Next in / }).first()
  await expect(next).toBeVisible()
  const hidden = rail.locator('[aria-hidden="true"][inert]')
  expect(await hidden.count()).toBeGreaterThan(0)
  await next.click()
  await page.getByRole('button', { name: /^Previous in / }).first().click()
  // No visible scrollbar on the rail.
  const scrollbar = await rail.evaluate((el) => el.offsetHeight - el.clientHeight)
  expect(scrollbar).toBe(0)
})

test('floating Ask TAMS launcher opens the chat above it and keeps the conversation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/app')
  const launcher = page.getByRole('button', { name: 'Ask TAMS', exact: true })
  const box = (await launcher.boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(1280 - 60)
  expect(box.y + box.height).toBeGreaterThan(900 - 60)
  await launcher.click()
  const panel = page.getByRole('dialog', { name: 'Ask TAMS assistant' })
  await expect(panel).toBeVisible()
  const pbox = (await panel.boundingBox())!
  expect(pbox.y + pbox.height).toBeLessThanOrEqual(box.y + 4)
  await panel.getByRole('group', { name: 'Suggested questions' }).getByRole('button').first().click()
  await expect(panel.locator('.fade-in').nth(1)).toBeVisible()
  await page.getByRole('button', { name: 'Close Ask TAMS' }).click()
  await launcher.click()
  await expect(panel.locator('.fade-in').nth(1)).toBeVisible()
})

test('sign-in page: Google is honest without a client ID, demo is separate, and booking context returns', async ({ page }) => {
  await page.goto('/app/login?next=%2Fapp%2Fexplore')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('dialog', { name: /Google sign-in isn.t available yet/ })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByLabel('Password', { exact: true }).fill('x')
  await page.getByRole('button', { name: /show password/i }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Use sample account' }).click()
  await expect(page).toHaveURL(/\/app\/explore/)
})

test('sample data fills on request, asks before replacing, and never submits', async ({ page }) => {
  await page.goto('/app/rental/request')
  await page.getByRole('combobox', { name: 'Pickup address or landmark' }).fill('My house')
  await page.getByRole('button', { name: 'Use sample data' }).click()
  await expect(page.getByRole('dialog', { name: 'Replace your answers?' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Replace with sample data' }).click()
  await expect(page.getByRole('combobox', { name: 'Pickup address or landmark' })).toHaveValue('Malolos Cathedral, Malolos')
  await expect(page.getByText('service day').first()).toBeVisible()
  await expect(page).toHaveURL(/\/app\/rental\/request/)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear form' }).click()
  await expect(page.getByRole('combobox', { name: 'Pickup address or landmark' })).toHaveValue('')
})

test('custom trip can be built from scratch with a place outside the catalog', async ({ page }) => {
  await page.goto('/app/custom/form')
  await page.getByRole('combobox', { name: 'Destination' }).fill('Daet, Camarines Norte')
  await expect(page.getByText('Not in our list yet. Staff check whether we can take you there.')).toBeVisible()
  await page.getByLabel('Build from scratch').check()
  await page.getByRole('combobox', { name: 'Add your own stop' }).fill('Bagasbas Beach')
  await page.keyboard.press('Enter')
  await page.getByRole('combobox', { name: 'Add your own stop' }).fill('Daet heritage walk')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Move Daet heritage walk up' }).click()
  const items = page.getByRole('listitem').filter({ hasText: 'Your stop' })
  await expect(items.first()).toContainText('Daet heritage walk')
})
