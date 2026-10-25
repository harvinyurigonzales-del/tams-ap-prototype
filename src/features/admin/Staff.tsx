import { Plus } from 'lucide-react'
import { useState } from 'react'
import { fmtDate } from '../../lib/format'
import { useAdmin, type StaffAccount, type StaffInput } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { Select, TextField } from '../../ui/Field'
import { initials, PageHeader } from './AdminRoutes'
import { FormDialog, MiniKpi, Table, td } from './common'

export function StaffAccounts() {
  const { accounts, userId, deleteStaff } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [edit, setEdit] = useState<StaffAccount | 'new' | null>(null)
  const [del, setDel] = useState<StaffAccount | null>(null)
  return (
    <div>
      <PageHeader
        title="Staff accounts"
        subtitle="Who can log in to the admin portal, and what they can do."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
            Add staff account
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <MiniKpi label="Admins" value={accounts.filter((a) => a.role === 'Admin' && a.active).length} />
        <MiniKpi label="Staff" value={accounts.filter((a) => a.role === 'Staff' && a.active).length} />
        <MiniKpi label="Deactivated" value={accounts.filter((a) => !a.active).length} />
      </div>
      <Card className="min-w-0 md:hidden">
        <ul className="divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700" aria-hidden>
                  {initials(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {a.name}
                    {a.id === userId && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-ink-2">{a.email}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={a.role === 'Admin' ? 'brand' : 'neutral'}>{a.role}</Badge>
                    <Badge tone={a.active ? 'ok' : 'neutral'}>{a.active ? 'Active' : 'Deactivated'}</Badge>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Actions a={a} onEdit={setEdit} onDelete={setDel} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="hidden min-w-0 md:block">
        <Table head={['Name', 'Email', 'Role', 'Status', 'Added', '']}>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td className={td}>
                <span className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700" aria-hidden>
                    {initials(a.name)}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">
                      {a.name}
                      {a.id === userId && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
                    </span>
                    <span className="block text-xs text-ink-2">{a.title}</span>
                  </span>
                </span>
              </td>
              <td className={td}>{a.email}</td>
              <td className={td}>
                <Badge tone={a.role === 'Admin' ? 'brand' : 'neutral'}>{a.role}</Badge>
              </td>
              <td className={td}>
                <Badge tone={a.active ? 'ok' : 'neutral'}>{a.active ? 'Active' : 'Deactivated'}</Badge>
              </td>
              <td className={td}>{fmtDate(a.createdAt, { year: true })}</td>
              <td className={`${td} text-right`}>
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <Actions a={a} onEdit={setEdit} onDelete={setDel} />
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="font-display text-base font-semibold text-ink">What each role can do</h2>
        <div className="mt-3 grid gap-4 text-sm text-ink-2 md:grid-cols-2">
          <div>
            <p className="font-semibold text-ink">Staff</p>
            <p>
              Bookings, payments, calendar and van assignment, customers, requests and proposals, inquiries, reviews, notifications. Vehicles, drivers and
              maintenance are view only.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Admin</p>
            <p>
              Everything staff can do, plus reports, tour packages, adding and editing fleet records, scheduling maintenance, staff accounts, chatbot answers
              and business settings.
            </p>
          </div>
        </div>
      </Card>
      <StaffForm key={edit === 'new' ? 'new' : (edit?.id ?? 'none')} target={edit} onClose={() => setEdit(null)} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Delete ${del?.name ?? ''}?`}
        body="They can no longer log in, and the account is removed from this list. To keep the account for later, deactivate it instead."
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={() => {
          const r = deleteStaff(del!.id)
          if (!r.ok) return r.error
          toast('Account deleted.')
        }}
      />
    </div>
  )
}

function StaffForm({ target, onClose }: { target: StaffAccount | 'new' | null; onClose: () => void }) {
  const { saveStaff, userId } = useAdmin()
  const toast = useUi((s) => s.toast)
  const a = target && target !== 'new' ? target : undefined
  const [f, setF] = useState<StaffInput>(() => ({
    name: a?.name ?? '',
    email: a?.email ?? '',
    role: a?.role ?? 'Staff',
    title: a?.title ?? '',
    mobile: a?.mobile ?? '',
    password: '',
  }))
  return (
    <FormDialog
      open={!!target}
      onClose={onClose}
      title={a ? `Edit ${a.name}` : 'Add a staff account'}
      saveLabel={a ? 'Save changes' : 'Add account'}
      onSave={() => {
        const r = saveStaff(a?.id ?? null, f)
        if (!r.ok) return r.error
        toast(a ? 'Account updated.' : `Account created for ${f.name.trim()}. Share the temporary password with them in person.`)
      }}
    >
      <TextField label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <TextField label="Work email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="09XX XXX XXXX" />
        <TextField label="Job title (optional)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <Select
        label="Role"
        value={f.role}
        disabled={a?.id === userId}
        hint={a?.id === userId ? 'You cannot change your own role.' : 'Admins can see reports and change settings, packages, staff accounts and fleet records.'}
        onChange={(e) => setF({ ...f, role: e.target.value as StaffInput['role'] })}
      >
        <option value="Staff">Staff</option>
        <option value="Admin">Admin</option>
      </Select>
      <TextField
        label={a ? 'New password (optional)' : 'Temporary password'}
        type="text"
        autoComplete="off"
        value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })}
        hint={a ? 'Leave blank to keep the current password.' : 'At least 8 characters. They can change it in Settings after logging in.'}
      />
    </FormDialog>
  )
}

function Actions({ a, onEdit: setEdit, onDelete: setDel }: { a: StaffAccount; onEdit: (a: StaffAccount) => void; onDelete: (a: StaffAccount) => void }) {
  const { userId, setStaffActive } = useAdmin()
  const toast = useUi((s) => s.toast)
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setEdit(a)} aria-label={`Edit ${a.name}`}>
        Edit
      </Button>
      {a.id !== userId && (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const r = setStaffActive(a.id, !a.active)
              toast(r.ok ? `${a.name} ${a.active ? 'deactivated' : 'reactivated'}.` : r.error, r.ok ? undefined : 'error')
            }}
            aria-label={`${a.active ? 'Deactivate' : 'Reactivate'} ${a.name}`}
          >
            {a.active ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDel(a)} aria-label={`Delete ${a.name}`}>
            Delete
          </Button>
        </>
      )}
    </>
  )
}
