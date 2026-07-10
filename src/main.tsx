import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/sentry'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>문제가 발생했습니다. 새로고침 해주세요.</p>}>
      <TooltipProvider>
        <App />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
