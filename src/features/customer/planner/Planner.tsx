import { ArrowRight, Check, Clock, Map, PencilLine, RotateCcw, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCustomer } from '../../../state/customerStore'
import { usePlanner } from '../../../state/planner'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Picture } from '../../../ui/Picture'
import { PlannerLabel } from './bits'
import { Questions } from './Questions'
import { Result } from './Result'
import { Review } from './Review'

/** /app/custom/new: the guided AI planner. The regular request form lives at /app/custom/form. */
export function Planner() {
  const [params] = useSearchParams()
  const step = usePlanner((s) => s.step)
  const start = usePlanner((s) => s.start)
  const destination = params.get('destination')

  useEffect(() => {
    start(destination)
  }, [start, destination])

  // Each step starts at the top of the page, like a page change.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  return (
    <div key={step} className="page-in">
      {step === 'intro' && <Intro />}
      {step === 'questions' && <Questions />}
      {step === 'planning' && <Planning />}
      {step === 'result' && <Result />}
      {step === 'review' && <Review />}
    </div>
  )
}

export const formLink = (destination?: string | null) => `/app/custom/form${destination ? `?destination=${destination}` : ''}`

function Intro() {
  const data = useCustomer((s) => s.data)
  const { go, startSample, plan, clear, openedFor, answers } = usePlanner()
  const photo = (id: string) => data.destinations.find((d) => d.id === id)?.image
  const opened = openedFor ? data.destinations.find((d) => d.id === openedFor) : undefined
  const resume = plan ? data.destinations.find((d) => d.id === plan.destinationId)?.name ?? plan.destinationName : null
  const pics = [opened?.image ?? photo('DST-LAUNION'), photo('DST-BAGUIO'), photo('DST-VIGAN')].filter(Boolean)

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      <div className="max-w-xl">
        <PlannerLabel />
        <h1 className="type-head mt-4 text-[38px] leading-[1.05] text-charcoal md:text-[54px]">Anong alis ang nasa isip mo?</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">Tell us a little about your trip. We’ll put together a starting plan you can make your own.</p>
        {opened && <p className="mt-3 text-sm font-medium text-brand-700">Planning a trip to {opened.name}. You can change this in the first question.</p>}
        <p className="mt-5 flex items-center gap-2 text-sm text-ink-2">
          <Clock className="size-4 text-brand-600" aria-hidden /> About 2 minutes · 8 short questions, the last one optional
        </p>

        {resume ? (
          <Card className="mt-6 border-brand-200 bg-brand-50/60 p-4">
            <p className="text-sm font-semibold text-ink">You have a plan in progress for {resume}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => go('result')} icon={<ArrowRight className="size-4" aria-hidden />}>Continue your plan</Button>
              <Button variant="secondary" onClick={() => clear()} icon={<RotateCcw className="size-4" aria-hidden />}>Start over</Button>
            </div>
          </Card>
        ) : (
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => go('questions', 0)} icon={<Sparkles className="size-5" aria-hidden />}>Start planning</Button>
            <Button size="lg" variant="secondary" onClick={startSample}>Try a sample trip</Button>
          </div>
        )}
        <p className="mt-5 text-sm text-ink-2">
          <Link to={formLink(openedFor ?? (answers.destination.mode === 'chosen' ? answers.destination.id : null))} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Prefer to fill out the details yourself?
          </Link>{' '}
          Use the regular request form.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: <PencilLine className="size-4" aria-hidden />, t: 'Answer a few questions', b: 'Where, who, when, budget and pace.' },
            { icon: <Map className="size-4" aria-hidden />, t: 'Get a suggested plan', b: 'Stops, timing and a cost estimate.' },
            { icon: <Send className="size-4" aria-hidden />, t: 'Edit and send', b: 'Staff review it and send a proposal.' },
          ].map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-line bg-surface p-3.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-brand-700">
                <span className="grid size-6 place-items-center rounded-full bg-brand-50">{s.icon}</span> Step {i + 1}
              </span>
              <span className="mt-2 block text-sm font-semibold text-ink">{s.t}</span>
              <span className="block text-xs text-ink-2">{s.b}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-3">You can plan without an account. We only ask you to log in when you send the request. Nothing is booked or charged until you accept a proposal.</p>
      </div>

      <div className="relative hidden h-[520px] lg:block" aria-hidden>
        {pics[0] && <Picture image={pics[0]} eager sizes="30vw" className="absolute top-0 right-0 h-[360px] w-[78%] rounded-[28px] shadow-pop" label={false} />}
        {pics[1] && <Picture image={pics[1]} sizes="20vw" className="absolute bottom-0 left-0 h-[230px] w-[48%] rounded-[24px] shadow-pop ring-4 ring-bg" label={false} />}
        {pics[2] && <Picture image={pics[2]} sizes="20vw" className="absolute right-[6%] bottom-6 h-[170px] w-[36%] rounded-[22px] shadow-pop ring-4 ring-bg" label={false} />}
        <div className="absolute top-[300px] left-[6%] w-[260px] rounded-2xl border border-line bg-surface/95 p-4 shadow-pop backdrop-blur">
          <p className="text-[11px] font-semibold tracking-wide text-sili uppercase">Example plan</p>
          <p className="mt-1 font-display text-lg font-bold text-charcoal">La Union, 2 days</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            <li className="flex gap-2"><span className="tnum w-14 text-ink-3">4:40 AM</span> Pickup in Malolos</li>
            <li className="flex gap-2"><span className="tnum w-14 text-ink-3">10:20 AM</span> Grape farm in Bauang</li>
            <li className="flex gap-2"><span className="tnum w-14 text-ink-3">5:00 PM</span> Sunset at the beach</li>
          </ul>
        </div>
      </div>
      {pics[0] && (
        <div className="relative -mx-4 h-44 overflow-hidden sm:mx-0 sm:rounded-3xl lg:hidden" aria-hidden>
          <Picture image={pics[0]} sizes="100vw" className="absolute inset-0" label={false} />
        </div>
      )}
    </div>
  )
}

