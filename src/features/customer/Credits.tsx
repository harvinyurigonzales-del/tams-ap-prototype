import { ExternalLink } from 'lucide-react'
import { photoCredits } from '../../seed/photos'
import { Card } from '../../ui/Card'
import { BackLink } from './Explore'

/** Attribution for every bundled photo: title, author, license and a link to the original on Wikimedia Commons. */
export function PhotoCredits() {
  const credits = photoCredits()
  return (
    <div>
      <BackLink label="Back" />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Photo credits</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        The destination and vehicle photos in this prototype come from Wikimedia Commons and are used under the licenses below. They show the real places, but not
        our own trips. Vehicle photos show the type of van, not the agency's own vehicles. Other pictures are illustrations made for the prototype.
      </p>
      <Card className="mt-5 divide-y divide-line">
        {credits.map((c) => (
          <div key={c.slug} className="flex items-center gap-4 p-4">
            <img src={c.thumb} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium text-ink">{c.title}</p>
              <p className="text-ink-2">
                {c.author} ·{' '}
                {c.licenseUrl ? (
                  <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}
              </p>
            </div>
            {c.source ? (
              <a href={c.source} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                Source <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">for {c.title}</span>
              </a>
            ) : (
              <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">To confirm</span>
            )}
          </div>
        ))}
        {credits.length === 0 && <p className="p-4 text-sm text-ink-2">No photos are bundled yet.</p>}
      </Card>
    </div>
  )
}
