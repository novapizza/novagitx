import { useState } from 'react'
import { HardDrive, Plus, Trash2, FileBox } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useLfsStatus, useLfsMutations } from '@/hooks/useRepo'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
}

export function LfsDialog({ open, onOpenChange, repoPath }: Props) {
  const { data: status, isPending } = useLfsStatus(repoPath, open)
  const { install, track, untrack } = useLfsMutations(repoPath)
  const [pattern, setPattern] = useState('')
  const [error, setError] = useState<string | null>(null)

  const busy = install.isPending || track.isPending || untrack.isPending

  async function run<T>(fn: () => Promise<T>) {
    setError(null)
    try { await fn() } catch (e: any) { setError(e?.message ?? String(e)) }
  }

  async function handleTrack() {
    const p = pattern.trim()
    if (!p) return
    await run(async () => { await track.mutateAsync(p); setPattern('') })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="size-4" />Git LFS</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          {isPending && <p className="text-[12px] text-muted-foreground">Checking LFS status…</p>}

          {status && !status.installed && (
            <div className="border border-border rounded-md p-3">
              <p className="text-[12px] text-destructive">git-lfs is not installed on this machine.</p>
              <p className="text-[11.5px] text-muted-foreground mt-1">
                Install it from git-lfs.com (or via Homebrew: <span className="font-mono">brew install git-lfs</span>),
                then reopen this dialog.
              </p>
            </div>
          )}

          {status?.installed && (
            <>
              {/* Tracked patterns */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Tracked patterns</div>
                <div className="border border-border rounded-md overflow-hidden">
                  {status.patterns.length === 0 && (
                    <div className="px-3 py-3 text-[12px] text-muted-foreground">No patterns tracked by LFS.</div>
                  )}
                  {status.patterns.map((p) => (
                    <div key={p} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 last:border-0">
                      <span className="flex-1 text-[12px] font-mono truncate">{p}</span>
                      <button onClick={() => run(() => untrack.mutateAsync(p))} disabled={busy}
                        className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-40" title="Untrack">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input value={pattern} onChange={(e) => setPattern(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTrack() }}
                    placeholder="Pattern to track (e.g. *.psd)"
                    className="h-7 flex-1 bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60 font-mono" />
                  <button onClick={handleTrack} disabled={!pattern.trim() || busy}
                    className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11.5px] disabled:opacity-40 flex items-center gap-1">
                    <Plus className="size-3.5" />Track
                  </button>
                </div>
              </div>

              {/* Managed files */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Managed objects ({status.files.length})
                </div>
                <div className="border border-border rounded-md overflow-hidden max-h-[220px] overflow-y-auto scrollbar-mac">
                  {status.files.length === 0 && (
                    <div className="px-3 py-3 text-[12px] text-muted-foreground">No files stored in LFS yet.</div>
                  )}
                  {status.files.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 last:border-0">
                      <FileBox className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-[12px] font-mono truncate">{f.path}</span>
                      {f.size && <span className="text-[11px] text-muted-foreground shrink-0">{f.size}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-[11.5px] text-destructive">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter>
          {status?.installed && (
            <button onClick={() => run(() => install.mutateAsync())} disabled={busy}
              className="h-8 px-4 rounded-md border border-border text-[12px] hover:bg-muted disabled:opacity-40"
              title="Install LFS hooks into this repository">
              {install.isPending ? 'Installing…' : 'Install hooks'}
            </button>
          )}
          <button onClick={() => onOpenChange(false)} className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted">Close</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
