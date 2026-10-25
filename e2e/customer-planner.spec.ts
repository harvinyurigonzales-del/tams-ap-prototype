import { expect, test } from './fixtures'

// The trip planner: sample trip, editing with lock and undo, and a request that survives logging in.

test('sample trip goes from questions to an editable plan and a sent request', async ({ page }) => {
  await page.goto('/app/custom/new')
  await expect(page.getByRole('heading', { name: 'Anong alis ang nasa isip mo?' })).toBeVisible()
  await page.getByRole('button', { name: 'Try a sample trip' }).click()
  await expect(page.getByRole('heading', { name: 'May destination ka na?' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Destination' })).toHaveValue('San Juan, La Union')
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /^Continue/ }).click()
  await expect(page.getByRole('heading', { name: 'Anything we should include?' })).toBeVisible()
  await page.getByRole('button', { name: 'Plan my trip' }).click()
  await expect(page.getByText('Matching destinations to your preferences…')).toBeVisible()
  await expect(page.getByRole('heading', { name: /San Juan, La Union, 2 days/ })).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('heading', { name: 'Why this fits your trip' })).toBeVisible()
  await expect(page.getByText('Estimated cost · final quotation from TAMS-AP').first()).toBeVisible()

  // Keep a stop, ask for another plan: the kept stop stays.
  await page.getByRole('button', { name: 'Keep this' }).first().click()
  const kept = page.getByRole('button', { name: 'Keep this', pressed: true })
  await expect(kept).toHaveCount(1)
  await page.getByRole('button', { name: /Another plan|Suggest another plan/ }).first().click()
  await expect(page.getByRole('button', { name: 'Keep this', pressed: true })).toHaveCount(1)

  // Remove a stop and undo it.
  const before = await page.getByRole('button', { name: /^Remove / }).count()
  await page.getByRole('button', { name: /^Remove / }).last().click()
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(before - 1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(before)

  // Add a custom stop: marked for staff review.
  await page.getByRole('button', { name: 'Add a stop to day 2' }).click()
  await page.getByRole('dialog').getByLabel('Or add your own stop').fill('Kabsat Cafe')
  await page.getByRole('dialog').getByRole('button', { name: 'Add my stop' }).click()
  await expect(page.getByText('For staff review').first()).toBeVisible()

  // Review, log in, come back to the same draft, send.
  await page.getByRole('button', { name: 'Review trip request' }).last().click()
  await expect(page.getByRole('heading', { name: 'Review your trip request' })).toBeVisible()
  await page.getByRole('button', { name: 'Log in to send' }).click()
  await page.getByRole('button', { name: 'Use sample account' }).click()
  await expect(page.getByRole('heading', { name: 'Review your trip request' })).toBeVisible()
  await expect(page.getByText('Kabsat Cafe', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Send trip request' }).click()
  await expect(page.getByText('Trip request sent. TAMS-AP will review your plan and prepare a proposal.').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your planned trip' })).toBeVisible()
  await expect(page.getByText(/Dates to be agreed/).first()).toBeVisible()
})

test('suggest somewhere ranks a place, and an unknown place goes to staff without invented stops', async ({ page }) => {
  await page.goto('/app/custom/new')
  await page.getByRole('button', { name: 'Start planning' }).click()
  await page.getByRole('combobox', { name: 'Destination' }).fill('Batanes')
  await expect(page.getByText(/We don’t have planning data for “Batanes” yet/)).toBeVisible()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByText('Heritage', { exact: true }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByText('Couple', { exact: true }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByText('Not decided', { exact: true }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  // Budget is required: no silent zero.
  await page.getByRole('button', { name: /^Continue/ }).click()
  await expect(page.getByText('Choose how you want to set the budget.')).toBeVisible()
  await page.getByText('Help me estimate', { exact: true }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('combobox', { name: 'City or town' }).fill('Quezon City')
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByText('Balanced', { exact: true }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText('We don’t have planning data for Batanes yet')).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'See places we can plan' }).click()
  await page.getByRole('dialog').getByRole('button').nth(1).click()
  await expect(page.getByRole('heading', { name: 'Why this fits your trip' })).toBeVisible()
})
