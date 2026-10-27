import { expect, signInSample, test } from './fixtures'

// A booking auto-cancelled after a partial payment opens a neutral refund review: staff prepare, admin approves,
// staff record the transfer.

const SHOTS = process.env.SHOTS_DIR

test('auto-cancellation after a down payment opens a refund review that admin approves and staff record', async ({ page }) => {
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await expect(page.getByRole('heading', { name: /Admin|Welcome/ }).first()).toBeVisible()
  await page.goto('/admin/bookings?id=BK-2026-0052')
  const panel = page.getByRole('complementary', { name: 'Booking BK-2026-0052' })
  await panel.getByRole('button', { name: 'Preview payment timeline' }).click()
  await panel.getByRole('button', { name: 'Advance past grace period' }).click()
  await expect(panel.getByText('Pending review', { exact: true })).toBeVisible()
  await expect(panel.getByText('Deductions', { exact: true })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/refund-1-review.png`, fullPage: true })
  await panel.getByRole('button', { name: 'Approve refund' }).click()
  await panel.getByLabel('Decision note').fill('Full refund of the down payment.')
  await panel.getByRole('button', { name: 'Save decision' }).click()
  await expect(panel.getByText('Approved', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Record refund sent' }).click()
  await panel.getByLabel('Transfer reference').fill('GC-778812')
  await panel.getByRole('button', { name: 'Save as processed' }).click()
  await expect(panel.getByText('Processed', { exact: true })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/refund-2-processed.png`, fullPage: true })
  await panel.getByRole('button', { name: 'Restore scenario' }).click()
  await expect(panel.getByText('Pending review', { exact: true })).toHaveCount(0)
})
