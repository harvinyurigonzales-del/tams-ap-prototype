import { Lightbulb, MessageSquareReply, Star } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { needsReply as waiting, ratingOf, REPLY_WINDOW_DAYS } from '../../domain/reviews'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Review } from '../../seed/types'
import { LocalTag } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, SectionTitle } from '../../ui/Card'
import { TextArea } from '../../ui/Field'
import { Stars } from '../../ui/Stars'
import { PageHeader } from './AdminRoutes'
import { MiniKpi, Pager, paginate, SearchInput, Tabs } from './common'

type Tab = 'all' | 'reply' | 'tips'

/** Staff view of public reviews: see how each tour is rated, read suggestions, and reply. */
export function AdminReviews() {
  const data = useAdmin((s) => s.data)
  const [params, setParams] = useSearchParams()
  const tab = (['all', 'reply', 'tips'].includes(params.get('tab') ?? '') ? params.get('tab') : 'all') as Tab
  const tour = params.get('tour') ?? ''
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    setPage(1)
  }

  const all = [...data.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const overall = ratingOf(all)
  const needsReply = all.filter(waiting)
  const withTips = all.filter((r) => r.suggestion)
  const thisMonth = all.filter((r) => r.createdAt.startsWith(DEMO_TODAY.slice(0, 7))).length

  const term = q.trim().toLowerCase()
  const rows = (tab === 'reply' ? needsReply : tab === 'tips' ? withTips : all).filter(
    (r) => (!tour || r.serviceId === tour) && (!term || `${r.name} ${r.title} ${r.text} ${r.suggestion ?? ''}`.toLowerCase().includes(term)),
  )
  const pg = paginate(rows, page, 6)

  const byTour = data.services
    .filter((s) => s.type === 'tour')
    .map((s) => ({ s, r: ratingOf(all.filter((x) => x.serviceId === s.id)) }))
    .filter((x) => x.r.count > 0)
    .sort((a, b) => b.r.avg - a.r.avg || b.r.count - a.r.count)

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Public ratings from completed trips. Replies appear on the customer site under the review." />
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniKpi label="Average rating" value={`${overall.avg.toFixed(1)} / 5`} />
        <MiniKpi label="Reviews" value={overall.count} />
        <MiniKpi label={`New, no reply yet (${REPLY_WINDOW_DAYS} days)`} value={needsReply.length} />
        <MiniKpi label="New this month" value={thisMonth} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <Tabs
              value={tab}
              onChange={(v) => set('tab', v === 'all' ? '' : v)}
              items={[
                { key: 'all', label: 'All', count: all.length },
                { key: 'reply', label: 'Needs reply', count: needsReply.length },
                { key: 'tips', label: 'Suggestions', count: withTips.length },
              ]}
            />
            <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
              <select
                aria-label="Tour"
                value={tour}
                onChange={(e) => set('tour', e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
              >
                <option value="">All tours</option>
                {byTour.map(({ s }) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search reviews" />
            </div>
          </div>
          {pg.rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-2">{tab === 'reply' ? `Every review from the last ${REPLY_WINDOW_DAYS} days has a reply. Nice work.` : 'No reviews match these filters.'}</p>
          ) : (
            <ul className="divide-y divide-line">
              {pg.rows.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
            </ul>
          )}
          <Pager page={pg.page} pages={pg.pages} onPage={setPage} total={pg.total} from={pg.from} to={pg.to} />
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Rating by tour</SectionTitle>
            <ul className="space-y-2.5">
              {byTour.map(({ s, r }) => (
                <li key={s.id}>
                  <button
                    onClick={() => set('tour', tour === s.id ? '' : s.id)}
                    aria-pressed={tour === s.id}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${tour === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink tnum">
                      <Star className="size-3.5 text-star" fill="currentColor" strokeWidth={0} aria-hidden /> {r.avg.toFixed(1)}
                    </span>
                    <span className="w-16 text-right text-xs text-ink-3 tnum">{r.count} {r.count === 1 ? 'review' : 'reviews'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <SectionTitle>Star breakdown</SectionTitle>
            <ul className="space-y-2">
              {overall.dist.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-ink-2">{5 - i} {i === 4 ? 'star' : 'stars'}</span>
                  <span className="h-2 flex-1 rounded-full bg-surface-muted">
                    <span className="block h-2 rounded-full bg-brand-500" style={{ width: `${overall.count ? (c / overall.count) * 100 : 0}%` }} />
                  </span>
                  <span className="w-6 text-right font-semibold text-ink tnum">{c}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">Only customers with a completed trip can post, one review per booking.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ review: r }: { review: Review }) {
  const data = useAdmin((s) => s.data)
  const replyReview = useAdmin((s) => s.replyReview)
  const toast = useUi((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const s = data.services.find((x) => x.id === r.serviceId)

  const send = () => {
    const res = replyReview(r.id, text)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setText('')
    toast('Reply posted under the review.')
  }

  return (
    <li className="p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.rating} />
        <span className="sr-only">{r.rating} out of 5 stars</span>
        <p className="text-sm font-semibold text-ink">{r.title}</p>
        {r.origin === 'local' && <LocalTag />}
        <span className="ml-auto text-xs text-ink-3">{fmtDate(r.createdAt.slice(0, 10), { year: false })}</span>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {r.name}, {r.city} · {s?.name}
        {r.bookingId && ` · ${r.bookingId}`}
      </p>
      <p className="mt-2 text-sm text-ink">{r.text}</p>
      {r.suggestion && (
        <p className="mt-2 flex gap-2 rounded-lg bg-warn-bg/60 px-3 py-2 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <span>
            <span className="font-semibold text-ink">Suggestion: </span>
            <span className="text-ink-2">{r.suggestion}</span>
          </span>
        </p>
      )}
      {r.staffReply ? (
        <div className="mt-2 border-l-2 border-brand-600 pl-3 text-sm">
          <p className="text-xs font-semibold text-brand-700">Your reply · {fmtDate(r.staffReply.at.slice(0, 10), { year: false })}</p>
          <p className="text-ink-2">{r.staffReply.text}</p>
        </div>
      ) : open ? (
        <div className="mt-3 space-y-2">
          <TextArea
            label={`Reply to ${r.name}`}
            value={text}
            onChange={(e) => (setText(e.target.value), setError(undefined))}
            error={error}
            hint={`${text.length}/500. Shown publicly under the review.`}
            maxLength={500}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={send}>
              Post reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2 -ml-3" icon={<MessageSquareReply className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
          Reply
        </Button>
      )}
    </li>
  )
}
