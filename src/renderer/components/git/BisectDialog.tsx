import { useState } from 'react'
import { Bug, Check, X, SkipForward, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useBisectStatus, useBisectMutations } from '@/hooks/useRepo'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
}

export function BisectDialog({ open, onOpenChange, repoPath }: Props) {
  const { data: status } = useBisectStatus(repoPath, open)
  const { start, mark, skip, reset } = useBisectMutations(repoPath)
  const [bad, setBad] = useState('')
  const [good, setGood] = useState('')
  const [error, setError] = useState<string | null>(null)

  const active = status?.active ?? false
  const found = status?.badCommit ?? null
  const busy = start.isPending || mark.isPending || skip.isPending || reset.isPending

  async function run<T>(fn: () => Promise<T>) {
    setError(null)
    try { await fn() } catch (e: any) { setError(e?.message ?? String(e)) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="size-4" />Bisect</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          {!active && (
            <div className="border border-border rounded-md p-3 flex flex-col gap-2">
              <p className="text-[12px] text-muted-foreground">
                Binary-search history to find the commit that introduced a bug. Mark a known-bad
                and known-good revision (leave blank to mark interactively after start).
              </p>
              <input value={bad} onChange={(e) => setBad(e.target.value)} placeholder="Bad ref (e.g. HEAD) — optional"
                className="h-7 bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60 font-mono" />
              <input value={good} onChange={(e) => setGood(e.target.value)} placeholder="Good ref (e.g. v1.0) — optional"
                className="h-7 bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60 font-mono" />
              <div className="flex justify-end">
                <button
                  onClick={() => run(() => start.mutateAsync({ bad: bad.trim() || undefined, good: good.trim() || undefined }))}
                  disabled={busy}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] disabled:opacity-40"
                >{start.isPending ? 'Starting…' : 'Start bisect'}</button>
              </div>
            </div>
          )}

          {active && found && (
            <div className="border border-destructive/60 rounded-md p-3 flex flex-col gap-1 bg-destructive/5">
              <p className="text-[12px] font-medium text-destructive">First bad commit found</p>
              <p className="text-[12px] font-mono break-all">{found}</p>
              <p className="text-[11.5px] text-muted-foreground">Reset to leave bisect mode and return to your branch.</p>
            </div>
          )}

          {active && !found && (
            <div className="border border-border rounded-md p-3 flex flex-col gap-2">
              <div>
                <div className="text-[12px] font-mono break-all">{status?.currentRev?.slice(0, 12) ?? '—'}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{status?.currentSubject ?? 'Testing this revision…'}</div>
                {status?.remainingSteps != null && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">≈ {status.remainingSteps} step{status.remainingSteps === 1 ? '' : 's'} remaining</div>
                )}
              </div>
              <p className="text-[11.5px] text-muted-foreground">Test the checked-out revision, then mark it:</p>
              <div className="flex gap-2">
                <button onClick={() => run(() => mark.mutateAsync({ term: 'good' }))} disabled={busy}
                  className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted disabled:opacity-40 flex items-center gap-1.5 text-graph-2">
                  <Check className="size-3.5" />Good
                </button>
                <button onClick={() => run(() => mark.mutateAsync({ term: 'bad' }))} disabled={busy}
                  className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted disabled:opacity-40 flex items-center gap-1.5 text-destructive">
                  <X className="size-3.5" />Bad
                </button>
                <button onClick={() => run(() => skip.mutateAsync(undefined))} disabled={busy}
                  className="h-8 px-3 rounded-md border border-border text-[12px] hover:bg-muted disabled:opacity-40 flex items-center gap-1.5">
                  <SkipForward className="size-3.5" />Skip
                </button>
              </div>
            </div>
          )}

          {active && status?.log && (
            <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted/40 border border-border rounded p-2 max-h-[200px] overflow-y-auto scrollbar-mac">
              {status.log.trim()}
            </pre>
          )}

          {error && <p className="text-[11.5px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          {active && (
            <button onClick={() => run(() => reset.mutateAsync())} disabled={busy}
              className="h-8 px-4 rounded-md border border-border text-[12px] hover:bg-muted disabled:opacity-40 flex items-center gap-1.5">
              <RotateCcw className="size-3.5" />Reset bisect
            </button>
          )}
          <button onClick={() => onOpenChange(false)} className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted">Close</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
