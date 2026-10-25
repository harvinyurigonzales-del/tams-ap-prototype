import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/arvo/400.css'
import '@fontsource/arvo/700.css'
import './styles.css'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
