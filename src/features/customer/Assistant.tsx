import { ArrowDown, MessageCircleQuestion, RotateCcw, Send, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ASSISTANT_DISCLOSURE, escalationDraft, suggestedQuestions, type AssistantContext } from '../../domain/assistant'
import { requestDestination } from '../../domain/requests'
import { useAssistant } from '../../state/assistant'
import { myRecords, useCustomer } from '../../state/customerStore'
import { Button, LinkButton } from '../../ui/Button'
import { Select, TextArea, TextField } from '../../ui/Field'

/**
 * Ask TAMS: on larger screens a branded launcher in the bottom-right corner opens the help panel just above it.
 * On phones the centre button of the bottom navigation opens it as a sheet instead, and moving to another page
 * ends the conversation.
 */
export function AssistantMount() {
  const open = useAssistant((s) => s.open)
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (useAssistant.getState().open && !window.matchMedia('(min-width: 768px)').matches) useAssistant.getState().close()
  }, [pathname])
  return (
    <>
      <AskTamsLauncher />
      {open && <AssistantPanel />}
    </>
  )
}

/** What the customer is looking at, so a question like "What's included?" knows which tour. */
export function routeContext(pathname: string): AssistantContext | undefined {
  const m = pathname.match(/^\/app\/(tours|destinations|trips|custom|rentals)\/([A-Z]{2,4}-[\w-]+)/)
  if (!m) return undefined
  const kind = ({ tours: 'tour', destinations: 'destination', trips: 'booking', custom: 'custom', rentals: 'rental' } as const)[m[1] as 'tours']
  return { kind, id: m[2] }
}

