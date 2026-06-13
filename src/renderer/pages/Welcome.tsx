import { useState } from 'react'
import { FolderOpen, Clock, GitMerge, Plus, X } from 'lucide-react'
import { gitApi } from '@/api/git'
import { useRepoStore } from '@/store/repoStore'
import { CloneDialog } from '@/components/git/CloneDialog'

export default function Welcome() {
  const { setRepo, recentRepos, removeRecent } = useRepoStore()
  const [loading, setLoading] = useState(false)
  const [failedPath, setFailedPath] = useState<string | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)

  async function openRepo() {
    setLoading(true)
    try {
      const info = await gitApi.openRepo()
      if (info) setRepo(info)
    } finally {
      setLoading(false)
    }
  }

  async function initRepo() {
    setLoading(true)
    try {
      const info = await gitApi.initRepo()
      if (info) setRepo(info)
    } finally {
      setLoading(false)
    }
  }

  async function openPath(path: string) {
    setLoading(true)
    setFailedPath(null)
    try {
      const info = await gitApi.getRepoInfo(path)
      setRepo(info)
    } catch {
      setFailedPath(path)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-window">
      <div className="flex flex-col items-center gap-8 max-w-[520px] w-full px-8">
        <div className="flex flex-col items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="NovaGitX" className="size-20 rounded-2xl shadow-sm" />
          <h1 className="text-[22px] font-semibold text-foreground">NovaGitX</h1>
          <p className="text-[13px] text-muted-foreground text-center">
            A modern Git client for macOS and Windows. Open, clone, or create a repository.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openRepo}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <FolderOpen className="size-4" />
            Open…
          </button>
          <button
            onClick={() => setCloneOpen(true)}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-background text-foreground text-[13px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <GitMerge className="size-4" />
            Clone…
          </button>
          <button
            onClick={initRepo}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-background text-foreground text-[13px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Plus className="size-4" />
            New…
          </button>
        </div>

        {recentRepos.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
              <Clock className="size-3" />
              Recent
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {recentRepos.map((r, i) => (
                <div
                  key={r.path}
                  className={`group relative flex items-center hover:bg-muted/60 transition-colors ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <button
                    onClick={() => openPath(r.path)}
                    disabled={loading}
                    className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left disabled:opacity-50"
                  >
                    <div
                      className="size-7 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                      style={{ background: `hsl(${Math.abs(r.name.split('').reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 360} 65% 50%)` }}
                    >
                      {r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">{r.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">{r.path}</div>
                    </div>
                    {failedPath === r.path && (
                      <span className="text-[10.5px] text-destructive shrink-0">Not found</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeRecent(r.path)}
                    disabled={loading}
                    title="Remove from recent"
                    aria-label={`Remove ${r.name} from recent`}
                    className="mr-2 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-opacity shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} />
    </div>
  )
}
