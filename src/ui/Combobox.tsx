import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface ComboOption {
  value: string
  label: string
  /** Second line, e.g. the province or the place a stop belongs to. */
  sub?: string
  /** Extra words that should match a search (e.g. the province). */
  keywords?: string
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Options matching the typed text: starts-with matches first, then contains, then keyword matches. */
export function filterOptions(options: ComboOption[], text: string, max = 8) {
  const q = norm(text)
  if (!q) return options.slice(0, max)
  const scored = options
    .map((o) => {
      const l = norm(o.label)
      const k = norm(`${o.sub ?? ''} ${o.keywords ?? ''}`)
      const score = l.startsWith(q) ? 0 : l.split(/[\s,(-]+/).some((w) => w.startsWith(q)) ? 1 : l.includes(q) ? 2 : k.includes(q) ? 3 : -1
      return { o, score }
    })
    .filter((x) => x.score >= 0)
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map((x) => x.o)
}

/**
 * Searchable text field with a suggestion list (ARIA 1.2 combobox). Typing filters the suggestions; arrow keys move
 * through them, Enter picks one and Escape closes the list. Anything typed is kept as it is, so a place that is
 * not in the list is still a valid answer.
 */
export const Combobox = forwardRef<
  HTMLInputElement,
  {
    label: string
    value: string
    onChange: (text: string) => void
    onPick?: (option: ComboOption) => void
    options: ComboOption[]
    error?: string
    hint?: ReactNode
    placeholder?: string
    icon?: ReactNode
    /** Shown under the suggestions when nothing matches. */
    freeTextNote?: string
    selected?: string
    max?: number
    autoComplete?: string
  }
>(function Combobox({ label, value, onChange, onPick, options, error, hint, placeholder, icon, freeTextNote = 'Not in the list? Keep what you typed.', selected, max = 8, autoComplete = 'off' }, ref) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [typed, setTyped] = useState(false)
  // Until the person types, show the full list; afterwards filter by their text.
  const shown = useMemo(() => filterOptions(options, typed ? value : '', max), [options, value, typed, max])

  const pick = (o: ComboOption) => {
    onPick ? onPick(o) : onChange(o.label)
    setOpen(false)
    setActive(-1)
    setTyped(false)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return (setOpen(true), setActive(e.key === 'ArrowDown' ? 0 : shown.length - 1))
      const n = shown.length
      if (n) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n))
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault()
      pick(shown[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      setActive(-1)
    }
  }

  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">{icon}</span>}
        <input
          ref={ref}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${id}-o${active}` : undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setTyped(true)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => (setOpen(false), setActive(-1), setTyped(false))}
          onKeyDown={onKey}
          className={`h-12 w-full rounded-xl border bg-surface px-3.5 pr-10 text-[15px] text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none ${icon ? 'pl-10' : ''} ${error ? 'border-bad' : 'border-line'}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            setOpen((o) => !o)
            ;(e.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus()
          }}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          hidden={!open}
          className="fade-in absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              onMouseMove={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-brand-50 text-brand-800' : 'text-ink'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{o.label}</span>
                {o.sub && <span className="block truncate text-xs text-ink-2">{o.sub}</span>}
              </span>
              {selected === o.value && <Check className="size-4 shrink-0 text-brand-600" aria-label="Selected" />}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-2">{value.trim() ? freeTextNote : 'Start typing to search.'}</li>}
        </ul>
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
