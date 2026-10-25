import { adminNav, expect, signInSample, test } from './fixtures'

test('staff login, payment verification, confirmation and an assignment', async ({ page }) => {
  // A guest following a staff link is asked to log in on the same login page customers use.
  await page.goto('/admin/payments')
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible()
  await signInSample(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Magandang umaga, Admin' })).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-dashboard.png', fullPage: true })

  await page.getByRole('link', { name: /Payments to verify/ }).click()
  const rows = page.locator('tbody tr')
  const waiting = await rows.count()
  expect(waiting).toBeGreaterThan(1)
  await rows.first().getByRole('button', { name: /^BK-2026-/ }).click()
  const panel = page.getByRole('complementary', { name: /^Booking BK-2026-/ })
  await panel.getByRole('button', { name: 'View proof' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await expect(panel.getByText(/Partially paid|Paid in full/).first()).toBeVisible()
  const confirm = panel.getByRole('button', { name: 'Confirm booking' })
  if (await confirm.isEnabled().catch(() => false)) {
    await confirm.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click()
  }
  await expect(panel.getByText('Confirmed').first()).toBeVisible()

  // Assign a van and driver to a trip that still needs one; vans and drivers already out show why.
  await adminNav(page, 'Calendar')
  await page.getByRole('button', { name: /Oct 17, 2026/ }).click()
  await page.getByRole('listitem').filter({ hasText: 'Van rental · Baler' }).getByRole('button', { name: 'Assign van and driver' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByText('Assigned to DEP-BAG-1017 · Oct 17–18').first()).toBeVisible()
  await expect(dlg.getByText('Unavailable until Oct 20')).toBeVisible()
  await dlg.locator('input[name="van"]:not([disabled])').first().check()
  await dlg.locator('input[name="driver"]:not([disabled])').first().check()
  await dlg.getByRole('button', { name: 'Save assignment' }).click()
  await expect(dlg).toHaveCount(0)
  await expect(page.getByRole('listitem').filter({ hasText: 'Van rental · Baler' }).getByRole('button', { name: 'Change van' })).toBeVisible()

  await adminNav(page, 'Reports')
  await page.getByRole('tab', { name: 'Revenue' }).click()
  await expect(page.getByText(/₱[\d,]+/).first()).toBeVisible()
})

test('admin requests and inquiries', async ({ page }) => {
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await adminNav(page, 'Requests')
  await page.getByRole('button', { name: /CR-2026-0011/ }).click()
  await page.getByRole('button', { name: 'Start review' }).click()
  await expect(page.getByText('Moved to review.')).toBeVisible()
  await page.getByRole('tab', { name: /Van rental/ }).click()
  await page.getByRole('button', { name: /VR-2026-0002/ }).click()
  await page.getByRole('button', { name: 'Start review' }).click()
  await page.getByRole('button', { name: 'Send quote' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send quote' }).click()
  await expect(page.getByText('Waiting for the customer to accept or ask for changes.')).toBeVisible()
  await page.getByRole('button', { name: /VR-2026-0001/ }).click()
  await expect(page.getByText(/Linked booking/)).toBeVisible()

  await adminNav(page, 'Inquiries')
  await page.getByRole('button', { name: /Pickup point/ }).click()
  await page.getByRole('button', { name: 'Insert suggested reply' }).click()
  await page.getByRole('button', { name: 'Record reply' }).click()
  await expect(page.getByText('Staff replied').first()).toBeVisible()
})

test('sales outlook tells actual, forecast, range and last year apart, and replying to a review', async ({ page }) => {
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Sales outlook' })).toBeVisible()
  const legend = page.getByRole('list', { name: 'Legend' })
  for (const l of [/^Actual$/, /^Forecast \(expected\)$/, /^Likely range/, /^Same month last year$/]) await expect(legend.getByRole('listitem').filter({ hasText: l })).toHaveCount(1)
  await expect(page.getByRole('definition').filter({ hasText: 'December 2026' })).toBeVisible()
  await page.getByText('Show forecast as a table').click()
  await expect(page.getByRole('cell', { name: 'March 2027' })).toBeVisible()

  await adminNav(page, 'Reviews')
  await page.getByRole('tab', { name: /Needs reply/ }).click()
  const count = Number((await page.getByRole('tab', { name: /Needs reply/ }).textContent())!.match(/\d+/)![0])
  await page.getByRole('button', { name: 'Reply' }).first().click()
  await page.getByRole('button', { name: 'Post reply' }).click()
  await expect(page.getByText('Write a reply first.')).toBeVisible()
  await page.getByLabel(/^Reply to/).fill('Salamat po! See you on your next trip.')
  await page.getByRole('button', { name: 'Post reply' }).click()
  await expect(page.getByText('Reply posted under the review.')).toBeVisible()
  await expect(page.getByRole('tab', { name: new RegExp(`Needs reply\\s*${count - 1}`) })).toBeVisible()
})

test.describe('short screens', () => {
  test.use({ viewport: { width: 1280, height: 520 } })
  test('every staff section is reachable from the side navigation, with no visible scrollbar', async ({ page }) => {
    await page.goto('/admin/login')
    await signInSample(page, 'Admin')
    const nav = page.getByRole('navigation', { name: 'Admin' })
    expect(await nav.evaluate((el) => el.offsetWidth - el.clientWidth)).toBe(0)
    for (const g of ['Overview', 'Bookings and requests', 'Fleet and operations', 'Finance and reports', 'Administration'])
      await expect(nav.getByRole('button', { name: new RegExp(`^${g}`) })).toBeVisible()
    for (const [label, path] of [
      ['Notifications', '/admin/notifications'], ['Bookings', '/admin/bookings'], ['Calendar', '/admin/calendar'], ['Requests', '/admin/requests'],
      ['Customers', '/admin/customers'], ['Inquiries', '/admin/inquiries'], ['Reviews', '/admin/reviews'], ['Vehicles', '/admin/vehicles'],
      ['Drivers', '/admin/drivers'], ['Maintenance', '/admin/maintenance'], ['Tour packages', '/admin/packages'], ['Payments', '/admin/payments'],
      ['Reports', '/admin/reports'], ['Staff accounts', '/admin/staff'], ['Manage chatbot', '/admin/chatbot'], ['Settings', '/admin/settings'],
    ]) {
      await adminNav(page, label)
      await expect(page).toHaveURL(new RegExp(path))
      // The group holding the current page stays open.
      await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) })).toBeInViewport()
    }
  })

  test('phones use a drawer for the staff navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 640 })
    await page.goto('/admin/login')
    await signInSample(page, 'Liza Manalo')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const drawer = page.getByRole('dialog', { name: 'Menu' })
    await expect(drawer).toBeVisible()
    await adminNav(page, 'Maintenance')
    await expect(page).toHaveURL(/\/admin\/maintenance/)
  })
})
