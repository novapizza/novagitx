import { createContext, useContext, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRepoStore } from '@/store/repoStore'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'
import { installGlobalShortcuts } from '@/hooks/useShortcut'
import Welcome from './pages/Welcome'
import Repository from './pages/Repository'

const queryClient = new QueryClient({
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

interface ThemeContextValue {
  mode: ThemeMode
  isDark: boolean
  setMode: (m: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
})

export function useThemeContext() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

function AppContent() {
  const { repoInfo, setRepo } = useRepoStore()
  useEffect(() => window.appOS.onRepoOpenedFromOS(setRepo), [setRepo])
  useEffect(() => installGlobalShortcuts(), [])
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
