import { MessageSquare, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtStamp } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import { StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from './AdminRoutes'
import { customerOf } from './common'

export function AdminInquiries() {
  const { data, replyInquiry, resolveInquiry } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [sel, setSel] = useState(data.inquiries[0]?.id ?? '')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const q = data.inquiries.find((x) => x.id === sel)

  return (
    <div>
      <PageHeader title="Inquiries" subtitle="Sample customer questions. Replies are recorded here only; nothing is sent." />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr_300px]">
        <Card className="h-fit">
          <ul className="divide-y divide-line">
            {data.inquiries.map((x) => {
              const last = x.messages.at(-1)!
              return (
                <li key={x.id}>
                  <button onClick={() => { setSel(x.id); setText(''); setError('') }} className={`w-full px-4 py-3 text-left ${sel === x.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{customerOf(data, x.customerId)?.name}</span>
                      <StatusBadge status={x.status} />
                    </span>
                    <span className="block text-sm text-ink-2">{x.subject}</span>
                    {x.relatedRef && <span className="block text-xs text-ink-3">About {x.relatedRef}</span>}
                    <span className="block truncate text-xs text-ink-3">{last.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="flex min-h-96 flex-col">
          {!q ? (
            <EmptyState icon={<MessageSquare className="size-6" aria-hidden />} title="Select an inquiry" />
          ) : (
            <>
              <div className="border-b border-line px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{q.subject}</p>
                  <StatusBadge status={q.status} />
                </div>
                <p className="text-xs text-ink-2">
                  {customerOf(data, q.customerId)?.name} · {q.id}
                  {q.relatedRef && (
                    <>
                      {' · about '}
                      {q.relatedRef.startsWith('BK-') ? (
                        <Link to={`/admin/bookings?id=${q.relatedRef}`} className="font-semibold text-brand-700 hover:underline">
                          {q.relatedRef}
                        </Link>
                      ) : (
                        <Link to={`/admin/requests?id=${q.relatedRef}`} className="font-semibold text-brand-700 hover:underline">
                          {q.relatedRef}
                        </Link>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {q.messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === 'staff' ? 'ml-auto bg-brand-600 text-white' : 'bg-surface-muted text-ink'}`}>
                    <p>{m.text}</p>
                    <p className={`mt-1 text-[11px] ${m.from === 'staff' ? 'text-brand-100' : 'text-ink-3'}`}>
                      {fmtStamp(m.at)}
                      {m.simulated && ' · recorded in demo, not sent'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-line p-4">
                <label htmlFor="reply" className="sr-only">
                  Reply
                </label>
                <textarea
                  id="reply"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder="Write a reply or insert a suggested one"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                {error && <p className="mt-1 text-xs font-medium text-bad">{error}</p>}
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {q.sampleReply && q.status === 'Awaiting staff' && (
                    <Button variant="secondary" onClick={() => setText(q.sampleReply!)}>
                      Insert scripted reply
                    </Button>
                  )}
                  {q.status !== 'Resolved' && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const r = resolveInquiry(q.id)
                        if (r.ok) toast('Inquiry marked as resolved.')
                      }}
                    >
                      Mark resolved
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const r = replyInquiry(q.id, text)
                      if (!r.ok) return setError(r.error)
                      setText('')
                      setError('')
                      toast('Reply recorded in the demo. No message was sent.', 'info')
                    }}
                  >
                    Record reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="h-fit p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-brand-600" aria-hidden /> Suggested replies
          </p>
          <p className="mb-3 text-xs text-ink-2">Pre-approved answers written by staff. No AI is used.</p>
          <ul className="space-y-2">
            {data.replies.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <p className="text-sm font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 line-clamp-3 text-xs text-ink-2">{r.text}</p>
                <Button size="sm" variant="ghost" className="mt-1 -ml-2" disabled={!q} onClick={() => setText(r.text)}>
                  Insert reply
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
