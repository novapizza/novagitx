import { useState } from 'react'
import { Github, Search, Lock, Star, GitFork, Loader2, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { gitApi } from '@/api/git'
import { useMyRepos, useGitHubAccounts } from '@/hooks/useGitHub'
import { useRepoStore } from '@/store/repoStore'
import { toast } from '@/hooks/use-toast'
import { describeGitError } from '@/lib/gitError'
import type { GhRepo } from '@/types/github'

interface Props {
  open: boolean
  onClose: () => void
  onRequireSignIn: () => void
}

/** Browse the signed-in user's repos and clone one into a chosen folder. */
export function GitHubReposDialog({ open, onClose, onRequireSignIn }: Props) {
  const { data: accounts } = useGitHubAccounts()
  const signedIn = (accounts?.accounts.length ?? 0) > 0
  const repos = useMyRepos(open && signedIn)
  const { setRepo } = useRepoStore()
  const [query, setQuery] = useState('')
  const [useSsh, setUseSsh] = useState(false)
  const [cloning, setCloning] = useState<number | null>(null)

  const filtered = (repos.data ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase()),
  )

  async function clone(repo: GhRepo) {
    const parent = await gitApi.openDirDialog()
    if (!parent) return
    const destination = `${parent}/${repo.name}`
    setCloning(repo.id)
    try {
      const info = await gitApi.cloneRepo(useSsh ? repo.sshUrl : repo.cloneUrl, destination)
      setRepo(info)
      toast({ title: 'Cloned', description: repo.fullName })
      onClose()
    } catch (err) {
      const { title, description } = describeGitError(err)
      toast({ variant: 'destructive', title, description })
    } finally {
      setCloning(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[560px] h-[560px] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2"><Github className="size-4" /> GitHub repositories</DialogTitle>
        </DialogHeader>

        {!signedIn ? (
          <div className="flex flex-col items-center justify-center gap-3 flex-1 text-center px-6">
            <Github className="size-8 opacity-40" />
            <p className="text-[12.5px] text-muted-foreground">Sign in to GitHub to browse and clone your repositories.</p>
            <button onClick={() => { onClose(); onRequireSignIn() }}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors">
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 h-8 rounded-md border border-border bg-background px-2.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter repositories…"
                  className="flex-1 bg-transparent text-[12.5px] outline-none"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground whitespace-nowrap">
                <input type="checkbox" checked={useSsh} onChange={(e) => setUseSsh(e.target.checked)} />
                SSH
              </label>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac">
              {repos.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading repositories…
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-[12px] text-muted-foreground py-10">No repositories match.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {filtered.map((r) => (
                    <li key={r.id} className="px-4 py-2.5 flex items-center gap-3 group">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium truncate flex items-center gap-1.5">
                          {r.fullName}
                          {r.private && <Lock className="size-3 text-muted-foreground" />}
                          {r.fork && <GitFork className="size-3 text-muted-foreground" />}
                        </div>
                        {r.description && (
                          <div className="text-[11px] text-muted-foreground truncate">{r.description}</div>
                        )}
                        <div className="text-[10.5px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {r.language && <span>{r.language}</span>}
                          {r.stars > 0 && <span className="flex items-center gap-0.5"><Star className="size-3" />{r.stars}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => clone(r)}
                        disabled={cloning !== null}
                        className="h-7 px-2.5 rounded-md text-[11.5px] border border-border hover:bg-muted transition-colors disabled:opacity-40 flex items-center gap-1.5">
                        {cloning === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                        Clone
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
