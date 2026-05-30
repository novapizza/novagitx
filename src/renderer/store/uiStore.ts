import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DiffViewMode = 'unified' | 'split'

interface UiStore {
  diffViewMode: DiffViewMode
  setDiffViewMode: (mode: DiffViewMode) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      diffViewMode: 'unified',
      setDiffViewMode: (mode) => set({ diffViewMode: mode }),
    }),
    { name: 'nova-git-x-ui' }
  )
)
