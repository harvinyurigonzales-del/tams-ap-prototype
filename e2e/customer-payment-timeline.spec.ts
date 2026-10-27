import { expect, signInSample, test } from './fixtures'

// The payment deadline policy, shown on one booking with the presenter's "Preview payment timeline".

const SHOTS = process.env.SHOTS_DIR

test('Maria previews her payment timeline: deadline, auto-cancellation, then restore', async ({ page }) => {
  await page.goto('/app/login')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByText('Hello, Maria')).toBeVisible()
  await page.goto('/app/book/DEP-BAG-1017?pax=1')
  await page.getByRole('button', { name: 'Review booking' }).click()
  await expect(page.getByText(/72 hours before departure/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  const ref = (await page.getByText(/BK-2026-\d{4}/).first().textContent())!.match(/BK-2026-\d{4}/)![0]

  await page.goto(`/app/trips/${ref}`)
  await expect(page.getByText('Balance not yet due')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request cancellation' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/timeline-1-upcoming.png`, fullPage: true })

  await page.getByRole('button', { name: 'Preview payment timeline' }).click()
  await page.getByRole('button', { name: 'Advance to reminder' }).click()
  await expect(page.getByText('Due within 24 hours')).toBeVisible()
  await page.getByRole('button', { name: 'Advance to payment deadline' }).click()
  await expect(page.getByText('Payment due now').first()).toBeVisible()
  // Inside 72 hours the customer can no longer cancel online.
  await expect(page.getByText('Cancellation requests are closed')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/timeline-2-due.png`, fullPage: true })

  await page.getByRole('button', { name: 'Advance past grace period' }).click()
  await expect(page.getByText('Payment deadline missed').first()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/timeline-3-cancelled.png`, fullPage: true })

  await page.getByRole('button', { name: 'Restore scenario' }).click()
  await expect(page.getByText('Balance not yet due')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request cancellation' })).toBeVisible()
})
