import { expect, signInSample, test } from './fixtures'

// Planner Replace flow, drafts that survive logging in, and personal rows first on Home.

const SHOTS = process.env.SHOTS_DIR

test('replace a stop with a preview, keep a draft through login, then resume and delete it', async ({ page }) => {
  await page.goto('/app/custom/new')
  await page.getByRole('button', { name: 'Try a sample trip' }).click()
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: 'Plan my trip' }).click()
  await expect(page.getByRole('heading', { name: /San Juan, La Union, 2 days/ })).toBeVisible({ timeout: 8000 })

  // A kept stop asks to be unlocked before it can be replaced.
  await page.getByRole('button', { name: 'Keep this' }).first().click()
  await page.getByRole('button', { name: 'Replace' }).first().click()
  const dlg = page.getByRole('dialog')
  const title = (await dlg.getByRole('heading').first().textContent())!
  const original = title.replace(/^Replace /, '')
  await dlg.getByRole('button', { name: 'Unlock and choose a replacement' }).click()

  // Search, the empty state with your own stop, then preview and confirm.
  await dlg.getByLabel('Search places').fill('zzzz')
  await expect(dlg.getByText(/No places match/)).toBeVisible()
  await expect(dlg.getByLabel('Or name a place you want instead')).toBeVisible()
  await dlg.getByLabel('Search places').fill('')
  const option = dlg.locator('ul button').first()
  const replacement = (await option.locator('span span').first().textContent())!.trim()
  await option.click()
  await expect(dlg.getByText('Preview')).toBeVisible()
  await expect(dlg.getByText(/Estimated cost per person/)).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/replace-preview.png` })
  await dlg.getByRole('button', { name: 'Confirm replacement' }).click()
  await expect(page.getByText(`Replaced ${original} with ${replacement}.`).first()).toBeVisible()
  // The replacement is not offered again, and Undo puts the original back.
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect(page.getByRole('button', { name: `Remove ${original}` })).toBeVisible()

  // Saved as a guest, the draft joins My Trips after logging in.
  await page.getByRole('button', { name: 'Save draft' }).last().click()
  await expect(page.getByText('Draft kept in this browser tab. Log in to keep it in My Trips.')).toBeVisible()
  await page.goto('/app/login?next=%2Fapp%2Ftrips%3Ftab%3Ddrafts')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByRole('tab', { name: /Drafts 1/ })).toBeVisible()
  await expect(page.getByText('San Juan, La Union, 2 days')).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/drafts-list.png` })

  // Resume opens the plan; saving again updates the same draft.
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('heading', { name: /San Juan, La Union, 2 days/ })).toBeVisible()
  await page.getByRole('button', { name: 'Save draft' }).last().click()
  await expect(page.getByText('Draft saved. Find it under Drafts in My Trips.')).toBeVisible()
  await page.goto('/app/trips?tab=drafts')
  await expect(page.getByRole('tab', { name: /Drafts 1/ })).toBeVisible()
  await page.getByRole('button', { name: 'Delete draft San Juan, La Union, 2 days' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete draft' }).click()
  await expect(page.getByText('No saved drafts')).toBeVisible()
})

test('Home starts with Saan tayo next for guests, and with your own rows once preferences are set', async ({ page }) => {
  await page.goto('/app')
  expect(await page.locator('main section h2').first().textContent()).toContain('Saan tayo next?')
  await page.goto('/app/login')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByText('Hello, Maria')).toBeVisible()
  await page.goto('/app/preferences')
  const adventure = page.getByRole('button', { name: 'Adventure', exact: true })
  await expect(adventure).toBeVisible()
  if ((await adventure.getAttribute('aria-pressed')) !== 'true') await adventure.click()
  await page.getByLabel('Budget per person (₱)').fill('2000')
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await page.goto('/app')
  const first = page.locator('main section h2').first()
  await expect(first).toContainText(/Because you like adventure|Within your ₱2,000 budget/)
  await expect(page.getByRole('link', { name: 'Edit preferences' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-for-you.png`, fullPage: true })
})

test('photos open their place, and the planner offers a solo trip', async ({ page }) => {
  await page.goto('/app/explore?view=destinations')
  const photo = page.locator('main article:has(a[href^="/app/destinations/"]) img[alt]:not([alt=""])').first()
  await photo.scrollIntoViewIfNeeded()
  const box = (await photo.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3)
  await expect(page).toHaveURL(/\/app\/destinations\//)

  await page.goto('/app/custom/new')
  await page.getByRole('button', { name: 'Try a sample trip' }).click()
  while (!(await page.getByText('Who’s coming?').isVisible())) await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByText('Solo', { exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'How many are travelling?' })).toHaveValue('1')
})
