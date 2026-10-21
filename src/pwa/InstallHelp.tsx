import { Download, Share, SquarePlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { useInstall } from './install'

/** "Install app" button plus a help sheet for browsers without an install prompt. */
export function InstallButton({ variant = 'secondary', full }: { variant?: 'primary' | 'secondary' | 'ghost'; full?: boolean }) {
  const { installed, canPrompt, ios, prompt } = useInstall()
  const [help, setHelp] = useState(false)
  if (installed) return <p className="text-sm text-ink-2">You are using the installed app.</p>
  return (
    <>
      <Button variant={variant} full={full} icon={<Download className="size-4" aria-hidden />} onClick={() => (canPrompt ? prompt() : setHelp(true))}>
        Install app
      </Button>
      <Dialog open={help} onClose={() => setHelp(false)} title="Install this prototype">
        {ios ? (
          <ol className="space-y-3">
            <li className="flex gap-3">
              <Share className="size-5 shrink-0 text-brand-600" aria-hidden /> In Safari, tap the Share button.
            </li>
            <li className="flex gap-3">
              <SquarePlus className="size-5 shrink-0 text-brand-600" aria-hidden /> Choose “Add to Home Screen”, then “Add”.
            </li>
          </ol>
        ) : (
          <div className="space-y-2">
            <p>This browser has not offered an install prompt.</p>
            <p>
              In Chrome or Edge, use the install icon in the address bar or the browser menu (“Install app” or “Add to Home screen”). Some browsers do
              not support installing web apps; the prototype still works in a normal tab.
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-3">After the first visit the app works offline. Demo data still resets when the app is closed or reloaded.</p>
      </Dialog>
    </>
  )
}
