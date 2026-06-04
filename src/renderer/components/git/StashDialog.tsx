import { useState } from 'react'
import { Archive, Play, Trash2, GitCommit } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStashList, useStashDiff, useStashExtras, useStashMutations } from '@/hooks/useRepo'
import type { DiffFile } from '@/types/git'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
}

export function StashDialog({ open, onOpenChange, repoPath }: Props) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(false)
  const [saveAll, setSaveAll] = useState(false)
  const [tab, setTab] = useState<'list' | 'save'>('list')
  const [error, setError] = useState<string | null>(null)

  const { data: stashes = [], isLoading } = useStashList(repoPath)
  const { data: diff = [] } = useStashDiff(repoPath, selectedRef)
  const stashMutations = useStashMutations(repoPath)
  const stashExtras = useStashExtras(repoPath)

  async function handlePop(ref: string) {
    setError(null)
    try { await stashExtras.pop.mutateAsync(ref) } catch (e: any) { setError(e?.message) }
  }

  async function handleApply(ref: string) {
    setError(null)
    try { await stashMutations.apply.mutateAsync(ref) } catch (e: any) { setError(e?.message) }
  }

  async function handleDrop(ref: string) {
    setError(null)
    try {
      await stashMutations.drop.mutateAsync(ref)
      if (selectedRef === ref) setSelectedRef(null)
    } catch (e: any) { setError(e?.message) }
  }

  async function handleSave() {
    setError(null)
    try {
      await stashExtras.saveFlags.mutateAsync({ message: saveMsg || undefined, includeUntracked, all: saveAll })
      setSaveMsg('')
      setTab('list')
    } catch (e: any) { setError(e?.message) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] h-[520px] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Archive className="size-4" />
            Stash Manager
          </DialogTitle>
          <div className="flex gap-1 pt-1">
            {(['list', 'save'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-[11.5px] transition-colors ${tab === t ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60'}`}
              >
                {t === 'list' ? `Stashes (${stashes.length})` : 'New Stash'}
              </button>
            ))}
          </div>
        </DialogHeader>

        {tab === 'save' && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-muted-foreground">Message (optional)</label>
              <input
                value={saveMsg}
                onChange={(e) => setSaveMsg(e.target.value)}
                placeholder="WIP description…"
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={includeUntracked} onChange={(e) => setIncludeUntracked(e.target.checked)} />
              Include untracked files <span className="font-mono text-muted-foreground ml-1">(-u)</span>
            </label>
            <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <input type="checkbox" checked={saveAll} onChange={(e) => setSaveAll(e.target.checked)} />
              Include ignored files <span className="font-mono text-muted-foreground ml-1">(-a)</span>
            </label>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <button
              onClick={handleSave}
              disabled={stashExtras.saveFlags.isPending}
              className="h-8 self-start px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              {stashExtras.saveFlags.isPending ? 'Saving…' : 'Save Stash'}
            </button>
          </div>
        )}

        {tab === 'list' && (
          <div className="flex flex-1 min-h-0">
            <div className="w-[220px] shrink-0 border-r border-border overflow-y-auto">
              {isLoading && <p className="p-3 text-[12px] text-muted-foreground">Loading…</p>}
              {!isLoading && stashes.length === 0 && (
                <p className="p-3 text-[12px] text-muted-foreground">No stashes</p>
              )}
              {stashes.map((s) => (
                <button
                  key={s.ref}
                  onClick={() => setSelectedRef(s.ref)}
                  className={`w-full text-left px-3 py-2 border-b border-border/50 transition-colors ${
                    selectedRef === s.ref ? 'bg-primary/10' : 'hover:bg-muted'
                  }`}
                >
                  <div className="text-[12px] font-medium truncate">{s.ref}</div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{s.message}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-1 min-w-0 flex-col">
              {selectedRef ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <span className="text-[12px] font-mono flex-1 truncate">{selectedRef}</span>
                    <button
                      onClick={() => handlePop(selectedRef)}
                      disabled={stashExtras.pop.isPending}
                      className="h-6 px-2.5 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-40"
                    >
                      Pop
                    </button>
                    <button
                      onClick={() => handleApply(selectedRef)}
                      disabled={stashMutations.apply.isPending}
                      className="h-6 px-2.5 rounded bg-muted text-muted-foreground text-[11px] font-medium hover:bg-muted/80 disabled:opacity-40"
                    >
                      <Play className="size-3 inline mr-1" />Apply
                    </button>
                    <button
                      onClick={() => handleDrop(selectedRef)}
                      disabled={stashMutations.drop.isPending}
                      className="h-6 px-2.5 rounded text-destructive text-[11px] hover:bg-destructive/10 disabled:opacity-40"
                    >
                      <Trash2 className="size-3 inline mr-1" />Drop
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11.5px]">
                    {diff.length === 0 && <p className="text-muted-foreground p-2">No diff available</p>}
                    {diff.map((f: DiffFile, fi: number) => (
                      <div key={fi} className="border border-border rounded-md overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
                          <GitCommit className="size-3.5 text-muted-foreground" />
                          <span className="text-[11.5px] font-medium">{f.path}</span>
                          <span className={`ml-auto text-[10.5px] ${f.status === 'A' ? 'text-graph-2' : f.status === 'D' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {f.status}
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
                          {f.lines.slice(0, 60).map((l, li) => (
                            <div
                              key={li}
                              className={`px-3 whitespace-pre ${
                                l.type === 'hunk' ? 'bg-primary/5 text-primary/60 text-[10.5px]' :
                                l.type === 'add' ? 'bg-graph-2/10 text-graph-2' :
                                l.type === 'del' ? 'bg-destructive/10 text-destructive' :
                                'text-muted-foreground'
                              }`}
                            >
                              {l.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground">
                  Select a stash to preview
                </div>
              )}
              {error && <p className="px-3 pb-2 text-[12px] text-destructive">{error}</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
