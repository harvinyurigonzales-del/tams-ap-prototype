import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resetAll } from '../state/demo'
import { useUi } from '../state/ui'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/Dialog'

export function ResetDemoButton({ variant = 'secondary', full }: { variant?: 'secondary' | 'ghost' | 'danger'; full?: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <>
      <Button variant={variant} full={full} icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the demo?"
        body="Both the customer and admin demos go back to the sample data, and both are logged out. Anything created in this session is removed."
        confirmLabel="Reset demo"
        tone="danger"
        onConfirm={() => {
          // Leave the guarded pages first, so the reset logout does not bounce to a login screen.
          // The start screen performs the reset once it is showing, so the logout cannot bounce a guarded page to a login screen.
          navigate('/', { state: { reset: true } })
        }}
      />
    </>
  )
}

/** Runs a reset requested by ResetDemoButton after the start screen has mounted. */
export function useResetOnArrival() {
  const location = useLocation()
  const navigate = useNavigate()
  const requested = (location.state as { reset?: boolean } | null)?.reset
  useEffect(() => {
    if (!requested) return
    resetAll()
    useUi.getState().toast('Demo reset to the sample data.')
    navigate('/', { replace: true, state: null })
  }, [requested, navigate])
}
