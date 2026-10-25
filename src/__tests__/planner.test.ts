import { describe, expect, it } from 'vitest'
import {
  addAttraction, addCustomStop, buildPlan, budgetOf, checkPlan, emptyAnswers, estimate, moveStop, quickAction, rankDestinations, refitDays,
  removeStop, sampleAnswers, schedule, suggestAnother, toggleLock, validateQuestion, whyItFits, type PlannerAnswers, type TripPlan,
} from '../domain/planner/engine'
import { customerFixture as customerSeed } from './fixtures'

const catalog = customerSeed().destinations
const dest = (id: string) => catalog.find((d) => d.id === id)!
const keys = (p: TripPlan) => p.days.flat().map((s) => s.key)
const withA = (patch: Partial<PlannerAnswers>): PlannerAnswers => ({ ...sampleAnswers(), ...patch })

describe('planner: the sample trip', () => {
  const a = sampleAnswers()
  const plan = buildPlan(a, dest('DST-LAUNION'))

  it('makes a relaxed two-day La Union plan with beach stops and no conflicts', () => {
    expect(plan.days).toHaveLength(2)
    plan.days.forEach((d) => expect(d.length).toBeLessThanOrEqual(2))
    expect(plan.days.flat().some((s) => s.tags.includes('Beach'))).toBe(true)
    // The notes ask for a sunset, and it lands on the overnight day, not the trip home.
    expect(plan.days[0].some((s) => s.key === 'lu-sunset')).toBe(true)
    expect(checkPlan(plan, a)).toEqual([])
  })

  it('schedules travel, meals, check-in and free time without fake dates', () => {
    const s = schedule(plan, a)
    expect(s.map((d) => d.date)).toEqual([undefined, undefined])
    const kinds = s[0].items.map((i) => i.kind)
    expect(kinds[0]).toBe('pickup')
    expect(kinds).toContain('checkin')
    expect(kinds).toContain('free')
    expect(s[0].items.filter((i) => i.title === 'Dinner')).toHaveLength(1)
    expect(s[1].items.at(-1)!.kind).toBe('return')
    // Times only move forward within a day.
    s.forEach((d) => d.items.reduce((t, i) => (expect(i.start).toBeGreaterThanOrEqual(t), i.end), 0))
  })

  it('prices shared, per-person, optional and quote items once each', () => {
    const e = estimate(plan, a)
    const shared = e.lines.filter((l) => l.group === 'shared' || l.group === 'person')
    expect(e.total).toBe(shared.reduce((n, l) => n + (l.amount ?? 0), 0))
    expect(e.perPerson).toBe(Math.ceil(e.total / 6))
    expect(e.lines.filter((l) => /van/i.test(l.label))).toHaveLength(1)
    expect(e.lines.filter((l) => /allowance/i.test(l.label))).toHaveLength(1)
    expect(e.lines.find((l) => /hotel/i.test(l.label))!.amount).toBe(2200 * 3)
    // Meals stay optional and are not in the total.
    expect(e.lines.find((l) => l.group === 'optional')).toBeTruthy()
    expect(e.lines.some((l) => l.group === 'quote' && /tolls/i.test(l.label))).toBe(true)
  })

  it('explains the fit using the answers', () => {
    const why = whyItFits(plan, a).join(' ')
    expect(why).toMatch(/beach and food/)
    expect(why).toMatch(/Malolos/)
    expect(why).toMatch(/Relaxed pace/)
    expect(why).toMatch(/within your ₱6,000/)
  })
})

describe('planner: questions', () => {
  it('requires an answer and keeps budget basis explicit', () => {
    const a = emptyAnswers()
    expect(validateQuestion('destination', a).destination).toBeTruthy()
    expect(validateQuestion('budget', a).basis).toBeTruthy()
    a.budget = { basis: 'person', amount: null }
    expect(validateQuestion('budget', a).amount).toBeTruthy()
    a.budget = { basis: 'help', amount: null }
    expect(validateQuestion('budget', a)).toEqual({})
    // An unspecified budget is never treated as zero.
    expect(budgetOf(a)).toBeNull()
  })

  it('checks dates are at least a week out and in order', () => {
    const a = emptyAnswers()
    a.dates = { mode: 'exact', start: '2026-10-09', end: '2026-10-08', days: 0, window: '' }
    const e = validateQuestion('dates', a, '2026-10-08')
    expect(e.start).toMatch(/at least a week/)
    expect(e.end).toMatch(/on or after/)
    a.dates = { mode: 'exact', start: '2026-10-20', end: '2026-10-21', days: 0, window: '' }
    expect(validateQuestion('dates', a, '2026-10-08')).toEqual({})
  })

  it('keeps children and seniors within the group', () => {
    const a = emptyAnswers()
    a.group = { type: 'Family', size: 3, children: 2, seniors: 2 }
    expect(validateQuestion('group', a).extra).toBeTruthy()
  })
})

