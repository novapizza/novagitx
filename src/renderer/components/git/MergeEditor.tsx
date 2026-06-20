import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { GitMerge, Check, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useConflictFile, useResolveConflictManual } from '@/hooks/useRepo'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
  filePath: string | null
}

type Block =
  | { kind: 'context'; lines: string[] }
  | {
      kind: 'conflict'
      oursLabel: string
      theirsLabel: string
      oursLines: string[]
      theirsLines: string[]
    }

/** Split a conflicted file (with `<<<<<<<` / `=======` / `>>>>>>>` markers,
 *  and an optional `|||||||` base section) into context and conflict blocks. */
function parseConflicts(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let ctx: string[] = []
  const flush = () => {
    if (ctx.length) blocks.push({ kind: 'context', lines: ctx })
    ctx = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('<<<<<<<')) {
      flush()
      const oursLabel = line.slice(7).trim() || 'Current'
      i++
      const oursLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
        oursLines.push(lines[i++])
      }
      // Skip an optional diff3 base section.
      if (i < lines.length && lines[i].startsWith('|||||||')) {
        i++
        while (i < lines.length && !lines[i].startsWith('=======')) i++
      }
      if (i < lines.length && lines[i].startsWith('=======')) i++
      const theirsLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirsLines.push(lines[i++])
      }
      const theirsLabel = i < lines.length ? lines[i].slice(7).trim() || 'Incoming' : 'Incoming'
      if (i < lines.length) i++ // consume the >>>>>>> line
      blocks.push({ kind: 'conflict', oursLabel, theirsLabel, oursLines, theirsLines })
    } else {
      ctx.push(line)
      i++
    }
  }
  flush()
  return blocks
}

export function MergeEditor({ open, onOpenChange, repoPath, filePath }: Props) {
  const { data: raw, isLoading } = useConflictFile(repoPath, open ? filePath : null)
  const resolve = useResolveConflictManual(repoPath)
  const [error, setError] = useState<string | null>(null)

  const blocks = useMemo(() => (raw != null ? parseConflicts(raw) : []), [raw])
  const conflictCount = blocks.filter((b) => b.kind === 'conflict').length

  // Per-conflict resolution; index === position in `blocks`. null = unresolved.
  const [resolutions, setResolutions] = useState<Record<number, string[] | null>>({})

  useEffect(() => {
    // Reset whenever a fresh file is parsed.
    const init: Record<number, string[] | null> = {}
    blocks.forEach((b, idx) => {
      if (b.kind === 'conflict') init[idx] = null
    })
    setResolutions(init)
    setError(null)
  }, [blocks])

  const resolvedCount = blocks.filter((b, idx) => b.kind === 'conflict' && resolutions[idx] != null).length
  const allResolved = resolvedCount === conflictCount

  const setResolution = (idx: number, lines: string[]) =>
    setResolutions((r) => ({ ...r, [idx]: lines }))

  function buildResult(): string {
    const out: string[] = []
    blocks.forEach((b, idx) => {
      if (b.kind === 'context') out.push(...b.lines)
      else out.push(...(resolutions[idx] ?? []))
    })
    return out.join('\n')
  }

  async function handleSave() {
    if (!filePath || !allResolved) return
    setError(null)
    try {
      await resolve.mutateAsync({ filePath, content: buildResult() })
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save resolution')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[920px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            Resolve conflicts
            {filePath && <span className="font-mono text-[12px] text-muted-foreground truncate">{filePath}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-mac">
          {isLoading ? (
            <div className="p-8 text-center text-[12.5px] text-muted-foreground">Loading…</div>
          ) : conflictCount === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-muted-foreground">
              No conflict markers found in this file.
            </div>
          ) : (
            <div className="font-mono text-[11.5px] leading-[1.55]">
              {blocks.map((b, idx) =>
                b.kind === 'context' ? (
                  <ContextBlock key={idx} lines={b.lines} />
                ) : (
                  <ConflictBlock
                    key={idx}
                    block={b}
                    resolution={resolutions[idx] ?? null}
                    onChoose={(lines) => setResolution(idx, lines)}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border flex items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[12px] mr-auto">
            {error ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5" /> {error}
              </span>
            ) : conflictCount > 0 ? (
              <span className={allResolved ? 'text-[hsl(var(--graph-2))]' : 'text-muted-foreground'}>
                {resolvedCount} / {conflictCount} resolved
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!allResolved || conflictCount === 0 || resolve.isPending}
            className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            {resolve.isPending ? 'Saving…' : 'Mark resolved & stage'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContextBlock({ lines }: { lines: string[] }) {
  // Trailing empty element from split() shouldn't render an extra blank row.
  const display = lines.length > 1 && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
  if (display.length === 0) return null
  return (
    <div className="px-3 py-1 text-foreground/70 whitespace-pre-wrap break-words border-l-2 border-transparent">
      {display.join('\n')}
    </div>
  )
}

function ConflictBlock({
  block,
  resolution,
  onChoose,
}: {
  block: Extract<Block, { kind: 'conflict' }>
  resolution: string[] | null
  onChoose: (lines: string[]) => void
}) {
  const resolved = resolution != null
  const ours = block.oursLines
  const theirs = block.theirsLines

  const actions: { label: string; lines: string[]; icon?: ReactNode }[] = [
    { label: `Ours (${block.oursLabel})`, lines: ours, icon: <ChevronLeft className="size-3" /> },
    { label: `Theirs (${block.theirsLabel})`, lines: theirs, icon: <ChevronRight className="size-3" /> },
    { label: 'Both', lines: [...ours, ...theirs] },
    { label: 'Both (reversed)', lines: [...theirs, ...ours] },
  ]

  return (
    <div className={`my-1.5 border-y ${resolved ? 'border-[hsl(var(--graph-2))]/30' : 'border-destructive/30'}`}>
      <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 font-sans text-[11px]">
        {resolved ? (
          <Check className="size-3.5 text-[hsl(var(--graph-2))]" />
        ) : (
          <AlertTriangle className="size-3.5 text-destructive" />
        )}
        <span className="text-muted-foreground">{resolved ? 'Resolved' : 'Conflict'}</span>
        <div className="ml-auto flex items-center gap-1">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => onChoose(a.lines)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border border-border text-[10.5px] hover:bg-muted transition-colors"
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-side ours / theirs preview */}
      <div className="grid grid-cols-2 divide-x divide-border">
        <pre className="px-3 py-1.5 whitespace-pre-wrap break-words bg-diff-del/40 text-diff-del-fg overflow-x-auto">
          {ours.join('\n') || ' '}
        </pre>
        <pre className="px-3 py-1.5 whitespace-pre-wrap break-words bg-diff-add/40 text-diff-add-fg overflow-x-auto">
          {theirs.join('\n') || ' '}
        </pre>
      </div>

      {/* Editable resolution */}
      <div className="px-3 py-2 bg-background/60 font-sans">
        <label className="text-[10.5px] text-muted-foreground">Resolution</label>
        <textarea
          value={resolution?.join('\n') ?? ''}
          onChange={(e) => onChoose(e.target.value.split('\n'))}
          placeholder="Pick a side above, or type the merged result…"
          spellCheck={false}
          className="mt-1 w-full min-h-[2.5rem] rounded border border-border bg-background px-2 py-1 font-mono text-[11.5px] leading-[1.5] outline-none focus:ring-1 focus:ring-primary/50 resize-y"
          rows={Math.min(8, Math.max(2, (resolution?.length ?? 1)))}
        />
      </div>
    </div>
  )
}
