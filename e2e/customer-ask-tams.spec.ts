import { expect, test, type Page } from './fixtures'

// Ask TAMS reliability: follow-up suggestions after every answer, multi-turn context, no duplicate sends,
// retry after an error, and a conversation that survives closing, reopening and changing page.

const panel = (page: Page) => page.getByRole('dialog', { name: 'Ask TAMS assistant' })
const chips = (page: Page) => panel(page).getByRole('group', { name: 'Suggested questions' }).getByRole('button')
const bubbles = (page: Page) => panel(page).getByRole('log').locator('p.bg-brand-600')
const answers = (page: Page) => panel(page).getByRole('log').locator('div.bg-surface-muted')

async function waitAnswer(page: Page, count: number) {
  await expect(answers(page)).toHaveCount(count)
  await expect(panel(page).getByLabel('Ask TAMS is typing')).toHaveCount(0)
}

test('five exchanges, typed and suggested, each followed by fresh suggestions', async ({ page }) => {
  await page.goto('/app/tours/SVC-BAG')
  await page.getByRole('button', { name: 'Ask TAMS', exact: true }).click()
  const input = panel(page).getByLabel('Your question')

  // 1. Typed payment question.
  await input.fill('How do I pay?')
  await input.press('Enter')
  await waitAnswer(page, 1)
  await expect(chips(page)).toHaveCount(4)
  await expect(chips(page).filter({ hasText: 'How do I upload my receipt?' })).toHaveCount(1)

  // 2. Suggested question.
  await chips(page).filter({ hasText: 'How do I upload my receipt?' }).click()
  await waitAnswer(page, 2)
  await expect(answers(page).last()).toContainText('reference number')
  await expect(chips(page).filter({ hasText: 'How do I upload my receipt?' })).toHaveCount(0)
  expect(await chips(page).count()).toBeGreaterThanOrEqual(3)

  // 3. Suggested question about verification.
  await chips(page).filter({ hasText: 'When will my payment be verified?' }).click()
  await waitAnswer(page, 3)
  await expect(answers(page).last()).toContainText('Awaiting verification')

  // 4. Typed tour question: the page's tour is the topic.
  await input.fill("What's included?")
  await input.press('Enter')
  await waitAnswer(page, 4)
  await expect(answers(page).last()).toContainText('includes')
  await expect(chips(page).filter({ hasText: 'Where is the pickup point?' })).toHaveCount(1)

  // 5. Suggested follow-up keeps the same tour.
  await chips(page).filter({ hasText: 'Which dates are available?' }).click()
  await waitAnswer(page, 5)
  await expect(answers(page).last()).toContainText(/departure|no open dates/)

  // 6. An unclear question gets alternatives, not a guess.
  await input.fill('qwerty zxcv')
  await input.press('Enter')
  await waitAnswer(page, 6)
  await expect(answers(page).last()).toContainText('Try asking it another way')
  expect(await chips(page).count()).toBeGreaterThanOrEqual(3)
  await expect(bubbles(page)).toHaveCount(6)
})

test('no duplicate or empty sends, and the chat survives closing and navigation', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Ask TAMS', exact: true }).click()
  const input = panel(page).getByLabel('Your question')
  await input.fill('   ')
  await expect(panel(page).getByRole('button', { name: 'Send question' })).toBeDisabled()
  await input.press('Enter')
  await expect(bubbles(page)).toHaveCount(0)

  // Rapid clicks on a suggestion send it once.
  const first = chips(page).first()
  await first.click()
  await first.click({ force: true }).catch(() => {})
  await chips(page).nth(1).click({ force: true }).catch(() => {})
  await waitAnswer(page, 1)
  await expect(bubbles(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Close assistant' }).click()
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Explore' }).click()
  await page.getByRole('button', { name: 'Ask TAMS', exact: true }).click()
  await expect(bubbles(page)).toHaveCount(1)
  await expect(answers(page)).toHaveCount(1)
  expect(await chips(page).count()).toBeGreaterThanOrEqual(3)

  // New conversation clears it.
  await panel(page).getByRole('button', { name: 'New conversation' }).click()
  await expect(bubbles(page)).toHaveCount(0)
  await expect(chips(page).first()).toBeVisible()
})

test('a failed answer keeps the question and can be retried', async ({ page }) => {
  await page.goto('/app')
  await page.evaluate(() => ((window as unknown as { __TAMS_ASSIST_FAIL__: number }).__TAMS_ASSIST_FAIL__ = 1))
  await page.getByRole('button', { name: 'Ask TAMS', exact: true }).click()
  const input = panel(page).getByLabel('Your question')
  await input.fill('How much is a van rental?')
  await input.press('Enter')
  const err = panel(page).getByRole('alert')
  await expect(err).toContainText('try again')
  await err.getByRole('button', { name: 'Retry' }).click()
  await expect(answers(page).last()).toContainText('per service day')
  await expect(bubbles(page)).toHaveCount(1)
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  expect(await chips(page).count()).toBeGreaterThanOrEqual(3)
})
