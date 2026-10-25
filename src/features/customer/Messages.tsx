import { ChevronRight, FlaskConical, MessageCircle, MessageCircleQuestion } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STAFF_EMAIL } from '../../domain/assistant'
import { fmtStamp } from '../../lib/format'
import { useAssistant } from '../../state/assistant'
import { myRecords, useCustomer } from '../../state/customerStore'
import { usePresenter } from '../../state/presenter'
import { useUi } from '../../state/ui'
import type { Inquiry } from '../../seed/types'
import { StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { BackLink } from './Explore'

const refLink = (ref: string) => (ref.startsWith('BK-') ? `/app/trips/${ref}` : ref.startsWith('CR-') ? `/app/custom/${ref}` : `/app/rentals/${ref}`)

export function Messages() {
  const { data, customerId } = useCustomer()
  const openWith = useAssistant((s) => s.openWith)
  const list = myRecords(data, customerId)
    .inquiries.slice()
    .sort((a, b) => b.messages.at(-1)!.at.localeCompare(a.messages.at(-1)!.at))
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Messages</h1>
        <Button size="sm" variant="secondary" icon={<MessageCircleQuestion className="size-4" aria-hidden />} onClick={() => openWith()}>
          Ask TAMS
        </Button>
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="size-6" aria-hidden />}
            title="No messages yet"
            body="Questions you send to staff from Ask TAMS appear here with their replies."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((q) => (
              <li key={q.id}>
                <Link to={`/app/messages/${q.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-brand-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{q.subject}</span>
                      <StatusBadge status={q.status} />
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-2">{q.messages.at(-1)!.text}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {q.id}
                      {q.relatedRef && ` · about ${q.relatedRef}`} · {fmtStamp(q.messages.at(-1)!.at)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-ink-3">Staff replies appear here and in your notifications.</p>
    </div>
  )
}

export function MessageThread() {
  const { inquiryId } = useParams()
  const { data, customerId } = useCustomer()
  const q = myRecords(data, customerId).inquiries.find((x) => x.id === inquiryId)
  if (!q) return <EmptyState title="Conversation not found" action={<Link to="/app/messages">Messages</Link>} />
  return <Thread q={q} />
}

function Thread({ q }: { q: Inquiry }) {
  const { sendMessage, resolveInquiry, showSampleReply } = useCustomer()
  const presenter = usePresenter((s) => s.on)
  const toast = useUi((s) => s.toast)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/app/messages" label="Messages" />
      <Card className="flex flex-col">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg font-semibold text-ink">{q.subject}</h1>
            <StatusBadge status={q.status} />
          </div>
          <p className="text-xs text-ink-2">
            {q.id}
            {q.relatedRef && (
              <>
                {' · about '}
                <Link to={refLink(q.relatedRef)} className="font-semibold text-brand-700 hover:underline">
                  {q.relatedRef}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="space-y-3 px-5 py-4" aria-live="polite">
          {q.messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === 'customer' ? 'ml-auto bg-brand-600 text-white' : 'bg-surface-muted text-ink'}`}>
              {m.from === 'staff' && <p className="mb-0.5 text-xs font-semibold text-brand-700">TAMS AP staff</p>}
              <p className="whitespace-pre-line">{m.text}</p>
              <p className={`mt-1 text-[11px] ${m.from === 'customer' ? 'text-brand-100' : 'text-ink-3'}`}>
                {fmtStamp(m.at)}
              </p>
            </div>
          ))}
          {q.status === 'Awaiting staff' && <p className="text-center text-xs text-ink-2">Awaiting staff. Replies appear here, usually within one business day.</p>}
        </div>
        {q.status !== 'Resolved' ? (
          <div className="border-t border-line p-4">
            <label htmlFor="msg" className="sr-only">
              Your message
            </label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Write a message"
              className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            {error && <p className="mt-1 text-xs font-medium text-bad">{error}</p>}
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const r = resolveInquiry(q.id)
                  if (r.ok) toast('Marked as resolved.')
                }}
              >
                Mark as resolved
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const r = sendMessage(q.id, text)
                  if (!r.ok) return setError(r.error)
                  setText('')
                  setError('')
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-line px-5 py-4 text-sm text-ink-2">This conversation is resolved. Ask TAMS again any time if you need more help.</p>
        )}
      </Card>
      {presenter && q.status === 'Awaiting staff' && (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <FlaskConical className="size-4" aria-hidden /> Presenter shortcut
          </p>
          <p className="mt-1 text-xs text-ink-2">Shows the staff team’s prepared reply to this conversation.</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              const r = showSampleReply(q.id)
              if (!r.ok) toast(r.error, 'error')
            }}
          >
            Show staff reply
          </Button>
        </div>
      )}
      <p className="mt-3 text-center text-xs text-ink-3">You can also email us at {STAFF_EMAIL}.</p>
    </div>
  )
}
