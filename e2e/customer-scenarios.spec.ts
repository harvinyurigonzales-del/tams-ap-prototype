import { expect, signInSample, test, type Page } from './fixtures'

// The shared records end to end: Maria (a phone) and staff (a laptop-sized tab) in the same browser.

async function bookAndPayInFull(page: Page, departureId: string) {
  await page.goto(`/app/book/${departureId}?pax=1`)
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  await expect(page.getByRole('heading', { name: 'Booking received' })).toBeVisible()
  const ref = (await page.getByText(/BK-2026-\d{4}/).first().textContent())!.match(/BK-2026-\d{4}/)![0]
  await page.getByRole('link', { name: 'Pay now' }).click()
  await page.getByText('Full amount').click()
  await page.getByRole('button', { name: 'Use sample payment details' }).click()
  await page.getByRole('button', { name: 'Submit payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit payment' }).click()
  await expect(page.getByRole('heading', { name: 'Payment submitted' })).toBeVisible()
  return ref
}

async function staffCompletes(staff: Page, ref: string) {
  await staff.goto(`/admin/bookings?id=${ref}`)
  const panel = staff.getByRole('complementary', { name: `Booking ${ref}` })
  await panel.getByRole('button', { name: 'View proof' }).click()
  await staff.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await staff.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await expect(panel.getByText('Fully paid').first()).toBeVisible()
  const confirm = panel.getByRole('button', { name: 'Confirm booking' })
  if (await confirm.count()) {
    await confirm.click()
    await staff.getByRole('dialog').getByRole('button', { name: 'Confirm booking' }).click()
  }
  await panel.getByRole('button', { name: 'Mark trip completed' }).click()
  await staff.getByRole('dialog').getByRole('button', { name: 'Mark completed' }).click()
  await expect(panel.getByText('Completed').first()).toBeVisible()
}

test('Maria books, staff see and progress it, completed trips unlock star-only reviews', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/app/login')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByText('Hello, Maria')).toBeVisible()
  const first = await bookAndPayInFull(page, 'DEP-BAG-1017')
  const second = await bookAndPayInFull(page, 'DEP-TAG-1107')

  // Staff, in another tab of the same browser, see the new payment in their notifications and follow it.
  const staff = await page.context().newPage()
  await staff.setViewportSize({ width: 1366, height: 860 })
  await staff.goto('/admin/login')
  await signInSample(staff, 'Liza Manalo')
  await expect(staff.getByRole('heading', { name: /Liza/ })).toBeVisible()
  const bell = staff.getByRole('button', { name: /^Notifications, \d+ unread/ })
  const before = Number((await bell.getAttribute('aria-label'))!.match(/(\d+) unread/)![1])
  await bell.click()
  const panel = staff.getByRole('dialog', { name: 'Notifications' })
  // Opening the panel marks nothing as read.
  await expect(staff.getByRole('button', { name: new RegExp(`^Notifications, ${before} unread`) })).toBeVisible()
  await panel.getByRole('button', { name: new RegExp(`Payment needs verification.*${second}`) }).first().click()
  await expect(staff).toHaveURL(new RegExp(second))
  await expect(staff.getByRole('complementary', { name: `Booking ${second}` })).toBeVisible()
  await expect(staff.getByRole('button', { name: new RegExp(`^Notifications, ${before - 1} unread`) })).toBeVisible()

  await staffCompletes(staff, first)
  await staffCompletes(staff, second)

  // Maria is told; the notification opens the review for that trip.
  await page.goto('/app')
  await page.getByRole('button', { name: /^Notifications, \d+ unread/ }).click()
  const mine = page.getByRole('dialog', { name: 'Notifications' })
  await expect(mine.getByText('Trip completed').first()).toBeVisible()
  await mine.getByRole('button', { name: /Trip completed/ }).first().click()
  await expect(page).toHaveURL(/\/app\/reviews\?trip=BK-2026-/)
  const asked = new URL(page.url()).searchParams.get('trip')!
  const form = page.getByRole('form', { name: /^Review / })
  await expect(form).toContainText(asked)

  // Two completed trips: each shows its package, dates and reference, and is chosen separately.
  await expect(page.getByText('You have 2 completed trips to rate. Choose one to start.')).toBeVisible()
  const other = asked === first ? second : first
  await expect(page.getByRole('button', { name: new RegExp(`Rate .*, ${other}`) })).toBeVisible()

  // Only the stars are required.
  await form.getByRole('button', { name: 'Post review' }).click()
  await expect(form.getByRole('alert')).toBeVisible()
  await form.locator('label', { hasText: '4 stars, Very good' }).click()
  await form.getByRole('button', { name: 'Post review' }).click()
  await expect(page.getByText('Thanks! Your review is posted.')).toBeVisible()
  await expect(page.getByText('Rated 4 out of 5 stars.').first()).toBeVisible()
  await expect(page.getByText('Trips you reviewed')).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`Rate .*, ${asked}`) })).toHaveCount(0)

  // The other trip from My Trips: "Rate your trip" on the booking.
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'My Trips' }).click()
  await expect(page.getByRole('heading', { name: 'Completed trips' })).toBeVisible()
  await page.goto(`/app/trips/${other}`)
  await page.getByRole('link', { name: 'Rate your trip' }).click()
  await page.getByRole('form', { name: /^Review / }).locator('label', { hasText: '5 stars, Excellent' }).click()
  await page.getByRole('form', { name: /^Review / }).getByLabel('Comment (optional)').fill('On time and friendly.')
  await page.getByRole('form', { name: /^Review / }).getByRole('button', { name: 'Post review' }).click()
  await expect(page.getByRole('heading', { name: 'Salamat sa review!' })).toBeVisible()

  // Signing out, using the staff account in this tab, and signing back in keeps every record.
  await page.goto('/app/account')
  await page.getByRole('button', { name: 'Log out' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
  await page.goto('/app/login')
  await signInSample(page, 'Liza Manalo')
  await expect(page).toHaveURL(/\/admin/)
  await page.goto('/admin/settings?tab=account')
  await page.getByRole('main').getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible()
  await page.goto('/app/login')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByText('Hello, Maria')).toBeVisible()
  await page.goto('/app/trips')
  await expect(page.getByText('Reviewed').first()).toBeVisible()
  await page.reload()
  await expect(page.getByText(first).or(page.getByText('Reviewed')).first()).toBeVisible()
})

