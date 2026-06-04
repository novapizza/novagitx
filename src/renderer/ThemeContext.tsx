import { createContext, useContext } from 'react'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
