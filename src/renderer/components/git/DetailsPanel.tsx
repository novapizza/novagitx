import { useState, useMemo } from 'react'
import { FileText, GitCommit, FileDiff, Copy, History, GitBranch } from 'lucide-react'
import type { GitRevision, DiffFile, DiffLine } from '@/types/git'
import { hashColor, initials } from '@/types/git'
import { useDiff, useFileDiff, useCommitSignature } from '@/hooks/useRepo'
import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react'
import { FileHistoryPanel } from './FileHistoryPanel'
import { BlameView } from './BlameView'
import { SplitDiffBody, DiffModeToggle } from './SplitDiff'
import { computeIntraLineSegments, SegmentedText } from '@/lib/wordDiff'
import { useUiStore } from '@/store/uiStore'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface DetailsPanelProps {
  commit: GitRevision | null
  repoPath: string | null
}

type PanelView = 'diff' | 'history' | 'blame'

export function DetailsPanel({ commit, repoPath }: DetailsPanelProps) {
  const [tab, setTab] = useState<'commit' | 'diff'>('diff')
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [panelView, setPanelView] = useState<PanelView>('diff')
  const [historyFile, setHistoryFile] = useState<string | null>(null)
  const [blameFile, setBlameFile] = useState<string | null>(null)

  const { data: files = [] } = useDiff(repoPath, commit?.objectId ?? null)

  const resolvedFile = activeFile ?? files[0]?.path ?? null

  function openHistory(path: string) {
    setHistoryFile(path)
    setPanelView('history')
  }

  function openBlame(path: string) {
    setBlameFile(path)
    setPanelView('blame')
  }

  const rightPane = (() => {
    if (panelView === 'history' && historyFile) {
      return (
        <FileHistoryPanel
          repoPath={repoPath}
          filePath={historyFile}
          onClose={() => setPanelView('diff')}
        />
      )
    }
    if (panelView === 'blame' && blameFile) {
      return (
        <BlameView
          repoPath={repoPath}
          filePath={blameFile}
          commitHash={commit?.objectId}
          onClose={() => setPanelView('diff')}
        />
      )
    }
    if (tab === 'commit' && commit) {
      return <CommitInfo commit={commit} repoPath={repoPath} />
    }
    return <DiffView repoPath={repoPath} commitHash={commit?.objectId ?? null} filePath={resolvedFile} />
  })()

  return (
    <div className="border-t border-border bg-window/80 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border">
        <Tab active={tab === 'commit' && panelView === 'diff'} onClick={() => { setTab('commit'); setPanelView('diff') }} icon={GitCommit} label="Commit" />
        <Tab active={tab === 'diff' && panelView === 'diff'} onClick={() => { setTab('diff'); setPanelView('diff') }} icon={FileDiff} label="Diff" />
        {panelView === 'history' && historyFile && (
          <Tab active icon={History} label={`History: ${historyFile.split('/').pop()}`} onClick={() => {}} />
        )}
        {panelView === 'blame' && blameFile && (
          <Tab active icon={GitBranch} label={`Blame: ${blameFile.split('/').pop()}`} onClick={() => {}} />
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr] overflow-hidden">
        <div className="border-r border-border overflow-y-auto scrollbar-mac">
          <div className="px-3 py-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            {files.length} changed files
          </div>
          {files.map((f) => {
            const isActive = f.path === resolvedFile
            return (
              <ContextMenu key={f.path}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => { setActiveFile(f.path); setPanelView('diff'); setTab('diff') }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                      isActive && panelView === 'diff' ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60 text-foreground/80'
                    }`}
                  >
                    <StatusBadge status={f.status} />
                    <span className="truncate font-mono text-[11.5px]">{f.path}</span>
                    <span className="ml-auto flex items-center gap-1 text-[10.5px] font-mono">
                      <span className="text-diff-add-bar">+{f.addedLines}</span>
                      <span className="text-diff-del-bar">−{f.removedLines}</span>
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem onClick={() => openHistory(f.path)}>
                    <History className="size-3.5 mr-2" />
                    File History
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openBlame(f.path)}>
                    <GitBranch className="size-3.5 mr-2" />
                    Blame
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>

        {rightPane}
      </div>
    </div>
  )
}

function Tab({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] transition-colors ${
        active ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60'
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    M: 'bg-graph-3/20 text-[hsl(var(--graph-3))]',
    A: 'bg-graph-2/20 text-[hsl(var(--graph-2))]',
    D: 'bg-destructive/20 text-destructive',
    R: 'bg-graph-4/20 text-[hsl(var(--graph-4))]',
  }
  return (
    <span className={`size-4 shrink-0 rounded text-[9.5px] font-bold flex items-center justify-center ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  )
}

function DiffView({
  repoPath,
  commitHash,
  filePath,
}: {
  repoPath: string | null
  commitHash: string | null
  filePath: string | null
}) {
  const { data: diffFiles, isLoading } = useFileDiff(repoPath, commitHash, filePath)
  const lines: DiffLine[] = diffFiles?.[0]?.lines ?? []
  const viewMode = useUiStore((s) => s.diffViewMode)
  const segMap = useMemo(() => computeIntraLineSegments(lines), [lines])

  if (!filePath) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-[12.5px]">
        Select a file to view diff
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-[12.5px]">
        Loading diff…
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-border bg-muted/40 text-[11.5px]">
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="font-mono">{filePath}</span>
        <div className="ml-auto flex items-center gap-3">
          <DiffModeToggle />
          <button
            onClick={() => navigator.clipboard.writeText(lines.map((l) => l.text).join('\n'))}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3" /> Copy
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-mac font-mono text-[11.5px] leading-[1.55]">
        {viewMode === 'split' ? (
          <SplitDiffBody lines={lines} />
        ) : (
          <table className="w-full">
            <tbody>
              {lines.map((l, i) => {
                const bg =
                  l.type === 'add' ? 'bg-diff-add' : l.type === 'del' ? 'bg-diff-del' : l.type === 'hunk' ? 'bg-muted/70' : ''
                const fg =
                  l.type === 'add'
                    ? 'text-diff-add-fg'
                    : l.type === 'del'
                    ? 'text-diff-del-fg'
                    : l.type === 'hunk'
                    ? 'text-muted-foreground'
                    : 'text-foreground/85'
                const sign = l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '
                return (
                  <tr key={i} className={bg}>
                    <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-r border-border/40">
                      {l.oldLineNum ?? ''}
                    </td>
                    <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-r border-border/40">
                      {l.newLineNum ?? ''}
                    </td>
                    <td className={`select-none w-5 text-center ${fg}`}>{sign}</td>
                    <td className={`pl-2 pr-4 whitespace-pre ${fg}`}>
                      {segMap.has(l) ? (
                        <SegmentedText segments={segMap.get(l)!} kind={l.type === 'add' ? 'add' : 'del'} />
                      ) : (
                        l.text
                      )}
                    </td>
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

function CommitInfo({ commit, repoPath }: { commit: GitRevision; repoPath: string | null }) {
  const date = new Date(commit.authorUnixTime * 1000).toLocaleString()
  const { data: sig } = useCommitSignature(repoPath, commit.objectId)
  return (
    <div className="overflow-y-auto scrollbar-mac p-5">
      <div className="flex items-start gap-3">
        <span
          className="size-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
          style={{ background: hashColor(commit.author) }}
        >
          {initials(commit.author)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-snug">{commit.subject}</div>
          {commit.body && <p className="text-[12.5px] text-muted-foreground mt-1.5 whitespace-pre-wrap">{commit.body}</p>}
          <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px] max-w-md">
            <Field label="Author" value={`${commit.author} <${commit.authorEmail}>`} />
            <Field label="Date" value={date} />
            <Field label="Hash" value={commit.objectId} mono />
            {commit.parentIds.length > 0 && (
              <Field label="Parent" value={commit.parentIds.map((p) => p.slice(0, 8)).join(', ')} mono />
            )}
          </div>
          {sig && sig.status !== 'unsigned' && <SignatureBadge sig={sig} />}
        </div>
      </div>
    </div>
  )
}

function SignatureBadge({ sig }: { sig: { status: string; signer: string | null; key: string | null } }) {
  const tone =
    sig.status === 'good' ? 'text-graph-2 border-graph-2/30 bg-graph-2/5'
    : sig.status === 'bad' ? 'text-destructive border-destructive/30 bg-destructive/5'
    : sig.status === 'expired' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5'
    : 'text-muted-foreground border-border bg-muted/30'
  const Icon = sig.status === 'good' ? ShieldCheck : sig.status === 'bad' ? ShieldAlert : ShieldOff
  return (
    <div className={`mt-3 inline-flex items-center gap-2 px-2 py-1 rounded border text-[11.5px] ${tone}`}>
      <Icon className="size-3.5" />
      <span className="font-medium uppercase tracking-wide">{sig.status} signature</span>
      {sig.signer && <span className="text-muted-foreground/80">— {sig.signer}</span>}
      {sig.key && <span className="font-mono text-[10.5px] text-muted-foreground/60">({sig.key})</span>}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-[11.5px]' : ''}>{value}</div>
    </>
  )
}
