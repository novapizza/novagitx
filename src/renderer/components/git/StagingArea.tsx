import { useState, useMemo } from 'react'
import { Plus, Minus, GitCommit, Archive, Trash2, Copy, FileText } from 'lucide-react'
import type { GitItemStatus, DiffLine } from '@/types/git'
import { useStatus, useCommitMutations, useCommitMutationsExtra, useStashMutations, useWorkingDiff, useStagedDiff, useHunkMutations, useSignedCommit } from '@/hooks/useRepo'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { SplitDiffBody, DiffModeToggle } from './SplitDiff'
import { computeIntraLineSegments, SegmentedText } from '@/lib/wordDiff'
import { useUiStore } from '@/store/uiStore'

interface StagingAreaProps {
  repoPath: string | null
  onAddToGitignore?: (pattern: string) => void
}

type SelectedFile = { path: string; kind: 'unstaged' | 'staged' } | null

export function StagingArea({ repoPath, onAddToGitignore }: StagingAreaProps) {
  const { data: status = [] } = useStatus(repoPath)
  const { stage, unstage, commit } = useCommitMutations(repoPath)
  const { discard, amend } = useCommitMutationsExtra(repoPath)
  const stash = useStashMutations(repoPath)
  const signedCommit = useSignedCommit(repoPath)
  const [message, setMessage] = useState('')
  const [amendMode, setAmendMode] = useState(false)
  const [signCommit, setSignCommit] = useState(false)
  const [stashMsg, setStashMsg] = useState('')
  const [showStashInput, setShowStashInput] = useState(false)
  const [selected, setSelected] = useState<SelectedFile>(null)

  const staged = status.filter((f) => f.isStaged)
  const unstaged = status.filter((f) => !f.isStaged)

  const { data: workingDiffFiles = [] } = useWorkingDiff(
    repoPath,
    selected?.kind === 'unstaged' ? selected.path : null,
  )
  const { data: stagedDiffFiles = [] } = useStagedDiff(
    repoPath,
    selected?.kind === 'staged' ? selected.path : null,
  )
  const diffLines: DiffLine[] = selected?.kind === 'staged'
    ? (stagedDiffFiles[0]?.lines ?? [])
    : (workingDiffFiles[0]?.lines ?? [])

  function handleCommit() {
    if (!message.trim()) return
    const trimmed = message.trim()
    if (amendMode) {
      amend.mutate(trimmed, { onSuccess: () => { setMessage(''); setAmendMode(false) } })
    } else if (signCommit) {
      signedCommit.mutate(trimmed, { onSuccess: () => setMessage('') })
    } else {
      commit.mutate(trimmed, { onSuccess: () => setMessage('') })
    }
  }

  function handleStash() {
    stash.save.mutate(stashMsg.trim() || undefined, {
      onSuccess: () => { setStashMsg(''); setShowStashInput(false) },
    })
  }

  return (
    <div className="border-t border-border bg-window/80 flex flex-col h-full overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0">
        <GitCommit className="size-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium">Staging Area</span>
        <span className="ml-2 text-[10.5px] text-muted-foreground">
          {staged.length} staged · {unstaged.length} unstaged
        </span>
        <button
          onClick={() => setShowStashInput((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
        >
          <Archive className="size-3.5" />
          Stash
        </button>
      </div>

      {/* stash inline input */}
      {showStashInput && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
          <input
            autoFocus
            value={stashMsg}
            onChange={(e) => setStashMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStash(); if (e.key === 'Escape') setShowStashInput(false) }}
            placeholder="Stash message (optional)…"
            className="flex-1 h-7 rounded-md border border-border bg-background px-2.5 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={handleStash}
            disabled={stash.save.isPending || status.length === 0}
            className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {stash.save.isPending ? 'Saving…' : 'Save stash'}
          </button>
          <button onClick={() => setShowStashInput(false)} className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr_260px]">
        {/* file lists */}
        <div className="border-r border-border flex flex-col min-h-0 overflow-y-auto scrollbar-mac">
          {/* unstaged */}
          <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between sticky top-0 bg-window/95 backdrop-blur">
            Unstaged ({unstaged.length})
            {unstaged.length > 0 && (
              <button onClick={() => unstaged.forEach((f) => stage.mutate(f.name))} className="text-[10px] text-primary hover:underline normal-case tracking-normal font-normal">
                Stage all
              </button>
            )}
          </div>
          {unstaged.map((f) => (
            <FileRow
              key={f.name}
              file={f}
              active={selected?.kind === 'unstaged' && selected.path === f.name}
              onClick={() => setSelected({ path: f.name, kind: 'unstaged' })}
              action={
                <button onClick={(e) => { e.stopPropagation(); stage.mutate(f.name) }} title="Stage" className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-graph-2/20 text-[hsl(var(--graph-2))] transition-opacity shrink-0">
                  <Plus className="size-3" />
                </button>
              }
              onDiscard={() => discard.mutate(f.name)}
              onAddToGitignore={f.isNew && onAddToGitignore ? () => onAddToGitignore(f.name) : undefined}
            />
          ))}
          {unstaged.length === 0 && <div className="px-3 py-3 text-[11px] text-muted-foreground">Clean</div>}

          {/* staged */}
          <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between sticky top-0 bg-window/95 backdrop-blur border-t border-border mt-1">
            Staged ({staged.length})
            {staged.length > 0 && (
              <button onClick={() => staged.forEach((f) => unstage.mutate(f.name))} className="text-[10px] text-primary hover:underline normal-case tracking-normal font-normal">
                Unstage all
              </button>
            )}
          </div>
          {staged.map((f) => (
            <FileRow
              key={f.name}
              file={f}
              active={selected?.kind === 'staged' && selected.path === f.name}
              onClick={() => setSelected({ path: f.name, kind: 'staged' })}
              action={
                <button onClick={(e) => { e.stopPropagation(); unstage.mutate(f.name) }} title="Unstage" className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-destructive transition-opacity shrink-0">
                  <Minus className="size-3" />
                </button>
              }
            />
          ))}
          {staged.length === 0 && <div className="px-3 py-3 text-[11px] text-muted-foreground">Nothing staged</div>}
        </div>

        {/* diff view with hunk staging */}
        <DiffPane
          repoPath={repoPath}
          filePath={selected?.path ?? null}
          lines={diffLines}
          kind={selected?.kind ?? null}
        />

        {/* commit panel */}
        <div className="flex flex-col p-3 gap-2 border-l border-border">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={amendMode ? 'Amend commit message…' : 'Commit message…'}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleCommit() }}
            className="flex-1 resize-none rounded-md border border-border bg-background/60 px-2.5 py-2 text-[12.5px] placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 font-mono"
          />
          <label className="flex items-center gap-2 text-[11.5px] cursor-pointer select-none text-muted-foreground">
            <input type="checkbox" checked={amendMode} onChange={(e) => setAmendMode(e.target.checked)} className="rounded border-border" />
            Amend last commit
          </label>
          <label className="flex items-center gap-2 text-[11.5px] cursor-pointer select-none text-muted-foreground">
            <input type="checkbox" checked={signCommit} disabled={amendMode}
              onChange={(e) => setSignCommit(e.target.checked)} className="rounded border-border" />
            Sign with GPG (-S)
          </label>
          <button
            onClick={handleCommit}
            disabled={!message.trim() || (staged.length === 0 && !amendMode) || commit.isPending || amend.isPending || signedCommit.isPending}
            className="flex items-center justify-center gap-1.5 h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <GitCommit className="size-3.5" />
            {commit.isPending || amend.isPending || signedCommit.isPending ? 'Working…' : amendMode ? 'Amend' : signCommit ? 'Commit (signed)' : 'Commit'}
            <span className="text-[10px] opacity-70 ml-1">⌘↵</span>
          </button>
          {(commit.isError || amend.isError || signedCommit.isError) && (
            <p className="text-[11px] text-destructive">{String(((commit.error || amend.error || signedCommit.error) as any)?.message ?? 'Failed')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Build a minimal unified diff patch for a single hunk
function buildHunkPatch(filePath: string, lines: DiffLine[], hunkIndex: number): string {
  const hunks: { headerIdx: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type === 'hunk') hunks.push({ headerIdx: i })
  }
  const hunk = hunks[hunkIndex]
  if (!hunk) return ''
  const start = hunk.headerIdx
  const end = hunks[hunkIndex + 1]?.headerIdx ?? lines.length

  const hunkLines = lines.slice(start, end)
  const body = hunkLines
    .map((l) => {
      if (l.type === 'hunk') return l.text
      if (l.type === 'add') return `+${l.text}`
      if (l.type === 'del') return `-${l.text}`
      return ` ${l.text}`
    })
    .join('\n')

  return `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n${body}\n`
}

function DiffPane({
  repoPath,
  filePath,
  lines,
  kind,
}: {
  repoPath: string | null
  filePath: string | null
  lines: DiffLine[]
  kind: 'unstaged' | 'staged' | null
}) {
  const { stageHunk, unstageHunk } = useHunkMutations(repoPath)
  const viewMode = useUiStore((s) => s.diffViewMode)
  const segMap = useMemo(() => computeIntraLineSegments(lines), [lines])

  if (!filePath) {
    return (
      <div className="flex items-center justify-center text-[12px] text-muted-foreground">
        Select a file to view diff
      </div>
    )
  }

  // Find hunk boundary indices
  const hunkIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type === 'hunk') hunkIndices.push(i)
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-border bg-muted/40 text-[11.5px] shrink-0">
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="font-mono truncate">{filePath}</span>
        <span className="ml-2 text-[10px] text-muted-foreground">{kind === 'staged' ? 'staged' : 'unstaged'}</span>
        <div className="ml-auto flex items-center gap-3">
          <DiffModeToggle />
          <button
            onClick={() => navigator.clipboard.writeText(lines.map((l) => l.text).join('\n'))}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-mac font-mono text-[11.5px] leading-[1.55]">
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[12px] text-muted-foreground">No diff</div>
        ) : viewMode === 'split' ? (
          <SplitDiffBody lines={lines} />
        ) : (
          <table className="w-full">
            <tbody>
              {lines.map((l, i) => {
                const bg = l.type === 'add' ? 'bg-diff-add' : l.type === 'del' ? 'bg-diff-del' : l.type === 'hunk' ? 'bg-muted/70' : ''
                const fg = l.type === 'add' ? 'text-diff-add-fg' : l.type === 'del' ? 'text-diff-del-fg' : l.type === 'hunk' ? 'text-muted-foreground' : 'text-foreground/85'
                const sign = l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '
                const hunkIdx = l.type === 'hunk' ? hunkIndices.indexOf(i) : -1

                return (
                  <tr key={i} className={`${bg} group`}>
                    <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-r border-border/40">{l.oldLineNum ?? ''}</td>
                    <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-r border-border/40">{l.newLineNum ?? ''}</td>
                    <td className={`select-none w-5 text-center ${fg}`}>{sign}</td>
                    <td className={`pl-2 whitespace-pre ${fg} w-full`}>
                      {segMap.has(l) ? (
                        <SegmentedText segments={segMap.get(l)!} kind={l.type === 'add' ? 'add' : 'del'} />
                      ) : (
                        l.text
                      )}
                    </td>
                    {l.type === 'hunk' && hunkIdx !== -1 && (
                      <td className="px-2 text-right">
                        <button
                          onClick={() => {
                            const patch = buildHunkPatch(filePath, lines, hunkIdx)
                            if (kind === 'staged') unstageHunk.mutate(patch)
                            else stageHunk.mutate(patch)
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors whitespace-nowrap font-sans"
                        >
                          {kind === 'staged' ? 'Unstage hunk' : 'Stage hunk'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function FileRow({
  file, active, onClick, action, onDiscard, onAddToGitignore,
}: {
  file: GitItemStatus
  active?: boolean
  onClick: () => void
  action: React.ReactNode
  onDiscard?: () => void
  onAddToGitignore?: () => void
}) {
  const label = file.isRenamed && file.oldName ? `${file.oldName} → ${file.name}` : file.name
  const badge = file.isNew ? 'A' : file.isDeleted ? 'D' : file.isRenamed ? 'R' : file.isUnmerged ? 'U' : 'M'
  const badgeColor = file.isNew ? 'text-[hsl(var(--graph-2))]' : file.isDeleted ? 'text-destructive' : file.isRenamed ? 'text-[hsl(var(--graph-4))]' : file.isUnmerged ? 'text-destructive' : 'text-[hsl(var(--graph-3))]'

  const hasMenu = onDiscard || onAddToGitignore

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onClick}
          className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors ${active ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
        >
          <span className={`text-[10.5px] font-bold font-mono w-3 shrink-0 ${badgeColor}`}>{badge}</span>
          <span className="truncate font-mono text-[10.5px] text-foreground/85 flex-1">{label}</span>
          {action}
        </div>
      </ContextMenuTrigger>
      {hasMenu && (
        <ContextMenuContent className="w-48">
          {onAddToGitignore && (
            <ContextMenuItem onClick={onAddToGitignore}>
              <FileText className="size-3.5 mr-2" />
              Add to .gitignore
            </ContextMenuItem>
          )}
          {onDiscard && onAddToGitignore && <ContextMenuSeparator />}
          {onDiscard && (
            <ContextMenuItem onClick={onDiscard} className="text-destructive focus:text-destructive">
              <Trash2 className="size-3.5 mr-2" />
              Discard changes
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
