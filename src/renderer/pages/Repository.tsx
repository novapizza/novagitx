import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useShortcut } from '@/hooks/useShortcut'
import { GitBranch, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TitleBar } from '@/components/git/TitleBar'
import { Sidebar } from '@/components/git/Sidebar'
import { CommitGraph } from '@/components/git/CommitGraph'
import { buildGraphLanes } from '@/lib/graph'
import { DetailsPanel } from '@/components/git/DetailsPanel'
import { StagingArea } from '@/components/git/StagingArea'
import { CommandPalette, type PaletteAction } from '@/components/git/CommandPalette'
import { CreateBranchDialog } from '@/components/git/CreateBranchDialog'
import { RemoteActionDialog } from '@/components/git/RemoteActionDialog'
import { CloneDialog } from '@/components/git/CloneDialog'
import { MergeDialog } from '@/components/git/MergeDialog'
import { CreateTagDialog } from '@/components/git/CreateTagDialog'
import { RenameBranchDialog } from '@/components/git/RenameBranchDialog'
import { LogFilter } from '@/components/git/LogFilter'
import { RebaseDialog } from '@/components/git/RebaseDialog'
import { RemotesDialog } from '@/components/git/RemotesDialog'
import { ReflogPanel } from '@/components/git/ReflogPanel'
import { ConflictPanel } from '@/components/git/ConflictPanel'
import { InteractiveRebaseDialog } from '@/components/git/InteractiveRebaseDialog'
import { StashDialog } from '@/components/git/StashDialog'
import { CompareDialog } from '@/components/git/CompareDialog'
import { PatchDialog } from '@/components/git/PatchDialog'
import { SubmodulesDialog } from '@/components/git/SubmodulesDialog'
import { CleanDialog } from '@/components/git/CleanDialog'
import { GitignoreEditor } from '@/components/git/GitignoreEditor'
import { SetUpstreamDialog } from '@/components/git/SetUpstreamDialog'
import { WorktreesDialog } from '@/components/git/WorktreesDialog'
import { ArchiveDialog } from '@/components/git/ArchiveDialog'
import { FsckDialog } from '@/components/git/FsckDialog'
import { MailmapEditor } from '@/components/git/MailmapEditor'
import { SparseCheckoutDialog } from '@/components/git/SparseCheckoutDialog'
import { SettingsDialog } from '@/components/git/SettingsDialog'
import { useRepoStore } from '@/store/repoStore'
import { gitApi } from '@/api/git'
import {
  useLog, useRefs, useStatus,
  useBranchMutations, useRemoteMutations, useStashMutations,
  useCommitGraphMutations, useBranchMerge, useTagMutations,
  useStashExtras, useBranchExtras, useGitignoreMutations,
} from '@/hooks/useRepo'
import type { GitRevision, RefGroups, LogOptions, RepoInfo } from '@/types/git'

const EMPTY_REFS: RefGroups = { branches: [], remotes: [], tags: [], stashes: [], head: null }

type RemoteAction = 'pull' | 'push'
type PatchMode = 'format' | 'apply'
type GitignoreFile = 'gitignore' | 'gitattributes'

