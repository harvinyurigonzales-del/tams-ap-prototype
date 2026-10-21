import { ResetDemoButton } from '../../app/ResetDemo'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { InstallButton } from '../../pwa/InstallHelp'
import { DEMO_ADMIN } from '../../state/adminStore'
import { Card, Row, SectionTitle } from '../../ui/Card'
import { PageHeader } from './AdminRoutes'

export function Settings() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="About this demo" />
      <Card className="p-5">
        <SectionTitle>About this demo</SectionTitle>
        <Row label="Version">{__APP_VERSION__}</Row>
        <Row label="Build">
          {__COMMIT__} · {__BUILD_TIME__.slice(0, 10)}
        </Row>
        <Row label="Demo clock">{fmtDate(DEMO_TODAY, { weekday: true })}, 9:30 AM (Asia/Manila)</Row>
        <Row label="Demo staff account">{DEMO_ADMIN.email}</Row>
        <p className="mt-4 text-sm text-ink-2">
          This is a frontend-only prototype. There is no database, backend, payment gateway or messaging. Data lives in this browser tab and resets on
          reload or Reset Demo. The customer and admin demos keep separate copies of the same sample data.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ResetDemoButton variant="danger" />
          <InstallButton />
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle>Not included in the prototype</SectionTitle>
        <p className="text-sm text-ink-2">Tour package editing, staff accounts, maintenance records and the chatbot response editor are planned for the full system.</p>
      </Card>
    </div>
  )
}