function AskTamsLauncher() {
  const { open, openWith, close } = useAssistant()
  const { pathname } = useLocation()
  const unanswered = useCustomer((s) => s.chat.length === 0)
  return (
    <button
      onClick={() => (open ? close() : openWith(routeContext(pathname) ?? useAssistant.getState().context))}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={open ? 'Close Ask TAMS' : 'Ask TAMS'}
      title="Ask TAMS: quick answers about trips, prices and payments"
      className={`launcher fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full pr-4 pl-2 text-sm font-semibold text-white shadow-[0_10px_28px_-10px_rgba(14,29,61,0.65)] ring-1 ring-white/15 transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(14,29,61,0.7)] focus-visible:outline-offset-4 active:translate-y-0 max-md:hidden md:right-6 md:bottom-[calc(24px+var(--launcher-raise-md,0px))] ${open ? 'bg-charcoal' : 'bg-navy hover:bg-brand-700'}`}
    >
      <span className="relative grid size-8 place-items-center rounded-full bg-white/12">
        {open ? <X className="size-[18px]" aria-hidden /> : <MessageCircleQuestion className="size-[18px]" aria-hidden />}
        {!open && unanswered && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sili ring-2 ring-navy" aria-hidden />}
      </span>
      {open ? 'Close' : 'Ask TAMS'}
    </button>
  )
}

export function AssistantPanel() {
  const { context, close, clearContext, ask, retry, reset, pending } = useAssistant()
  const { data, customerId, chat } = useCustomer()
  const loc = useLocation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'chat' | 'escalate' | 'sent'>('chat')
  const [sentId, setSentId] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [unseen, setUnseen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastCount = useRef(chat.length)

  const scrollDown = (smooth = true) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setUnseen(false)
  }

  // Start at the latest message when the panel opens.
  useEffect(() => {
    scrollDown(false)
    if (window.matchMedia('(min-width: 768px)').matches) inputRef.current?.focus()
  }, [])

  // New messages scroll into view only if the customer is already at the bottom; otherwise a pill offers it.
  useEffect(() => {
    const grew = chat.length > lastCount.current
    lastCount.current = chat.length
    if (!grew && !pending) return
    if (atBottom || chat.at(-1)?.from === 'customer') requestAnimationFrame(() => scrollDown())
    else if (grew) setUnseen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.length, pending])

  useEffect(() => {
    if (mode !== 'chat') requestAnimationFrame(() => scrollDown(false))
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    setAtBottom(bottom)
    if (bottom) setUnseen(false)
  }

  const nameOf = (c: AssistantContext) =>
    c.kind === 'tour' ? data.services.find((s) => s.id === c.id)?.name : c.kind === 'destination' ? data.destinations.find((x) => x.id === c.id)?.name : c.id

  const lastAssistant = [...chat].reverse().find((m) => m.from === 'assistant' && !m.error)
  const chips = chat.length === 0 ? suggestedQuestions(data, context, !!customerId) : (lastAssistant?.answer?.options ?? suggestedQuestions(data, context, !!customerId))
  const send = (question: string) => {
    if (!question.trim() || pending) return
    ask(question)
    setText('')
    setAtBottom(true)
    if (window.matchMedia('(min-width: 768px)').matches) inputRef.current?.focus()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
  }

  return (
    <section
      role="dialog"
      aria-label="Ask TAMS assistant"
      className="sheet-in fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] bottom-0 z-50 flex flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop ring-1 ring-line md:inset-auto md:right-6 md:bottom-[88px] md:h-[min(620px,calc(100dvh-120px))] md:w-[400px] md:rounded-3xl"
    >
      <header className="flex items-start gap-3 bg-navy px-4 pt-3 pb-3 text-white">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-white">
          <MessageCircleQuestion className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="type-head text-lg">Ask TAMS</h2>
          <p className="text-xs text-white/80">{ASSISTANT_DISCLOSURE}</p>
        </div>
        {chat.length > 0 && (
          <button
            onClick={() => {
              reset()
              setMode('chat')
              setText('')
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
          >
            <RotateCcw className="size-3.5" aria-hidden /> New conversation
          </button>
        )}
        <button onClick={close} className="rounded-lg p-1.5 text-white/85 hover:bg-white/10" aria-label="Close assistant">
          <X className="size-5" />
        </button>
      </header>

      {context && mode === 'chat' && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-50 px-4 py-2 text-xs text-brand-800">
          <span className="truncate">Asking about {nameOf(context) ?? context.id}</span>
          <button onClick={clearContext} className="shrink-0 font-semibold underline">
            Ask about something else
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
          {mode === 'chat' && (
            <>
              {chat.length === 0 && (
                <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink">
                  Hi! Ask me about our tours, prices, payments, van rental and custom trips. If I can’t help, I’ll pass your question to our staff.
                </p>
              )}
              {chat.map((m) =>
                m.from === 'customer' ? (
                  <p key={m.id} className="fade-in ml-auto max-w-[85%] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm break-words whitespace-pre-line text-white">
                    {m.text}
                  </p>
                ) : m.error ? (
                  <div key={m.id} className="fade-in max-w-[90%] rounded-2xl bg-bad-bg px-4 py-3 text-sm text-bad" role="alert">
                    <p>{m.text}</p>
                    <Button size="sm" variant="secondary" className="mt-2" disabled={pending} icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => retry(m.id)}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div key={m.id} className="fade-in max-w-[90%] rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink">
                    <p className="break-words whitespace-pre-line">{m.text}</p>
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
              {pending && (
                <p className="fade-in inline-flex items-center gap-1 rounded-2xl bg-surface-muted px-4 py-3" aria-label="Ask TAMS is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </p>
              )}
            </>
          )}
          {mode === 'escalate' && <Escalate onCancel={() => setMode('chat')} onSent={(id) => { setSentId(id); setMode('sent') }} />}
          {mode === 'sent' && (
            <div className="rounded-2xl bg-ok-bg px-4 py-4 text-sm text-ok">
              <p className="font-semibold">Sent to staff · {sentId}</p>
              <p className="mt-1 text-ink">Status: Awaiting staff. Replies appear in Messages.</p>
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
        {unseen && mode === 'chat' && (
          <button onClick={() => scrollDown()} className="pop-in absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white shadow-pop">
            <ArrowDown className="size-3.5" aria-hidden /> New message
          </button>
        )}
      </div>

      {mode === 'chat' && (
        <div className="border-t border-line px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          {chips.length > 0 && (
            <div className="mb-2.5" role="group" aria-label="Suggested questions">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{chat.length ? 'You could also ask' : 'Try asking'}</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    disabled={pending}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-xs leading-snug font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
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
              enterKeyHint="send"
              placeholder="Ask a question"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none md:text-[15px]"
            />
            <Button type="submit" aria-label="Send question" disabled={!text.trim() || pending} className="h-11 w-11 px-0">
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
    ...mine.customRequests.filter((r) => r.status !== 'Closed').map((r) => ({ id: r.id, label: `${r.id} · ${requestDestination(data, r).name} custom trip` })),
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
        Staff will read your question and reply in Messages, usually within one business day. Check the summary below; you can edit it before sending.
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
