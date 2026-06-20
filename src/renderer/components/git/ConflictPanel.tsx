import { AlertTriangle, ChevronRight, ChevronLeft, GitMerge } from 'lucide-react'
import { useConflicts, useConflictMutations } from '@/hooks/useRepo'
import type { ConflictFile } from '@/types/git'

interface ConflictPanelProps {
  repoPath: string | null
  onOpenEditor?: (filePath: string) => void
}

export function ConflictPanel({ repoPath, onOpenEditor }: ConflictPanelProps) {
  const { data: conflicts = [] } = useConflicts(repoPath)
  const resolve = useConflictMutations(repoPath)

  if (conflicts.length === 0) return null

  return (
    <div className="border border-destructive/40 rounded-md bg-destructive/5 mx-2 mb-2 overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-destructive/30">
        <AlertTriangle className="size-3.5 text-destructive shrink-0" />
        <span className="text-[12px] font-semibold text-destructive">
          {conflicts.length} merge conflict{conflicts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-destructive/20">
        {conflicts.map((f) => (
          <ConflictRow
            key={f.path}
            conflict={f}
            isPending={resolve.isPending}
            onResolve={(strategy) => resolve.mutate({ filePath: f.path, strategy })}
            onOpenEditor={onOpenEditor ? () => onOpenEditor(f.path) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function ConflictRow({
  conflict,
  isPending,
  onResolve,
  onOpenEditor,
}: {
  conflict: ConflictFile
  isPending: boolean
  onResolve: (strategy: 'ours' | 'theirs') => void
  onOpenEditor?: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="font-mono text-[11.5px] text-foreground/85 truncate flex-1">{conflict.path}</span>
      <div className="flex items-center gap-1 shrink-0">
        {onOpenEditor && (
          <button
            onClick={onOpenEditor}
            disabled={isPending}
            title="Resolve in merge editor"
            className="flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            <GitMerge className="size-3" />
            Resolve…
          </button>
        )}
        <button
          onClick={() => onResolve('ours')}
          disabled={isPending}
          title="Keep ours (HEAD)"
          className="flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-graph-2/15 text-[hsl(var(--graph-2))] hover:bg-graph-2/25 transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="size-3" />
          Ours
        </button>
        <button
          onClick={() => onResolve('theirs')}
          disabled={isPending}
          title="Use theirs (MERGE_HEAD)"
          className="flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-graph-4/15 text-[hsl(var(--graph-4))] hover:bg-graph-4/25 transition-colors disabled:opacity-40"
        >
          Theirs
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  )
}

// Compact inline indicator for the staging area header
export function ConflictIndicator({ repoPath }: { repoPath: string | null }) {
  const { data: conflicts = [] } = useConflicts(repoPath)
  if (conflicts.length === 0) return null
  return (
    <span className="flex items-center gap-1 text-[10.5px] text-destructive font-medium">
      <AlertTriangle className="size-3" />
      {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
    </span>
  )
}
