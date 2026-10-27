import { adminNav, expect, signInSample, test, type Page } from './fixtures'

// Fleet management: maintenance list and calendar, driver unavailability with reassignment, and van records.

const SHOTS = process.env.SHOTS_DIR

async function signIn(page: Page) {
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Magandang umaga, Admin' })).toBeVisible()
}

test('maintenance: filter cards, calendar scheduling, edit, start and cancel', async ({ page }) => {
  await signIn(page)
  await adminNav(page, 'Maintenance')
  // Summary cards filter the list.
  await page.getByRole('button', { name: /^In Maintenance/ }).click()
  await expect(page.getByRole('button', { name: 'Van 03 · Scheduled maintenance' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Van 05 · Oil change and brake check' })).toHaveCount(0)
  await page.getByLabel('Search van, plate, work or provider').fill('zzz')
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).first().click()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/maint-1-list.png`, fullPage: true })

  // The calendar shows the same records; clicking a date schedules work on it.
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: /Van 05 · Oil change and brake check/ }).first()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/maint-2-calendar.png`, fullPage: true })
  await page.getByRole('button', { name: 'Schedule maintenance on Wed, Oct 28, 2026' }).click()
  const form = page.getByRole('dialog', { name: 'Schedule maintenance' })
  await expect(form.getByLabel('Start')).toHaveValue('2026-10-28')
  await form.getByLabel('Van').selectOption({ label: 'Van 15 · TMS 1015' })
  await form.getByLabel('Work to do').fill('Wheel alignment')
  await form.getByLabel('Provider (optional)').fill('Malolos Auto Care')
  await form.getByLabel('Estimated cost, ₱ (optional)').fill('1800')
  await form.getByRole('button', { name: 'Schedule' }).click()
  // The new record opens; reschedule it one day later.
  const rec = page.getByRole('dialog', { name: 'Van 15 · Wheel alignment' })
  await expect(rec.getByText('Malolos Auto Care', { exact: true })).toBeVisible()
  await rec.getByRole('button', { name: 'Edit or reschedule' }).click()
  const edit = page.getByRole('dialog', { name: /^Edit MNT-/ })
  await edit.getByLabel('End').fill('2026-10-29')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  // Saving reopens the record.
  await expect(page.getByRole('dialog').getByText('Oct 28–29', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Rescheduled', { exact: true })).toBeVisible()
  // Cancelling asks for a reason and keeps the record.
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel…' }).click()
  await page.getByRole('dialog').getByLabel('Reason').fill('Done during the next service')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel maintenance' }).click()
  await page.getByRole('tab', { name: 'List' }).click()
  await page.getByLabel('Status').selectOption('Cancelled')
  await expect(page.getByRole('button', { name: 'Van 15 · Wheel alignment' })).toBeVisible()

  // Work that has started is In Maintenance until it is confirmed done.
  await page.getByLabel('Status').selectOption('open')
  await page.getByRole('button', { name: 'Van 03 · Scheduled maintenance' }).click()
  await expect(page.getByRole('dialog').getByText('In Maintenance', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // Phones get an agenda instead of the month grid.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: /Van 05 · Oil change and brake check/ }).last()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/maint-3-mobile.png`, fullPage: true })
})

test('drivers: unavailability over a trip flags it for reassignment, then staff reassign it', async ({ page }) => {
  await signIn(page)
  await adminNav(page, 'Drivers')
  const trip = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('tams-ap-data-v1')!).data
    const a = d.assignments.filter((x: { from: string }) => x.from > '2026-10-09').sort((x: { from: string }, y: { from: string }) => x.from.localeCompare(y.from))[0]
    return { from: a.from as string, to: a.to as string, driver: d.drivers.find((x: { id: string }) => x.id === a.driverId).name as string }
  })
  await page.getByRole('button', { name: /^Unavailable/ }).click()
  await expect(page.getByText(/\d+ drivers?$/)).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).first().click()
  await page.getByRole('button', { name: `${trip.driver} details` }).click()
  const card = page.getByRole('complementary', { name: `${trip.driver} details` })
  await card.getByRole('button', { name: 'Add unavailability' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('From').fill(trip.from)
  await dlg.getByLabel('To').fill(trip.to)
  await dlg.getByLabel('Reason').selectOption('Sick leave')
  await expect(dlg.getByText(/assigned trips? falls? in this period/)).toBeVisible()
  await dlg.getByRole('button', { name: 'Mark unavailable' }).click()
  await expect(card.getByText(/Needs reassignment/).first()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/drivers-1-flag.png`, fullPage: true })
  await card.getByRole('button', { name: 'Reassign' }).first().click()
  const assign = page.getByRole('dialog', { name: 'Change van and driver' })
  await assign.locator('input[name="driver"]:not([disabled])').first().check()
  await assign.getByRole('button', { name: 'Save assignment' }).click()
  await expect(card.getByText(/Needs reassignment/)).toHaveCount(0)
  await expect(card.getByText('Sick leave').first()).toBeVisible()
  await expect(card.getByText('Marked unavailable').first()).toBeVisible()
})

test('vans: condition change is logged with before and after, and a van with history is deactivated instead of deleted', async ({ page }) => {
  await signIn(page)
  await adminNav(page, 'Vehicles')
  await page.getByRole('button', { name: 'Van 02 details' }).click()
  const card = page.getByRole('complementary', { name: 'Van 02 details' })
  await card.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByLabel('Condition').selectOption('Minor issues')
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
  await expect(card.getByText('Condition: Minor issues')).toBeVisible()
  await expect(card.getByText(/Condition: Good → Minor issues/)).toBeVisible()
  await card.getByRole('button', { name: 'Remove van' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove van' }).click()
  await expect(page.getByRole('dialog').getByText(/Deactivate|deactivate/).first()).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await card.getByRole('button', { name: 'Deactivate' }).click()
  await page.getByRole('dialog').getByLabel('Reason').fill('Sold to another operator')
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click()
  await expect(card.getByText('Inactive', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Inactive/ }).click()
  await expect(page.getByRole('button', { name: 'Van 02 details' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/vans-1-inactive.png`, fullPage: true })
})
