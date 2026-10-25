import { Bot, Plus } from 'lucide-react'
import { useState } from 'react'
import { matchPreset, respond, type ChatPreset } from '../../domain/assistant'
import { useAdmin } from '../../state/adminStore'
import { useChatbot } from '../../state/chatbot'
import { useUi } from '../../state/ui'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { TextArea, TextField } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { FormDialog, linesOf } from './common'

export function ManageChatbot() {
  const { presets, setActive } = useChatbot()
  const toast = useUi((s) => s.toast)
  const [edit, setEdit] = useState<ChatPreset | 'new' | null>(null)
  const [del, setDel] = useState<ChatPreset | null>(null)
  return (
    <div>
      <PageHeader
        title="Manage chatbot"
        subtitle="Preset answers for Ask TAMS. When a customer’s question contains a trigger phrase, Ask TAMS replies with your answer."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
            Add preset answer
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          {presets.length === 0 ? (
            <EmptyState icon={<Bot className="size-6" aria-hidden />} title="No preset answers" body="Ask TAMS uses its built-in answers about trips, prices and payments." />
          ) : (
            <ul className="divide-y divide-line">
              {presets.map((p) => (
                <li key={p.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{p.title}</p>
                    <Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'On' : 'Off'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{p.answer}</p>
                  {p.link && <p className="mt-1 text-xs text-ink-3">Link: {p.link.label} ({p.link.to})</p>}
                  <p className="mt-2 flex flex-wrap gap-1">
                    {p.keywords.map((k) => (
                      <span key={k} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-2">
                        {k}
                      </span>
                    ))}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEdit(p)} aria-label={`Edit ${p.title}`}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActive(p.id, !p.active)
                        toast(p.active ? `“${p.title}” turned off.` : `“${p.title}” turned on.`)
                      }}
                      aria-label={`${p.active ? 'Turn off' : 'Turn on'} ${p.title}`}
                    >
                      {p.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDel(p)} aria-label={`Delete ${p.title}`}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <TryIt presets={presets} />
      </div>
      <PresetForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Delete “${del?.title ?? ''}”?`}
        body="Ask TAMS goes back to its built-in answer for these questions."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          useChatbot.getState().remove(del!.id)
          toast('Preset answer deleted.')
        }}
      />
    </div>
  )
}

/** Shows which answer a customer would get, so admins can check trigger phrases before relying on them. */
function TryIt({ presets }: { presets: ChatPreset[] }) {
  const data = useAdmin((s) => s.data)
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const hit = asked ? matchPreset(presets, asked) : undefined
  const reply = asked ? respond(data, { question: asked, customerId: null }, undefined, presets) : undefined
  return (
    <Card className="h-fit p-5">
      <h2 className="font-display text-base font-semibold text-ink">Try a question</h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setAsked(q.trim())
        }}
      >
        <TextField label="Customer question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are your office hours?" />
        <Button type="submit" variant="secondary" disabled={!q.trim()}>
          Check answer
        </Button>
      </form>
      {reply && (
        <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm" aria-live="polite">
          <p className="text-xs font-semibold text-ink-3 uppercase">{hit ? `Preset: ${hit.title}` : 'Built-in answer'}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{reply.text}</p>
        </div>
      )}
    </Card>
  )
}

function PresetForm({ target, onClose }: { target: ChatPreset | 'new' | null; onClose: () => void }) {
  const save = useChatbot((s) => s.save)
  const toast = useUi((s) => s.toast)
  const p = target && target !== 'new' ? target : undefined
  const [f, setF] = useState(() => ({ title: p?.title ?? '', keywords: p?.keywords.join('\n') ?? '', answer: p?.answer ?? '', linkLabel: p?.link?.label ?? '', linkTo: p?.link?.to ?? '' }))
  return (
    <FormDialog
      open={!!target}
      wide
      onClose={onClose}
      title={p ? `Edit “${p.title}”` : 'Add a preset answer'}
      saveLabel={p ? 'Save changes' : 'Add answer'}
      onSave={() => {
        const r = save(p?.id ?? null, {
          title: f.title,
          keywords: linesOf(f.keywords),
          answer: f.answer,
          link: f.linkLabel.trim() || f.linkTo.trim() ? { label: f.linkLabel.trim(), to: f.linkTo.trim() } : undefined,
        })
        if (!r.ok) return r.error
        toast(p ? 'Preset answer saved. Ask TAMS uses it right away.' : 'Preset answer added. Ask TAMS uses it right away.')
      }}
    >
      <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Office hours" />
      <TextArea
        label="Trigger phrases, one per line"
        rows={4}
        value={f.keywords}
        onChange={(e) => setF({ ...f, keywords: e.target.value })}
        hint="If a customer’s question contains any of these phrases, this answer is used."
      />
      <TextArea label="Answer" rows={4} maxLength={600} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} hint={`${f.answer.length}/600 characters. Plain text only.`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Link label (optional)" value={f.linkLabel} onChange={(e) => setF({ ...f, linkLabel: e.target.value })} placeholder="Message staff" />
        <TextField label="Link to page (optional)" value={f.linkTo} onChange={(e) => setF({ ...f, linkTo: e.target.value })} placeholder="/app/messages" />
      </div>
    </FormDialog>
  )
}