test('mobile bottom bar: five tabs, hidden on booking steps, with the keyboard and under the assistant', async ({ page }) => {
  await page.goto('/app')
  const bar = page.getByRole('navigation', { name: 'Main' }).last()
  await expect(bar.getByRole('link')).toHaveText(['Home', 'Explore', 'My Trips', 'Profile'])
  await expect(bar.getByRole('button', { name: 'Ask TAMS', exact: true })).toBeVisible()
  // No separate floating launcher on phones.
  await expect(page.getByRole('button', { name: 'Ask TAMS', exact: true })).toHaveCount(1)

  // Opening Ask TAMS hides the bar, so the sheet and its input are never covered.
  await bar.getByRole('button', { name: 'Ask TAMS', exact: true }).click()
  const chat = page.getByRole('dialog', { name: 'Ask TAMS assistant' })
  await expect(chat).toBeVisible()
  await expect(bar).toBeHidden()
  await page.getByRole('button', { name: 'Close assistant' }).click()

  // Typing in a field hides the bar.
  await page.getByRole('search', { name: 'Find a trip' }).locator('input').first().focus()
  await expect(bar).toBeHidden()
  await page.locator('body').click({ position: { x: 5, y: 5 } })

  // The bar never covers the end of the page.
  await page.mouse.wheel(0, 20000)
  await page.waitForTimeout(400)
  const barBox = (await bar.boundingBox())!
  const footer = page.getByRole('contentinfo')
  const footBox = (await footer.boundingBox())!
  expect(footBox.y + footBox.height).toBeLessThanOrEqual(barBox.y + 1 + (await page.evaluate(() => document.documentElement.scrollHeight)))

  // Auth and booking steps hide it.
  await page.goto('/app/login')
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeHidden()
  await page.goto('/app/book/DEP-BAG-1017?pax=1')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)

  // Pages outside the bar stay reachable from the More menu.
  await page.goto('/app')
  await page.getByRole('button', { name: 'More pages' }).click()
  for (const l of [/Van Rental/, /Reviews/, /Saved/, /Messages/]) await expect(page.getByRole('dialog').getByRole('link', { name: l })).toBeVisible()
})

test('notification panel works from the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('/app/book/DEP-BAG-1017?pax=1')
  await signInSample(page, 'Maria Santos')
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  await expect(page.getByRole('heading', { name: 'Booking received' })).toBeVisible()
  await page.goto('/app')
  const bell = page.getByRole('button', { name: /^Notifications, 1 unread/ })
  await bell.focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('dialog', { name: 'Notifications' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('1 unread')).toBeVisible()
  await expect(panel.locator('[data-item]').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(bell).toBeFocused()
  await page.keyboard.press('Enter')
  await panel.getByRole('button', { name: /^Mark .* as read$/ }).first().click()
  await expect(panel.getByText('All caught up')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
  await panel.getByRole('link', { name: 'View all notifications' }).click()
  await expect(page).toHaveURL(/\/app\/notifications/)
})
