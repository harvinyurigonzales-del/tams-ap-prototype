import { beforeEach, describe, expect, it } from 'vitest'
import { draftProblems, type PlannerDraft } from '../domain/drafts'
import { setStatus } from '../domain/packages'
import { buildPlan, replaceStop, replaceWithCustom, sampleAnswers, toggleLock } from '../domain/planner/engine'
import { recommendationRows, type RecContext } from '../domain/recommend'
import { customerFixture as customerSeed, loadFixture } from './fixtures'
import { DEMO_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll } from '../state/demo'

const cust = () => useCustomer.getState()
const login = () => expect(cust().login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password).ok).toBe(true)
const mine = () => cust().data.drafts.filter((d) => d.customerId === cust().customerId)
const dest = () => customerSeed().destinations.find((d) => d.id === 'DST-LAUNION')!
const plannerPayload = (start?: string): PlannerDraft => {
  const answers = sampleAnswers()
  if (start) answers.dates = { ...answers.dates, mode: 'exact', start, end: start }
  return { answers, plan: buildPlan(answers, dest()), shown: [], kept: [] }
}

beforeEach(() => {
  resetAll()
  loadFixture(customerSeed())
})

describe('saved drafts', () => {
  it('a draft saved as a guest joins the account once after login', () => {
    const r = cust().saveTripDraft({ kind: 'planner', key: 'plan-a', title: 'La Union, 2 days', destination: 'La Union', payload: plannerPayload() })
    expect(r.ok && r.value.guest).toBe(true)
    login()
    expect(mine().filter((d) => d.key === 'plan-a')).toHaveLength(1)
    expect(cust().pendingDraft).toBeNull()
    // Logging in again does not add it a second time.
    cust().logout()
    login()
    expect(mine().filter((d) => d.key === 'plan-a')).toHaveLength(1)
  })

  it('saving the same plan again updates one draft, and delete removes it', () => {
    login()
    const before = mine().length
    const a = cust().saveTripDraft({ kind: 'planner', key: 'plan-b', title: 'First', destination: 'La Union', payload: plannerPayload() })
    const b = cust().saveTripDraft({ kind: 'planner', key: 'plan-b', title: 'Second', destination: 'La Union', payload: plannerPayload() })
    expect(a.ok && b.ok && a.value.id === b.value.id).toBe(true)
    expect(mine()).toHaveLength(before + 1)
    expect(mine()[0].title).toBe('Second')
    expect(cust().deleteTripDraft(mine()[0].id).ok).toBe(true)
    expect(mine()).toHaveLength(before)
  })

  it('flags dates that have passed and places no longer offered', () => {
    const d = customerSeed()
    expect(draftProblems(d, { kind: 'planner', payload: plannerPayload('2026-12-01') })).toEqual([])
    expect(draftProblems(d, { kind: 'planner', payload: plannerPayload('2026-09-01') })[0]).toMatch(/dates have passed/)
    expect(draftProblems(d, { kind: 'custom', payload: { startDate: '2026-12-01', destinationId: 'DST-GONE' } })[0]).toMatch(/no longer offered/)
  })
})

describe('replacing a planner stop', () => {
  const plan = buildPlan(sampleAnswers(), dest())
  const [a, b] = plan.days.flat()

  it('never adds a place already in the plan', () => {
    expect(replaceStop(plan, a.key, b.attractionId!)).toBe(plan)
  })

  it('a stop the customer names keeps the lock', () => {
    const locked = toggleLock(plan, a.key)
    const next = replaceWithCustom(locked, a.key, 'Tita Rosa’s carinderia')
    const stop = next.days.flat().find((s) => s.name === 'Tita Rosa’s carinderia')!
    expect(stop.locked).toBe(true)
  })
})

describe('home rows from preferences', () => {
  const ctx = (patch: Partial<RecContext> = {}): RecContext => ({ customerId: 'CUS-X', saved: [], viewed: [], dismissed: [], ...patch })

  it('preferences give budget and interest rows from active tours only', () => {
    const d = customerSeed()
    const prefs = { interests: ['Adventure'], budgetMax: 2000, duration: 'Any', style: 'Any' } as never
    const rows = recommendationRows(d, ctx({ prefs }))
    const budget = rows.find((r) => r.id === 'budget')!
    expect(budget.title).toBe('Within your ₱2,000 budget')
    setStatus(d.services.find((s) => s.id === budget.items[0].id)!, 'Inactive')
    const after = recommendationRows(d, ctx({ prefs })).flatMap((r) => r.items.map((i) => i.id))
    expect(after).not.toContain(budget.items[0].id)
  })
})
