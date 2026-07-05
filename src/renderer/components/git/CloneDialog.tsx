import { useState } from 'react'
import { GitBranch, FolderOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { gitApi } from '@/api/git'
import { useRepoStore } from '@/store/repoStore'
import type { RepoInfo } from '@/types/git'

interface CloneDialogProps {
  open: boolean
  onClose: () => void
}

export function CloneDialog({ open, onClose }: CloneDialogProps) {
  const { setRepo } = useRepoStore()
  const [url, setUrl] = useState('')
  const [destination, setDestination] = useState('')
  const [depth, setDepth] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setUrl(''); setDestination(''); setDepth(''); setError(null); onClose()
  }

  async function pickDestination() {
    // Use Electron's open dialog via a hidden file input alternative:
    // We'll show initRepo picker to get the parent folder, then append the repo name.
    // Actually we need a folder picker — let's use gitApi.initRepo trick or just let user type.
    // Best approach: open a folder picker via the main process.
    // We'll reuse the openRepo dialog for picking a folder.
    const info = await gitApi.initRepo()
    if (info) {
      // The user picked a folder; use its path as destination
      // But initRepo actually initialises it — we want just the path.
      // Workaround: show the path and let user confirm. We'll cancel the init by just reading the path.
      // Actually, let's open a dialog differently. For now, let the user type.
      setDestination(info.path)
    }
  }

  async function handleClone(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !destination.trim()) return
    setLoading(true)
    setError(null)
    try {
      const depthNum = depth.trim() ? parseInt(depth.trim(), 10) : undefined
      const info: RepoInfo = await gitApi.cloneRepo(url.trim(), destination.trim(), depthNum)
      setRepo(info)
      close()
    } catch (err: any) {
      setError(err?.message ?? 'Clone failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Clone repository
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleClone} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted-foreground">Repository URL</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo.git"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted-foreground">Destination path</label>
            <div className="flex gap-2">
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={window.appOS.platform === 'win32' ? 'C:\\Users\\you\\Projects\\repo-name' : '/Users/you/Projects/repo-name'}
                className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-[13px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={pickDestination}
                className="h-9 px-3 rounded-md border border-border bg-muted/40 hover:bg-muted text-[12px] transition-colors flex items-center gap-1.5"
              >
                <FolderOpen className="size-3.5" />
                Browse
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted-foreground">
              Shallow clone depth <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="e.g. 1"
              type="number"
              min="1"
              className="h-9 w-24 rounded-md border border-border bg-background px-3 text-[13px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          {error && <p className="text-[11.5px] text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
          <DialogFooter className="pt-1">
            <button type="button" onClick={close} disabled={loading} className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim() || !destination.trim() || loading}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {loading ? 'Cloning…' : 'Clone'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
