import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RepoInfo } from '@/types/git'

interface RecentRepo {
  path: string
  name: string
}

interface RepoStore {
  repoInfo: RepoInfo | null
  recentRepos: RecentRepo[]
  setRepo: (info: RepoInfo) => void
  clearRepo: () => void
}

export const useRepoStore = create<RepoStore>()(
  persist(
    (set) => ({
      repoInfo: null,
      recentRepos: [],
      setRepo: (info) =>
        set((state) => ({
          repoInfo: info,
          recentRepos: [
            { path: info.path, name: info.name },
            ...state.recentRepos.filter((r) => r.path !== info.path),
          ].slice(0, 10),
        })),
      clearRepo: () => set({ repoInfo: null }),
    }),
    {
      name: 'nova-git-x-repo',
      // Persist the repo identity (so it reopens on launch) but NOT the volatile HEAD —
      // currentBranch/isDetachedHead are re-derived from the live refs query on open.
      // Restoring a stale branch from the last session would paint the wrong branch for a
      // moment, then visibly "switch" once refs load.
      partialize: (state) => ({
        recentRepos: state.recentRepos,
        repoInfo: state.repoInfo
          ? { ...state.repoInfo, currentBranch: null, isDetachedHead: false }
          : null,
      }),
    }
  )
)
