import { useState } from 'react'
import { GitBranch, GitCommit } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCompareDiff } from '@/hooks/useRepo'
import type { DiffFile, RefGroups } from '@/types/git'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
  refs: RefGroups
}

export function CompareDialog({ open, onOpenChange, repoPath, refs }: Props) {
  const [ref1, setRef1] = useState('')
  const [ref2, setRef2] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const allRefs = [
    ...refs.branches.map((b) => b.name),
    ...refs.remotes.map((r) => r.completeName.replace('refs/remotes/', '')),
    ...refs.tags.map((t) => t.name),
  ]

  const { data: diff = [], isFetching } = useCompareDiff(
    repoPath,
    ref1 || null,
    ref2 || null,
    null
  )

  const { data: fileDiff = [] } = useCompareDiff(
    repoPath,
    ref1 || null,
    ref2 || null,
    selectedFile
  )

  const displayed: DiffFile[] = selectedFile ? fileDiff : diff

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1100px,90vw)] w-[90vw] h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <GitBranch className="size-4" />
            Compare Branches
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <select
              value={ref1}
              onChange={(e) => { setRef1(e.target.value); setSelectedFile(null) }}
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">— base —</option>
              {allRefs.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="text-[11px] text-muted-foreground shrink-0">↔</span>
            <select
              value={ref2}
              onChange={(e) => { setRef2(e.target.value); setSelectedFile(null) }}
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">— compare —</option>
              {allRefs.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* File list */}
          <div className="w-[220px] shrink-0 border-r border-border overflow-y-auto">
            {isFetching && <p className="p-3 text-[12px] text-muted-foreground">Loading…</p>}
            {!isFetching && !ref1 && !ref2 && (
              <p className="p-3 text-[12px] text-muted-foreground">Select two refs to compare</p>
            )}
            {!isFetching && ref1 && ref2 && diff.length === 0 && (
              <p className="p-3 text-[12px] text-muted-foreground">No differences</p>
            )}
            {diff.map((f: DiffFile, i: number) => (
              <button
                key={i}
                onClick={() => setSelectedFile(selectedFile === f.path ? null : f.path)}
                className={`w-full text-left px-3 py-2 border-b border-border/50 transition-colors ${
                  selectedFile === f.path ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <div className="text-[11.5px] font-medium truncate">{f.path}</div>
                <div className={`text-[10.5px] mt-0.5 ${
                  f.status === 'A' ? 'text-graph-2' :
                  f.status === 'D' ? 'text-destructive' : 'text-muted-foreground'
                }`}>{f.status}</div>
              </button>
            ))}
          </div>

          {/* Diff view */}
          <div className="flex-1 overflow-auto font-mono text-[11.5px] p-2 space-y-1">
            {displayed.length === 0 && ref1 && ref2 && !selectedFile && (
              <p className="text-[12px] text-muted-foreground p-2">Select a file to see its diff</p>
            )}
            {displayed.map((f: DiffFile, fi: number) => (
              <div key={fi} className="border border-border rounded-md overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
                  <GitCommit className="size-3.5 text-muted-foreground" />
                  <span className="text-[11.5px] font-medium">{f.path}</span>
                </div>
                {f.lines.map((l, li) => (
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
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
