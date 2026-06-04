import { useEffect } from 'react'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRepoStore } from '@/store/repoStore'
import { ThemeProvider } from '@/ThemeContext'
import { useAutoUpdate } from '@/hooks/useAutoUpdate'
import { installGlobalShortcuts } from '@/hooks/useShortcut'
import { toast } from '@/hooks/use-toast'
import { describeGitError } from '@/lib/gitError'
import Welcome from './pages/Welcome'
import Repository from './pages/Repository'

const queryClient = new QueryClient({
  // Every git mutation flows through GitModule, which throws an Error carrying git's
  // stderr when a command exits non-zero (permission denied, merge conflicts, protected
  // branch, etc.). Most call sites fire-and-forget with `.mutate()` and no onError, so
  // those failures used to vanish silently — the dialog just closed. Surface them here
  // once, globally, so any failed operation always reports back to the user. A mutation
  // that wants its own inline error UI can still read `.error`; this is the safety net.
  mutationCache: new MutationCache({
    onError: (error) => {
      const { title, description } = describeGitError(error)
      toast({ variant: 'destructive', title, description })
    },
  }),
  defaultOptions: {
    queries: {
      // Desktop git GUI: status (and other live views) already poll on an interval and
      // every mutation invalidates the affected keys, so refetching on every window focus
      // just causes a refetch storm on launch/refocus — refs+log+status all re-fire at
      // once, re-rendering the view and flashing the graph. Disable it.
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
})

function AppContent() {
  const { repoInfo, setRepo } = useRepoStore()
  useEffect(() => window.appOS.onRepoOpenedFromOS(setRepo), [setRepo])
  useEffect(() => installGlobalShortcuts(), [])
  useAutoUpdate()
  return repoInfo ? <Repository /> : <Welcome />
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
)

export default App
