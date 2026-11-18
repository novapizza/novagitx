import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DiffViewMode = 'unified' | 'split'

// 'grouped' nests branches into collapsible folders by their '/'-delimited name
// (e.g. feat/foo, feat/bar → a "feat" folder). 'flat' lists full names as-is.
export type BranchView = 'grouped' | 'flat'

interface UiStore {
  diffViewMode: DiffViewMode
  setDiffViewMode: (mode: DiffViewMode) => void
  branchView: BranchView
  setBranchView: (view: BranchView) => void
  /** Width (px) of the changed-files list in the commit details panel. */
  detailsFileListWidth: number
  setDetailsFileListWidth: (width: number) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      diffViewMode: 'unified',
      setDiffViewMode: (mode) => set({ diffViewMode: mode }),
      branchView: 'grouped',
      setBranchView: (view) => set({ branchView: view }),
      detailsFileListWidth: 280,
      setDetailsFileListWidth: (width) => set({ detailsFileListWidth: width }),
    }),
    { name: 'nova-git-x-ui' }
  )
)
