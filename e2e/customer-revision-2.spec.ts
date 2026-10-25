import { expect, test, signInSample } from './fixtures'

// Second revision round: hero slideshow, looping carousels, floating assistant, sign-in page and demo helpers.

test('hero photos crossfade about every 1.8 seconds behind steady text, and hold while the search is in use', async ({ page }) => {
  await page.goto('/app')
  const frame = page.locator('[data-slide]')
  const title = await page.locator('#hero-title').textContent()
  await expect(frame).toHaveAttribute('data-slide', '0')
  await expect(frame).toHaveAttribute('data-slide', '1', { timeout: 6000 })
  await expect(frame).toHaveAttribute('data-slide', '2', { timeout: 6000 })
  await expect(page.locator('#hero-title')).toHaveText(title!)
  // No caption, link, credit or slideshow controls on the photo.
  await expect(page.getByRole('group', { name: 'Slideshow controls' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Pause slideshow|Play slideshow|Next photo|Previous photo/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^See tours to/ })).toHaveCount(0)
  await expect(page.locator('section[data-hero-hold]').getByText(/Photo:|©|Unsplash|Wikimedia/)).toHaveCount(0)
  // Keyboard focus in the hero search holds the current photo.
  await page.getByRole('search', { name: 'Find a trip' }).locator('input, select, button').first().focus()
  const held = await frame.getAttribute('data-slide')
  await page.waitForTimeout(3000)
  await expect(frame).toHaveAttribute('data-slide', held!)
  // Clicking blank page moves focus to the body, which fires no focusin: the slideshow must resume anyway.
  await page.locator('#hero-title').click()
  await expect(frame).not.toHaveAttribute('data-slide', held!, { timeout: 6000 })
})

test('reduced motion still changes hero photos (a fade, nothing moves)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/app')
  const frame = page.locator('[data-slide]')
  await expect(frame).toHaveAttribute('data-slide', '0')
  await expect(frame).toHaveAttribute('data-slide', '1', { timeout: 6000 })
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

test('desktop Ask TAMS launcher opens the chat above it, and closing starts fresh', async ({ page }) => {
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
  await expect(panel.getByRole('log').locator('p.bg-brand-600')).toHaveCount(1)
  await page.getByRole('button', { name: /^Close/ }).first().click()
  await launcher.click()
  await expect(panel.getByRole('log').locator('p.bg-brand-600')).toHaveCount(0)
  await expect(panel.getByRole('group', { name: 'Suggested questions' }).getByRole('button').first()).toBeVisible()
})

test('one login page with no fake social buttons, and the booking context returns after login', async ({ page }) => {
  await page.goto('/app/login?next=%2Fapp%2Fexplore')
  await expect(page.getByRole('button', { name: /Continue with (Google|Facebook|Apple)/ })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Customer|Staff|Admin/ })).toHaveCount(0)
  await page.getByLabel('Password', { exact: true }).fill('x')
  await page.getByRole('button', { name: /show password/i }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await signInSample(page, 'Maria Santos')
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