const STAGES = ['Matching destinations to your preferences…', 'Arranging stops and travel time…', 'Preparing your suggested itinerary…']
const STAGE_MS = 900

function Planning() {
  const data = useCustomer((s) => s.data)
  const { generate, go } = usePlanner()
  const [stage, setStage] = useState(0)
  const [error, setError] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (error) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? 450 : STAGE_MS
    const timers = STAGES.map((_, i) => window.setTimeout(() => setStage(i + 1), ms * (i + 1)))
    const finish = window.setTimeout(() => {
      if (done.current) return
      done.current = true
      try {
        generate(data.destinations)
        go('result')
      } catch {
        done.current = false
        setError(true)
      }
    }, ms * STAGES.length + 250)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finish)
    }
  }, [data.destinations, generate, go, error])

  if (error)
    return (
      <Card className="mx-auto max-w-lg p-6 text-center" role="alert">
        <TriangleAlert className="mx-auto size-8 text-warn" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-bold text-charcoal">We couldn’t put the plan together</h1>
        <p className="mt-2 text-sm text-ink-2">Your answers are saved. Try again, or go back and check them.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => (setStage(0), setError(false))}>Try again</Button>
          <Button variant="secondary" onClick={() => go('questions')}>Back to your answers</Button>
        </div>
      </Card>
    )

  return (
    <div className="mx-auto max-w-xl py-10 text-center md:py-16" role="status" aria-live="polite">
      <PlannerLabel />
      <h1 className="type-head mt-4 text-[30px] text-charcoal md:text-[38px]">Planning your trip</h1>
      <RoadAnimation />
      <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left">
        {STAGES.map((s, i) => {
          const state = stage > i ? 'done' : stage === i ? 'now' : 'next'
          return (
            <li key={s} className={`flex items-center gap-3 text-[15px] transition-colors ${state === 'next' ? 'text-ink-3' : 'text-ink'}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${state === 'done' ? 'bg-palay text-white' : state === 'now' ? 'bg-brand-600 text-white' : 'bg-surface-muted'}`}>
                {state === 'done' ? <Check className="size-3.5" aria-hidden /> : state === 'now' ? <span className="size-2 animate-pulse rounded-full bg-white" /> : null}
              </span>
              <span className={state === 'now' ? 'font-semibold' : ''}>{s}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-6 text-xs text-ink-3">Hotels, timing and prices are confirmed by our staff before anything is booked.</p>
    </div>
  )
}

/** A van driving along a winding road to a pin. Static when reduced motion is on. */
function RoadAnimation() {
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="relative mx-auto mt-6 h-28 w-full max-w-md" aria-hidden>
      <svg viewBox="0 0 400 110" className="absolute inset-0 size-full">
        <path id="planner-road" d="M10 85 C 90 85, 110 30, 190 40 S 300 95, 360 45" fill="none" stroke="var(--color-sand-2)" strokeWidth="14" strokeLinecap="round" />
        <path d="M10 85 C 90 85, 110 30, 190 40 S 300 95, 360 45" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 10" strokeLinecap="round" />
        <g transform="translate(360 45)">
          <path d="M0 -26 c-8 0 -14 6 -14 14 c0 10 14 22 14 22 s14 -12 14 -22 c0 -8 -6 -14 -14 -14z" fill="var(--color-sili)" />
          <circle cx="0" cy="-12" r="5" fill="white" />
        </g>
        <g transform={reduced ? 'translate(190 40)' : undefined}>
          {!reduced && (
            <animateMotion dur="2.8s" fill="freeze" rotate="auto" keyPoints="0;0.92" keyTimes="0;1" calcMode="spline" keySplines="0.45 0.05 0.4 1">
              <mpath href="#planner-road" />
            </animateMotion>
          )}
          <rect x="-16" y="-15" width="32" height="16" rx="5" fill="var(--color-brand-600)" />
          <rect x="4" y="-8" width="9" height="6" rx="1.5" fill="var(--color-brand-100)" />
          <rect x="-12" y="-8" width="12" height="6" rx="1.5" fill="var(--color-brand-100)" />
          <circle cx="-9" cy="6" r="3.5" fill="var(--color-charcoal)" />
          <circle cx="9" cy="6" r="3.5" fill="var(--color-charcoal)" />
        </g>
      </svg>
    </div>
  )
}
