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
  removeRecent: (path: string) => void
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
      // Forget a repo from the recent list. If it's the currently-open repo,
      // also unload it back to the Welcome screen.
      removeRecent: (path) =>
        set((state) => ({
          recentRepos: state.recentRepos.filter((r) => r.path !== path),
          repoInfo: state.repoInfo?.path === path ? null : state.repoInfo,
        })),
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
