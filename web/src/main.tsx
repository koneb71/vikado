import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import { useProjectStore } from '@/state/projectStore'
import { usePlaybackStore } from '@/state/playbackStore'
import { useUiStore } from '@/state/uiStore'
import './index.css'

if (import.meta.env.DEV) {
  // debugging hook for the console / e2e checks
  Object.assign(window, {
    __vikado: { useProjectStore, usePlaybackStore, useUiStore },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
    <Toaster position="bottom-center" theme="dark" />
  </StrictMode>,
)
