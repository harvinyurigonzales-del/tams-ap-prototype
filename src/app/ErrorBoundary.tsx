import { Component, type ReactNode } from 'react'

/** Shows a recoverable message instead of a blank page if a screen fails to render. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('TAMS AP prototype error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-center">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="font-display text-xl font-bold text-brand-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-2">The prototype hit an error. Reloading starts the demo again from the sample data.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-muted p-3 text-left text-xs whitespace-pre-wrap text-ink-2">{this.state.error.message}</pre>
          <button onClick={() => location.assign('/')} className="mt-4 h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            Reload the demo
          </button>
        </div>
      </div>
    )
  }
}
