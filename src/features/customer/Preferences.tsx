import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPTY_PREFS, myRecords, useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { INTERESTS, type TravelPreferences } from '../../seed/types'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Select, TextField } from '../../ui/Field'
import { BackLink } from './Explore'

const DURATIONS: TravelPreferences['duration'][] = ['Any', 'Day trip', 'Weekend (2–3 days)', 'Longer (4+ days)']
const STYLES: TravelPreferences['style'][] = ['Any', 'Joiner tour', 'Private or custom']

export function Preferences() {
  const { data, customerId, setPreferences } = useCustomer()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [p, setP] = useState<TravelPreferences>(() => myRecords(data, customerId).prefs ?? EMPTY_PREFS)
  const [error, setError] = useState('')
  const save = () => {
    const r = setPreferences(p)
    if (!r.ok) return setError(r.error)
    toast('Preferences saved. Your suggestions are updated.')
    navigate('/app')
  }
  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/app/account" label="Account" />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Travel preferences</h1>
      <p className="mt-1 text-sm text-ink-2">We use these to suggest tours and destinations on your home page.</p>
      <Card className="mt-5 space-y-5 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">What do you enjoy?</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = p.interests.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setP({ ...p, interests: on ? p.interests.filter((x) => x !== i) : [...p.interests, i] })}
                  className={`h-9 rounded-full px-3.5 text-sm font-semibold ${on ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink-2 hover:border-brand-300'}`}
                >
                  {i}
                </button>
              )
            })}
          </div>
        </fieldset>
        <TextField
          label="Budget per person (₱)"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={p.budgetMax || ''}
          placeholder="No limit"
          onChange={(e) => setP({ ...p, budgetMax: e.target.value === '' ? 0 : Number(e.target.value) })}
          error={error}
          hint="Leave empty for no limit."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Trip length" value={p.duration} onChange={(e) => setP({ ...p, duration: e.target.value as TravelPreferences['duration'] })}>
            {DURATIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select label="Travel style" value={p.style} onChange={(e) => setP({ ...p, style: e.target.value as TravelPreferences['style'] })}>
            {STYLES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save}>Save preferences</Button>
          <Button variant="ghost" onClick={() => setP(EMPTY_PREFS)}>
            Clear all
          </Button>
        </div>
      </Card>
    </div>
  )
}
