import { expect, signInSample, test } from './fixtures'

// Planner Replace flow, drafts that survive logging in, and "Mga trip na bagay sa'yo" on Home.

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

test('Home shows trips picked for you right under the hero, with why and a link to preferences', async ({ page }) => {
  await page.goto('/app')
  const section = page.getByRole('region', { name: 'Mga trip na bagay sa’yo' })
  await expect(section).toBeVisible()
  await expect(section.getByText(/Trips leaving soon with seats left/)).toBeVisible()
  await expect(section.getByRole('link', { name: 'Set preferences' })).toBeVisible()
  // It comes before every other section on the page.
  const first = await page.locator('main section h2').first().textContent()
  expect(first).toContain('Mga trip na bagay sa’yo')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-for-you.png`, fullPage: true })
})
