import { MessageCircleQuestion, Send, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { answerQuestion, ASSISTANT_DISCLOSURE, escalationDraft, suggestedQuestions, type AssistantContext } from '../../domain/assistant'
import { useAssistant } from '../../state/assistant'
import { myRecords, useCustomer } from '../../state/customerStore'
import { Button, LinkButton } from '../../ui/Button'
import { Select, TextArea, TextField } from '../../ui/Field'

/**
 * "Ask TAMS" lives in the header next to Saved, Messages and Notifications, where people look for help,
 * instead of floating over the page. It opens the help panel anchored under the header.
 */
export function AskTamsButton({ tone }: { tone: 'overlay' | 'solid' }) {
  const { open, openWith, close } = useAssistant()
  return (
    <button
      onClick={() => (open ? close() : openWith(useAssistant.getState().context))}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="Ask TAMS"
      title="Ask TAMS: quick answers about trips, prices and payments"
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full text-sm font-semibold transition-colors max-md:w-9 sm:h-10 sm:max-md:w-10 max-md:justify-center md:pr-4 md:pl-3 ${
        tone === 'overlay'
          ? 'text-white ring-white/45 hover:bg-white/15 md:ring-1'
          : open
            ? 'bg-brand-600 text-white'
            : 'text-brand-700 ring-brand-200 hover:bg-brand-50 max-md:text-ink-2 md:ring-1'
      }`}
    >
      <MessageCircleQuestion className="size-5" aria-hidden />
      <span className="hidden md:inline">Ask TAMS</span>
    </button>
  )
}

/** Renders the help panel while it is open. */
export function AssistantMount() {
  const open = useAssistant((s) => s.open)
  return open ? <AssistantPanel /> : null
}

function contextLabel(ctx: AssistantContext, names: (c: AssistantContext) => string | undefined) {
  return names(ctx) ?? ctx.id
}

export function AssistantPanel() {
  const { context, prefill, close, clearContext } = useAssistant()
  const { data, customerId, chat, addChat } = useCustomer()
  const loc = useLocation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'chat' | 'escalate' | 'sent'>('chat')
  const [sentId, setSentId] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const askedPrefill = useRef(false)

  const ask = (question: string) => {
    if (!question.trim()) return
    const answer = answerQuestion(data, { question, customerId, context })
    addChat({ from: 'customer', text: question.trim() })
    addChat({ from: 'assistant', text: answer.text, answer })
    setText('')
  }

  useEffect(() => {
    if (prefill && !askedPrefill.current) {
      askedPrefill.current = true
      ask(prefill)
    }
    // Only on open: the prefill is a one-time question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length, mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [close])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const nameOf = (c: AssistantContext) =>
    c.kind === 'tour' ? data.services.find((s) => s.id === c.id)?.name : c.kind === 'destination' ? data.destinations.find((x) => x.id === c.id)?.name : c.id

  const last = chat.at(-1)?.answer
  const chips = last?.options ?? (chat.length === 0 ? suggestedQuestions(data, context, !!customerId) : [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(text)
  }

  return (
    <section
      role="dialog"
      aria-label="Ask TAMS assistant"
      className="fixed inset-0 z-50 flex flex-col bg-surface md:inset-auto md:top-[76px] md:right-6 md:h-[min(620px,calc(100dvh-100px))] md:w-[400px] md:rounded-2xl md:border md:border-line md:shadow-pop"
    >
      <header className="flex items-start gap-3 border-b border-line px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
          <MessageCircleQuestion className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="type-head text-lg text-charcoal">Ask TAMS</h2>
          <p className="text-xs text-ink-2">{ASSISTANT_DISCLOSURE}</p>
        </div>
        <button onClick={close} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-muted" aria-label="Close assistant">
          <X className="size-5" />
        </button>
      </header>

      {context && mode === 'chat' && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-50 px-4 py-2 text-xs text-brand-800">
          <span className="truncate">Asking about {contextLabel(context, nameOf)}</span>
          <button onClick={clearContext} className="shrink-0 font-semibold underline">
            Ask about something else
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {mode === 'chat' && (
          <>
            {chat.length === 0 && (
              <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink">
                Hi! I can answer common questions about our tours, prices, payments, van rental and custom trips using the agency’s sample information. For anything else, I can pass your question to staff.
              </p>
            )}
            {chat.map((m) =>
              m.from === 'customer' ? (
                <p key={m.id} className="ml-auto max-w-[85%] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm whitespace-pre-line text-white">
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className="max-w-[90%] rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink">
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.answer?.links && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.answer.links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to === '/app/login' ? `/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}` : l.to}
                          onClick={() => window.innerWidth < 768 && close()}
                          className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.answer?.escalate && m.id === chat.at(-1)?.id && (
                    <Button size="sm" variant="secondary" className="mt-2" icon={<UserRound className="size-4" aria-hidden />} onClick={() => setMode('escalate')}>
                      Send to staff
                    </Button>
                  )}
                </div>
              ),
            )}
          </>
        )}
        {mode === 'escalate' && <Escalate onCancel={() => setMode('chat')} onSent={(id) => { setSentId(id); setMode('sent') }} />}
        {mode === 'sent' && (
          <div className="rounded-2xl bg-ok-bg px-4 py-4 text-sm text-ok">
            <p className="font-semibold">Sent to staff · {sentId}</p>
            <p className="mt-1 text-ink">Status: Awaiting staff. Replies appear in Messages. Nothing is sent by email or SMS in this demo.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to={`/app/messages/${sentId}`} size="sm" onClick={() => window.innerWidth < 768 && close()}>
                Open in Messages
              </LinkButton>
              <Button size="sm" variant="ghost" onClick={() => setMode('chat')}>
                Back to chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {mode === 'chat' && (
        <div className="border-t border-line px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          {chips.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Suggested questions">
              {chips.map((c) => (
                <button key={c} onClick={() => ask(c)} className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                  {c}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor="ask-input" className="sr-only">
              Your question
            </label>
            <input
              id="ask-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              autoComplete="off"
              placeholder="Ask a question"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[15px] focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
            <Button type="submit" aria-label="Send question" disabled={!text.trim()} className="h-11 w-11 px-0">
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
          <button onClick={() => setMode('escalate')} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
            Send a question to staff
          </button>
        </div>
      )}
    </section>
  )
}

/** Escalation: explain, editable summary, optional related record, explicit send. */
function Escalate({ onCancel, onSent }: { onCancel: () => void; onSent: (id: string) => void }) {
  const { data, customerId, chat, escalate } = useCustomer()
  const context = useAssistant((s) => s.context)
  const loc = useLocation()
  const draft = escalationDraft(
    data,
    chat.filter((m) => m.from === 'customer').map((m) => m.text),
    context,
  )
  const mine = myRecords(data, customerId)
  const refs = [
    ...mine.bookings.filter((b) => b.status === 'Pending' || b.status === 'Confirmed').map((b) => ({ id: b.id, label: `${b.id} · ${b.label ?? data.services.find((s) => s.id === b.serviceId)?.name}` })),
    ...mine.customRequests.filter((r) => r.status !== 'Closed').map((r) => ({ id: r.id, label: `${r.id} · ${data.destinations.find((x) => x.id === r.destinationId)?.name} custom trip` })),
    ...mine.rentalRequests.filter((r) => r.status !== 'Closed').map((r) => ({ id: r.id, label: `${r.id} · van rental to ${r.dropoff}` })),
  ]
  const [subject, setSubject] = useState(draft.subject === 'Question for staff' ? '' : draft.subject)
  const [text, setText] = useState(draft.text)
  const [ref, setRef] = useState(draft.relatedRef && refs.some((r) => r.id === draft.relatedRef) ? draft.relatedRef : '')
  const [error, setError] = useState('')

  if (!customerId) {
    return (
      <div className="rounded-2xl bg-surface-muted px-4 py-4 text-sm text-ink">
        <p className="font-semibold">Log in to send your question to staff</p>
        <p className="mt-1 text-ink-2">Staff reply in your Messages, so we need to know who you are. Your chat stays here after you log in.</p>
        <div className="mt-3 flex gap-2">
          <LinkButton to={`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} size="sm">
            Log in
          </LinkButton>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Back to chat
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const r = escalate({ subject, text, relatedRef: ref || undefined })
        if (!r.ok) return setError(r.error)
        onSent(r.value.id)
      }}
    >
      <p className="rounded-2xl bg-info-bg px-4 py-3 text-sm text-info">
        Staff will read your question and reply in Messages, usually within one business day (sample policy). Check the summary below; you can edit it before sending.
      </p>
      <TextField label="Subject" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Pickup time for my trip" />
      <TextArea label="Your question" value={text} maxLength={600} onChange={(e) => setText(e.target.value)} />
      <Select label="Related booking or request (optional)" value={ref} onChange={(e) => setRef(e.target.value)}>
        <option value="">None</option>
        {refs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </Select>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Send to staff</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
