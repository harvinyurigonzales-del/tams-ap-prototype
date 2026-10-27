import { ImagePlus, X } from 'lucide-react'
import { useId, useState } from 'react'
import type { ImageRef } from '../../seed/types'
import { Picture } from '../../ui/Picture'

// Photo choice for packages and vans. Photos come from the bundled library, or from an upload that is shrunk in the
// browser first: every record is kept in this browser's storage, which only holds a few megabytes in total.

const MAX_SIDE = 1200
const MAX_BYTES = 220_000

/** Reads an image file and returns a JPEG data URL small enough to keep in local storage. */
export async function shrinkImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).')
  if (file.size > 15_000_000) throw new Error('That file is over 15 MB. Choose a smaller photo.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('This image could not be read. Try another file.'))
      i.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.78, 0.66, 0.55, 0.45]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length * 0.75 <= MAX_BYTES) return out
    }
    throw new Error('This photo is too detailed to store here. Try a smaller or simpler image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PhotoPicker({ label, value, fallback, gallery, onChange, alt }: { label: string; value?: ImageRef; fallback?: ImageRef; gallery: ImageRef[]; onChange: (img: ImageRef | undefined) => void; alt: string }) {
  const id = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const shown = value ?? fallback
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-40 shrink-0 overflow-hidden rounded-xl ring-1 ring-line">
          {shown ? <Picture image={shown} label={false} sizes="160px" className="aspect-[4/3]" /> : <div className="grid aspect-[4/3] place-items-center bg-surface-muted text-xs text-ink-3">No photo</div>}
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-xs text-ink-2">
          <p>{value ? (value.kind === 'supplied' ? 'Uploaded photo.' : 'Chosen from the photo library.') : fallback ? 'Using the default photo.' : 'No photo yet.'}</p>
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-100">
              <ImagePlus className="size-4" aria-hidden /> {busy ? 'Preparing…' : 'Upload photo'}
              <input
                id={id}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  setError('')
                  setBusy(true)
                  try {
                    onChange({ src: await shrinkImage(f), alt, kind: 'supplied' })
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              />
            </label>
            {value && (
              <button type="button" onClick={() => onChange(undefined)} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-surface-muted">
                <X className="size-4" aria-hidden /> Use default
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="font-medium text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
      {gallery.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Choose from the photo library</summary>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {gallery.map((g) => (
              <li key={g.src}>
                <button type="button" onClick={() => onChange({ ...g, alt })} aria-label={`Use photo: ${g.alt}`} aria-pressed={value?.src === g.src} className={`block w-full overflow-hidden rounded-lg ring-2 ${value?.src === g.src ? 'ring-brand-600' : 'ring-transparent hover:ring-brand-300'}`}>
                  <Picture image={g} label={false} sizes="120px" className="aspect-[4/3]" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </fieldset>
  )
}
