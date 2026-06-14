import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MergeMethod } from '@/types/github'

/** GitHub panel currently shown in the side area, if any. */
export type GitHubPanel = 'pull-requests' | 'issues' | 'actions' | null

interface GitHubStore {
  // Non-secret client UI state only. Account list + active account live in the
  // main process (safeStorage) and are read via useGitHubAccounts — never here.
  panel: GitHubPanel
  lastMergeMethod: MergeMethod
  showCiBadges: boolean
  setPanel: (panel: GitHubPanel) => void
  togglePanel: (panel: Exclude<GitHubPanel, null>) => void
  setLastMergeMethod: (method: MergeMethod) => void
  setShowCiBadges: (show: boolean) => void
}

export const useGitHubStore = create<GitHubStore>()(
  persist(
    (set) => ({
      panel: null,
      lastMergeMethod: 'merge',
      showCiBadges: true,
      setPanel: (panel) => set({ panel }),
      togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
      setLastMergeMethod: (lastMergeMethod) => set({ lastMergeMethod }),
      setShowCiBadges: (showCiBadges) => set({ showCiBadges }),
    }),
    {
      name: 'nova-git-x-github',
      partialize: (s) => ({ lastMergeMethod: s.lastMergeMethod, showCiBadges: s.showCiBadges }),
    },
  ),
)
