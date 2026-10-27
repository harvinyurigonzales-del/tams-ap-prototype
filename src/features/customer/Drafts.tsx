import { Bookmark, FileClock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QUESTIONS } from '../../domain/planner/engine'
import { DRAFT_KIND_LABEL, draftProblems, type DraftInput, type PlannerDraft } from '../../domain/drafts'
import { fmtStamp } from '../../lib/format'
import { useCustomer, type CustomForm, type RentalForm } from '../../state/customerStore'
import { usePlanner } from '../../state/planner'
import { useUi } from '../../state/ui'
import type { TripDraft } from '../../seed/types'
import { Badge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'

// Saved drafts in My Trips. A draft saved while logged out waits in this browser tab and joins the account on login.

/** "Save draft" for the custom-trip and van-rental forms. One saved draft per form; saving again updates it. */
export function SaveDraftButton({ kind, title, destination, payload }: Omit<DraftInput, 'key' | 'id'> & { kind: 'custom' | 'rental' }) {
  const save = useCustomer((s) => s.saveTripDraft)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      full
      icon={<Bookmark className="size-4" aria-hidden />}
      onClick={() => {
        const r = save({ kind, key: `${kind}-form`, title, destination, payload })
        if (!r.ok) return toast(r.error, 'error')
        if (r.value.guest) toast('Draft kept in this browser tab. Log in to keep it in My Trips.', 'info', { label: 'Log in', run: () => navigate('/app/login?next=%2Fapp%2Ftrips%3Ftab%3Ddrafts') })
        else toast('Draft saved. Find it under Drafts in My Trips.', 'success', { label: 'View drafts', run: () => navigate('/app/trips?tab=drafts') })
      }}
    >
      Save draft
    </Button>
  )
}

export function DraftList({ drafts }: { drafts: TripDraft[] }) {
  const data = useCustomer((s) => s.data)
  const { deleteTripDraft, saveDraft } = useCustomer()
  const resume = usePlanner((s) => s.resume)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [del, setDel] = useState<TripDraft | null>(null)
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={<FileClock className="size-6" aria-hidden />}
        title="No saved drafts"
        body="Save a plan from the Trip Planner, or a custom trip or van rental form, and finish it later here."
        action={<LinkButton to="/app/custom/new">Plan a custom trip</LinkButton>}
      />
    )
  }
  const open = (dr: TripDraft) => {
    const problems = draftProblems(data, dr)
    if (dr.kind === 'planner') {
      const p = dr.payload as PlannerDraft
      resume(dr.id, dr.key, p, problems.length ? `Check this before sending: ${problems.join(' ')}` : 'Draft opened. Pick up where you left off.')
      // Dates that have passed send the customer to the dates question first.
      if (problems.length && p.answers.dates.mode === 'exact') usePlanner.setState({ step: 'questions', q: QUESTIONS.indexOf('dates'), editing: !!p.plan })
      return navigate('/app/custom/new')
    }
    saveDraft(dr.kind, dr.payload as CustomForm | RentalForm)
    if (problems.length) toast(problems.join(' '), 'info')
    navigate(dr.kind === 'custom' ? '/app/custom/form' : '/app/rental/request')
  }
  return (
    <>
      <ul className="space-y-3">
        {drafts.map((dr) => {
          const problems = draftProblems(data, dr)
          return (
            <li key={dr.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{dr.title}</p>
                    <p className="text-sm text-ink-2">
                      {DRAFT_KIND_LABEL[dr.kind]} · Saved {fmtStamp(dr.updatedAt)}
                    </p>
                  </div>
                  <Badge tone={problems.length ? 'warn' : 'neutral'}>{problems.length ? 'Needs changes' : 'Draft'}</Badge>
                </div>
                {problems.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-warn">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => open(dr)}>
                    {problems.length ? 'Resume and fix' : 'Resume'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDel(dr)} aria-label={`Delete draft ${dr.title}`}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="Delete this draft?"
        body={del ? `${del.title} will be removed from your drafts. This cannot be undone.` : ''}
        confirmLabel="Delete draft"
        tone="danger"
        onConfirm={() => {
          const r = deleteTripDraft(del!.id)
          if (!r.ok) return r.error
          toast('Draft deleted.')
        }}
      />
    </>
  )
}