describe('planner: suggestions and conflicts', () => {
  it('suggests nearby beach day trips from Bulacan with reasons', () => {
    const a = withA({ destination: { mode: 'suggest', id: '', text: '' }, dates: { mode: 'undecided', start: '', end: '', days: 1, window: '' } })
    const top = rankDestinations(a, catalog).slice(0, 3)
    expect(top).toHaveLength(3)
    top.forEach((s) => expect(s.drive).toBeLessThanOrEqual(5 * 60))
    expect(top[0].reasons.join(' ')).toMatch(/beach/)
  })

  it('flags a day trip that is too far and offers adjustments', () => {
    const a = withA({ destination: { mode: 'chosen', id: 'DST-SAGADA', text: '' }, dates: { mode: 'undecided', start: '', end: '', days: 1, window: '' } })
    const issues = checkPlan(buildPlan(a, dest('DST-SAGADA')), a)
    const far = issues.find((i) => i.id === 'too-short')!
    expect(far.fixes.map((f) => f.id)).toEqual(['add-day', 'nearer'])
  })

  it('flags a budget the plan cannot meet', () => {
    const a = withA({ budget: { basis: 'person', amount: 2000 } })
    const issue = checkPlan(buildPlan(a, dest('DST-LAUNION')), a).find((i) => i.id === 'budget')!
    expect(issue.fixes.map((f) => f.id)).toContain('raise-budget')
  })

  it('reads a group budget as a total', () => {
    expect(budgetOf(withA({ budget: { basis: 'group', amount: 30000 } }))).toEqual({ perPerson: 5000, group: 30000 })
  })

  it('avoids hard stops for seniors, and warns when one is added', () => {
    const a = withA({ group: { type: 'Family', size: 6, children: 0, seniors: 2 } })
    const p = buildPlan(a, dest('DST-LAUNION'))
    expect(keys(p)).not.toContain('lu-tangadan')
    const added = addAttraction(p, 'lu-tangadan', 1)
    expect(checkPlan(added, a).some((i) => i.id === 'effort')).toBe(true)
  })

  it('does not invent a route for a place we have no data for', () => {
    const a = withA({ destination: { mode: 'other', id: '', text: 'Batanes' } })
    const p = buildPlan(a, { id: '', name: 'Batanes' })
    expect(p.days.flat()).toHaveLength(0)
    expect(checkPlan(p, a)[0].id).toBe('unknown-place')
    expect(estimate(p, a).lines.some((l) => l.group === 'quote' && /route/i.test(l.label))).toBe(true)
  })

  it('keeps must-visits we don’t know as stops for staff review', () => {
    const a = withA({ prefs: { ...sampleAnswers().prefs, mustVisit: 'Kabsat Cafe' } })
    const p = buildPlan(a, dest('DST-LAUNION'))
    const own = p.days.flat().find((s) => s.custom)!
    expect(own.name).toBe('Kabsat Cafe')
    expect(own.locked).toBe(true)
    expect(estimate(p, a).lines.some((l) => l.group === 'quote' && l.label.startsWith('Kabsat Cafe'))).toBe(true)
  })

  it('reports a day that no longer fits', () => {
    const a = withA({ pace: 'Packed' })
    let p = buildPlan(a, dest('DST-LAUNION'))
    for (const n of ['One', 'Two', 'Three', 'Four', 'Five']) p = addCustomStop(p, `Extra stop ${n}`, 1)
    expect(checkPlan(p, a).some((i) => i.id.startsWith('overflow-'))).toBe(true)
  })
})

describe('planner: editing, locking and regenerating', () => {
  const a = sampleAnswers()
  const base = buildPlan(a, dest('DST-LAUNION'))

  it('keeps locked stops when suggesting another plan', () => {
    const first = base.days[1][0].key
    const locked = toggleLock(base, first)
    const next = suggestAnother(locked, a, catalog, ['DST-LAUNION'])
    expect(next.changed).toBe(true)
    expect(keys(next.plan)).toContain(first)
    expect(keys(next.plan)).not.toEqual(keys(base))
  })

  it('offers another destination when we picked it and nothing is locked', () => {
    const s = { ...a, destination: { mode: 'suggest' as const, id: '', text: '' } }
    const next = suggestAnother(base, s, catalog, ['DST-LAUNION'])
    expect(next.destinationId).toBeTruthy()
    expect(next.destinationId).not.toBe('DST-LAUNION')
  })

  it('says so when there is no meaningful alternative', () => {
    let p = base
    for (const k of keys(p)) p = toggleLock(p, k)
    const next = suggestAnother(p, a, catalog, [])
    expect(next.changed).toBe(false)
    expect(next.message).toMatch(/Unlock/)
  })

  it('moves stops across days and removes them', () => {
    const k = base.days[0].at(-1)!.key
    const moved = moveStop(base, k, 1)
    expect(moved.days[1][0].key).toBe(k)
    expect(moved.edited).toBe(true)
    expect(keys(removeStop(moved, k))).not.toContain(k)
  })

  it('quick actions change the plan and explain what changed', () => {
    const cheaper = quickAction(base, a, 'cheaper')
    expect(estimate(cheaper.plan, a).total).toBeLessThan(estimate(base, a).total)
    expect(quickAction(base, a, 'fewer').plan.days.flat().length).toBe(base.days.flat().length - 1)
    expect(quickAction(base, a, 'free').plan.freeBonus).toBe(60)
    const baguio = { ...a, destination: { mode: 'chosen' as const, id: 'DST-BAGUIO', text: '' } }
    const noBeach = quickAction(buildPlan(baguio, dest('DST-BAGUIO')), baguio, 'beach')
    expect(noBeach.changed).toBe(false)
    expect(noBeach.message).toMatch(/no beach stops/)
  })

  it('keeps every stop when the trip gets shorter', () => {
    const three = buildPlan({ ...a, dates: { ...a.dates, days: 3 } }, dest('DST-LAUNION'))
    const two = refitDays(three, a)
    expect(two.days).toHaveLength(2)
    expect(keys(two).sort()).toEqual(keys(three).sort())
  })
})