export default function Repository() {
  const { repoInfo, setRepo } = useRepoStore()
  const repoPath = repoInfo?.path ?? null
  const qc = useQueryClient()

  const [logFilter, setLogFilter] = useState<LogOptions>({})
  const { data: logData, isLoading: logLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLog(repoPath, logFilter)
  const commits = useMemo(() => {
    const flat = logData?.pages.flat() ?? []
    buildGraphLanes(flat) // rebuild lanes over the full loaded set so they connect across page seams
    return flat
  }, [logData])
  const { data: refs = EMPTY_REFS } = useRefs(repoPath)
  const { data: status = [] } = useStatus(repoPath)

  // Keep the persisted repoInfo's HEAD in sync with the live refs query (which already
  // resolves `head` = current branch, or "HEAD" when detached). Key on the head *string*,
  // not the refs object — the refs query gets a fresh object on every background refetch,
  // and re-syncing on identity would re-render the whole view (resetting the graph scroll)
  // and fire a redundant getRepoInfo round-trip each time. The equality guard makes a
  // no-op render impossible.
  useEffect(() => {
    if (!repoPath || refs.head == null) return
    const detached = refs.head === 'HEAD'
    const branch = detached ? null : refs.head
    if (branch === repoInfo?.currentBranch && detached === (repoInfo?.isDetachedHead ?? false)) return
    setRepo({ ...(repoInfo as RepoInfo), currentBranch: branch, isDetachedHead: detached })
  }, [refs.head, repoPath, repoInfo, setRepo])

  const branchMutations = useBranchMutations(repoPath)
  const remoteMutations = useRemoteMutations(repoPath)
  const stashMutations = useStashMutations(repoPath)
  const stashExtras = useStashExtras(repoPath)
  const graphMutations = useCommitGraphMutations(repoPath)
  const branchMerge = useBranchMerge(repoPath)
  const tagMutations = useTagMutations(repoPath)
  const branchExtras = useBranchExtras(repoPath)
  const gitignoreMutations = useGitignoreMutations(repoPath)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // A commit picked from the command palette may live outside the loaded graph
  // window; keep it here so the details panel can still render it.
  const [pickedCommit, setPickedCommit] = useState<GitRevision | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showStaging, setShowStaging] = useState(false)
  const [createBranch, setCreateBranch] = useState<{ open: boolean; from: string }>({ open: false, from: '' })
  const [remoteAction, setRemoteAction] = useState<RemoteAction | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [createTagHash, setCreateTagHash] = useState<string | null>(null)
  const [renameBranchName, setRenameBranchName] = useState<string | null>(null)
  const [rebaseOpen, setRebaseOpen] = useState(false)
  const [remotesOpen, setRemotesOpen] = useState(false)
  const [reflogOpen, setReflogOpen] = useState(false)
  // Tier 2 dialogs
  const [iRebaseOpen, setIRebaseOpen] = useState(false)
  const [stashOpen, setStashOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [patchOpen, setPatchOpen] = useState<PatchMode | null>(null)
  const [submodulesOpen, setSubmodulesOpen] = useState(false)
  const [cleanOpen, setCleanOpen] = useState(false)
  const [gitignoreFile, setGitignoreFile] = useState<GitignoreFile | null>(null)
  const [setUpstreamBranch, setSetUpstreamBranch] = useState<string | null>(null)
  // Tier 3 dialogs
  const [worktreesOpen, setWorktreesOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [fsckOpen, setFsckOpen] = useState(false)
  const [mailmapOpen, setMailmapOpen] = useState(false)
  const [sparseOpen, setSparseOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [detailsPx, setDetailsPx] = useState(300)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startY - e.clientY
    setDetailsPx(Math.max(150, Math.min(600, dragRef.current.startH + delta)))
  }, [])

  const onResizeEnd = useCallback(() => {
    dragRef.current = null
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  }, [onResizeMove])

  function onResizeStart(e: React.MouseEvent) {
    dragRef.current = { startY: e.clientY, startH: detailsPx }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)
  }

  const selected =
    commits.find((c) => c.objectId === selectedId) ??
    (pickedCommit?.objectId === selectedId ? pickedCommit : null) ??
    commits[0] ?? null
  const hasChanges = status.length > 0

  const remoteNames = [...new Set(refs.remotes.map((r) => r.remote))].filter(Boolean)
  const remoteBranches = refs.remotes.map((r) => r.completeName.replace('refs/remotes/', ''))

  useShortcut(
    { id: 'palette.toggle', label: 'Toggle command palette', defaultCombo: 'Mod+K', group: 'General' },
    useCallback(() => setPaletteOpen((o) => !o), []),
    { allowInEditable: true },
  )
  useShortcut(
    { id: 'palette.close', label: 'Close command palette', defaultCombo: 'Escape', group: 'General' },
    useCallback(() => setPaletteOpen(false), []),
    { enabled: paletteOpen, allowInEditable: true },
  )
  useShortcut(
    { id: 'staging.toggle', label: 'Toggle staging area', defaultCombo: 'Mod+G', group: 'General' },
    useCallback(() => setShowStaging((s) => !s), []),
  )

  const handleOpenRepo = useCallback(async () => {
    const info = await gitApi.openRepo()
    if (info) setRepo(info)
  }, [setRepo])

  const handleOpenPR = useCallback(async () => {
    if (!repoPath || !repoInfo) return
    const remotes = await gitApi.getRemotes(repoPath)
    const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
    if (!origin) return
    const url = buildPullRequestUrl(origin.fetchUrl || origin.pushUrl, repoInfo.currentBranch)
    if (url) window.appOS.openExternal(url)
  }, [repoPath, repoInfo])

  const handleRefresh = useCallback(() => {
    if (!repoPath) return
    qc.invalidateQueries({ queryKey: ['log', repoPath] })
    qc.invalidateQueries({ queryKey: ['refs', repoPath] })
    qc.invalidateQueries({ queryKey: ['status', repoPath] })
  }, [qc, repoPath])

  // Remote
  useShortcut(
    { id: 'remote.fetch', label: 'Fetch', defaultCombo: 'Mod+Shift+F', group: 'Remote' },
    useCallback(() => remoteMutations.fetch.mutate(undefined), [remoteMutations.fetch]),
  )
  useShortcut(
    { id: 'remote.pull', label: 'Pull…', defaultCombo: 'Mod+Shift+P', group: 'Remote' },
    useCallback(() => setRemoteAction('pull'), []),
  )
  useShortcut(
    { id: 'remote.push', label: 'Push…', defaultCombo: 'Mod+Shift+U', group: 'Remote' },
    useCallback(() => setRemoteAction('push'), []),
  )
  useShortcut(
    { id: 'remote.openPR', label: 'Open pull request', defaultCombo: 'Mod+Shift+O', group: 'Remote' },
    handleOpenPR,
  )

  // Branch
  useShortcut(
    { id: 'branch.create', label: 'New branch…', defaultCombo: 'Mod+Shift+B', group: 'Branch' },
    useCallback(() => setCreateBranch({ open: true, from: repoInfo?.currentBranch ?? '' }), [repoInfo?.currentBranch]),
  )
  useShortcut(
    { id: 'branch.merge', label: 'Merge…', defaultCombo: 'Mod+Shift+M', group: 'Branch' },
    useCallback(() => setMergeOpen(true), []),
  )
  useShortcut(
    { id: 'branch.rebase', label: 'Rebase…', defaultCombo: 'Mod+Alt+R', group: 'Branch' },
    useCallback(() => setRebaseOpen(true), []),
  )

  // Repository
  useShortcut(
    { id: 'repo.open', label: 'Open repository…', defaultCombo: 'Mod+O', group: 'Repository' },
    handleOpenRepo,
  )
  useShortcut(
    { id: 'repo.clone', label: 'Clone…', defaultCombo: 'Mod+Shift+L', group: 'Repository' },
    useCallback(() => setCloneOpen(true), []),
  )
  useShortcut(
    { id: 'repo.settings', label: 'Settings…', defaultCombo: 'Mod+,', group: 'Repository' },
    useCallback(() => setSettingsOpen(true), []),
  )

  // View
  useShortcut(
    { id: 'view.refresh', label: 'Refresh', defaultCombo: 'F5', group: 'View' },
    handleRefresh,
  )
  useShortcut(
    { id: 'view.reflog', label: 'Toggle reflog', defaultCombo: 'Mod+Alt+L', group: 'View' },
    useCallback(() => setReflogOpen((o) => !o), []),
  )

  function handleSelect(c: GitRevision) {
    setSelectedId(c.objectId)
    setShowStaging(false)
  }

  function handlePaletteSelectCommit(c: GitRevision) {
    setPickedCommit(c)
    setSelectedId(c.objectId)
    setShowStaging(false)
  }

  function handleRunPaletteAction(action: PaletteAction) {
    switch (action) {
      case 'pull':       setRemoteAction('pull'); break
      case 'push':       setRemoteAction('push'); break
      case 'fetch':      remoteMutations.fetch.mutate(undefined); break
      case 'new-branch': setCreateBranch({ open: true, from: repoInfo?.currentBranch ?? '' }); break
      case 'merge':      setMergeOpen(true); break
      case 'open-repo':  handleOpenRepo(); break
      case 'settings':   setSettingsOpen(true); break
    }
  }

  function handleCheckout(branch: string) {
    branchMutations.checkout.mutate(branch)
  }

  function handleCreateBranch(name: string, from: string) {
    branchMutations.create.mutate({ name, from })
  }

  function handleDeleteBranch(name: string) {
    if (name === repoInfo?.currentBranch) return
    branchMutations.remove.mutate({ name })
  }

  function handleRemoteConfirm(action: RemoteAction, remote: string, branch: string, force: boolean) {
    if (action === 'pull') {
      remoteMutations.pull.mutate({ remote, branch })
    } else {
      remoteMutations.push.mutate({ remote, branch, force })
    }
  }

  function handleRenameBranchConfirm(oldName: string, newName: string) {
    branchMutations.rename.mutate({ oldName, newName })
  }

  const branchNames = refs.branches.map((b) => b.name)

  if (!repoInfo) return null

  return (
    <main className="h-screen overflow-hidden w-full flex items-stretch">
      <div className="mac-window h-full w-full flex flex-col">
        <TitleBar
          repoName={repoInfo.name}
          repoPath={repoInfo.path}
          currentBranch={repoInfo.currentBranch}
          onOpenPalette={() => setPaletteOpen(true)}
          onFetch={() => remoteMutations.fetch.mutate(undefined)}
          onPull={() => setRemoteAction('pull')}
          onPush={() => setRemoteAction('push')}
          onOpenRepo={async () => { const info = await gitApi.openRepo(); if (info) setRepo(info) }}
          onCloneRepo={() => setCloneOpen(true)}
          onInitRepo={async () => { const info = await gitApi.initRepo(); if (info) setRepo(info) }}
          onCreateBranch={() => setCreateBranch({ open: true, from: repoInfo.currentBranch ?? '' })}
          onRenameBranch={() => { if (repoInfo.currentBranch) setRenameBranchName(repoInfo.currentBranch) }}
          onMerge={() => setMergeOpen(true)}
          onOpenPR={async () => {
            if (!repoPath) return
            const remotes = await gitApi.getRemotes(repoPath)
            const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
            if (!origin) return
            const url = buildPullRequestUrl(origin.fetchUrl || origin.pushUrl, repoInfo.currentBranch)
            if (url) window.appOS.openExternal(url)
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          isFetching={remoteMutations.fetch.isPending}
          isPulling={remoteMutations.pull.isPending}
          isPushing={remoteMutations.push.isPending}
        />

        <div className="flex flex-1 min-h-0">
          <Sidebar
            refs={refs}
            repoName={repoInfo.name}
            currentBranch={repoInfo.currentBranch}
            onCheckout={handleCheckout}
            onCreateBranch={(from) => setCreateBranch({ open: true, from })}
            onDeleteBranch={handleDeleteBranch}
            onRenameBranch={(name) => setRenameBranchName(name)}
            onDeleteTag={(name) => tagMutations.remove.mutate(name)}
            onPushTag={(name) => {
              const remote = remoteNames[0]
              if (remote) tagMutations.push.mutate({ remote, name })
            }}
            onApplyStash={(ref) => stashMutations.apply.mutate(ref)}
            onDropStash={(ref) => stashMutations.drop.mutate(ref)}
            onPopStash={(ref) => stashExtras.pop.mutate(ref)}
            onShowStaging={() => setShowStaging(true)}
            hasChanges={hasChanges}
            onCheckoutRemote={(remoteBranch) => branchExtras.checkoutRemote.mutate({ remoteBranch })}
            onSelectRef={(objectId) => { setSelectedId(objectId); setShowStaging(false) }}
            onSetUpstream={(branch) => setSetUpstreamBranch(branch)}
            onPruneRemote={(remote) => gitApi.pruneRemote(repoPath!, remote)}
          />

          <section className="flex-1 min-w-0 flex overflow-hidden bg-window">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="h-9 border-b border-border flex items-center gap-3 px-3 bg-titlebar/60">
              {repoInfo.currentBranch && (
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <GitBranch className="size-3.5 text-primary" />
                  {repoInfo.currentBranch}
                </div>
              )}
              {repoInfo.isDetachedHead && (
                <span className="text-[11px] text-destructive font-mono">detached HEAD</span>
              )}
              {hasChanges && (
                <button
                  onClick={() => setShowStaging(true)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                    showStaging ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-graph-3" />
                  {status.length} change{status.length !== 1 ? 's' : ''}
                </button>
              )}
              <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <button
                  onClick={() => { setShowStaging(false); setLogFilter((f) => ({ ...f, onlyCurrentBranch: false })) }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${!showStaging && !logFilter.onlyCurrentBranch ? 'bg-muted' : 'hover:bg-muted'}`}
                >
                  All branches
                </button>
                <span className="h-3 w-px bg-border mx-0.5" />
                <button onClick={() => setMergeOpen(true)} className="px-2 py-0.5 rounded-md hover:bg-muted transition-colors">Merge…</button>
                <button onClick={() => setRebaseOpen(true)} className="px-2 py-0.5 rounded-md hover:bg-muted transition-colors">Rebase…</button>
                <button onClick={() => setRemotesOpen(true)} className="px-2 py-0.5 rounded-md hover:bg-muted transition-colors">Remotes…</button>
                <button
                  onClick={() => setReflogOpen((o) => !o)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${reflogOpen ? 'bg-muted' : 'hover:bg-muted'}`}
                >
                  Reflog
                </button>
                <span className="h-3 w-px bg-border mx-0.5" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-muted transition-colors">
                      More <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 max-h-[70vh] overflow-y-auto">
                    <DropdownMenuItem onClick={() => setIRebaseOpen(true)}>Interactive Rebase…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCompareOpen(true)}>Compare branches…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStashOpen(true)}>Stash manager…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPatchOpen('format')}>Format patch…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPatchOpen('apply')}>Apply patch…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSubmodulesOpen(true)}>Submodules…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCleanOpen(true)}>Clean working dir…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setGitignoreFile('gitignore')}>Edit .gitignore</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGitignoreFile('gitattributes')}>Edit .gitattributes</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMailmapOpen(true)}>Edit .mailmap…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setWorktreesOpen(true)}>Worktrees…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSparseOpen(true)}>Sparse checkout…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Archive…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFsckOpen(true)}>Verify (fsck)…</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>Settings…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <LogFilter value={logFilter} onChange={setLogFilter} />

            <CommitGraph
              commits={commits}
              selectedId={showStaging ? null : (selected?.objectId ?? null)}
              onSelect={handleSelect}
              isLoading={logLoading}
              onCreateBranchFrom={(hash) => setCreateBranch({ open: true, from: hash })}
              onCreateTagAt={(hash) => setCreateTagHash(hash)}
              onCherryPick={(hash) => graphMutations.cherryPick.mutate(hash)}
              onRevert={(hash) => graphMutations.revert.mutate(hash)}
              onResetTo={(hash, mode) => graphMutations.reset.mutate({ hash, mode })}
              onCheckoutRevision={(hash) => branchExtras.checkoutRevision.mutate(hash)}
              onReachEnd={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
              isFetchingMore={isFetchingNextPage}
              resetScrollKey={`${repoPath}::${repoInfo.currentBranch ?? 'detached'}::${JSON.stringify(logFilter)}`}
            />

            <div
              onMouseDown={onResizeStart}
              className="h-1 shrink-0 cursor-row-resize group border-t border-border hover:border-primary/60 transition-colors select-none"
            />

            <div style={{ height: detailsPx }} className="flex-none overflow-hidden flex flex-col">
              {showStaging ? (
                <>
                  <ConflictPanel repoPath={repoPath} />
                  <StagingArea
                    repoPath={repoPath}
                    onAddToGitignore={(pattern) => gitignoreMutations.addPattern.mutate(pattern)}
                  />
                </>
              ) : (
                <DetailsPanel commit={selected} repoPath={repoPath} />
              )}
            </div>

            <div className="h-7 border-t border-border bg-titlebar/80 flex items-center gap-3 px-3 text-[10.5px] text-muted-foreground font-mono">
              <span>● {commits.length} commits</span>
              {repoInfo.currentBranch && <span>HEAD → {repoInfo.currentBranch}</span>}
              <span className="ml-auto">NovaGitX</span>
            </div>
            </div>

            {reflogOpen && (
              <div className="w-[340px] shrink-0 border-l border-border overflow-hidden flex flex-col">
                <ReflogPanel
                  repoPath={repoPath}
                  onClose={() => setReflogOpen(false)}
                  onCheckout={(hash) => branchMutations.checkout.mutate(hash)}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        repoPath={repoPath}
        refs={refs}
        commits={commits}
        onCheckout={handleCheckout}
        onCheckoutRemote={(remoteBranch) => branchExtras.checkoutRemote.mutate({ remoteBranch })}
        onSelectCommit={handlePaletteSelectCommit}
        onSelectRef={(objectId) => { setSelectedId(objectId); setShowStaging(false) }}
        onOpenFile={(path) => { if (repoPath) window.appOS.openPath(`${repoPath}/${path}`) }}
        onRunAction={handleRunPaletteAction}
      />

      <CreateBranchDialog
        open={createBranch.open}
        fromBranch={createBranch.from}
        onConfirm={handleCreateBranch}
        onClose={() => setCreateBranch({ open: false, from: '' })}
      />

      <RemoteActionDialog
        action={remoteAction}
        currentBranch={repoInfo.currentBranch}
        remotes={remoteNames}
        onConfirm={handleRemoteConfirm}
        onClose={() => setRemoteAction(null)}
      />

      <CloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} />

      <MergeDialog
        open={mergeOpen}
        branches={branchNames}
        currentBranch={repoInfo.currentBranch}
        onConfirm={(branch, strategy) => branchMerge.mutate({ branch, strategy })}
        onClose={() => setMergeOpen(false)}
      />

      <CreateTagDialog
        open={createTagHash !== null}
        commitHash={createTagHash}
        onConfirm={(name, hash, message) => tagMutations.create.mutate({ name, hash, message })}
        onClose={() => setCreateTagHash(null)}
      />

      <RenameBranchDialog
        open={renameBranchName !== null}
        currentName={renameBranchName ?? ''}
        onConfirm={handleRenameBranchConfirm}
        onClose={() => setRenameBranchName(null)}
      />

      <RebaseDialog
        open={rebaseOpen}
        onOpenChange={setRebaseOpen}
        repoPath={repoPath}
        refs={refs}
        currentBranch={repoInfo.currentBranch}
      />

      <RemotesDialog
        open={remotesOpen}
        onOpenChange={setRemotesOpen}
        repoPath={repoPath}
      />

      {/* Tier 2 dialogs */}
      <InteractiveRebaseDialog
        open={iRebaseOpen}
        onOpenChange={setIRebaseOpen}
        repoPath={repoPath}
        branches={branchNames}
        currentBranch={repoInfo.currentBranch}
      />

      <StashDialog
        open={stashOpen}
        onOpenChange={setStashOpen}
        repoPath={repoPath}
      />

      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        repoPath={repoPath}
        refs={refs}
      />

      <PatchDialog
        open={patchOpen !== null}
        onOpenChange={(o) => { if (!o) setPatchOpen(null) }}
        repoPath={repoPath}
        branches={branchNames}
        currentBranch={repoInfo.currentBranch}
        mode={patchOpen ?? 'format'}
      />

      <SubmodulesDialog
        open={submodulesOpen}
        onOpenChange={setSubmodulesOpen}
        repoPath={repoPath}
      />

      <CleanDialog
        open={cleanOpen}
        onOpenChange={setCleanOpen}
        repoPath={repoPath}
      />

      <GitignoreEditor
        open={gitignoreFile !== null}
        onOpenChange={(o) => { if (!o) setGitignoreFile(null) }}
        repoPath={repoPath}
        file={gitignoreFile ?? 'gitignore'}
      />

      <SetUpstreamDialog
        open={setUpstreamBranch !== null}
        onOpenChange={(o) => { if (!o) setSetUpstreamBranch(null) }}
        repoPath={repoPath}
        branch={setUpstreamBranch ?? ''}
        remotes={remoteNames}
        remoteBranches={remoteBranches}
      />

      <WorktreesDialog open={worktreesOpen} onOpenChange={setWorktreesOpen} repoPath={repoPath} />
      <ArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} repoPath={repoPath} />
      <FsckDialog open={fsckOpen} onOpenChange={setFsckOpen} repoPath={repoPath} />
      <MailmapEditor open={mailmapOpen} onOpenChange={setMailmapOpen} repoPath={repoPath} />
      <SparseCheckoutDialog open={sparseOpen} onOpenChange={setSparseOpen} repoPath={repoPath} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} repoPath={repoPath} />
    </main>
  )
}

function buildPullRequestUrl(remoteUrl: string, branch: string | null): string | null {
  if (!remoteUrl) return null
  // Normalize: git@github.com:owner/repo(.git) → host=github.com, path=owner/repo
  const ssh = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  const https = remoteUrl.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/)
  const m = ssh ?? https
  if (!m) return null
  const host = m[1]
  const path = m[2].replace(/\/$/, '')
  const base = `https://${host}/${path}`
  if (!branch) return base
  if (host.includes('github.com')) return `${base}/pull/new/${encodeURIComponent(branch)}`
  if (host.includes('gitlab')) return `${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(branch)}`
  if (host.includes('bitbucket.org')) return `${base}/pull-requests/new?source=${encodeURIComponent(branch)}`
  return base
}
