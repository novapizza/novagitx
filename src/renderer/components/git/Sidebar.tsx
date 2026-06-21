import { ChevronRight, GitBranch, Cloud, Tag, Archive, Folder, GitMerge, Trash2, Plus, RotateCcw, FolderOpen, ChevronDown, Pencil, Upload, ArrowDownToLine, Link, Scissors, X } from 'lucide-react'
import { useState } from 'react'
import type { RefGroups, GitRef } from '@/types/git'
import { initials, hashColor } from '@/types/git'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRepoStore } from '@/store/repoStore'
import { useUiStore } from '@/store/uiStore'
import { gitApi } from '@/api/git'

// A node in the branch name tree. Leaves carry a `branch`; folders carry `children`.
// Git refs can't be both a path and a prefix (e.g. `feat` and `feat/x` can't coexist),
// so a node is always either a leaf or a folder, never both.
interface BranchNode {
  name: string // last path segment, shown as the label
  path: string // full prefix up to this node, used as React key
  branch?: GitRef
  children: BranchNode[]
}

function buildBranchTree(branches: GitRef[]): BranchNode[] {
  const root: BranchNode = { name: '', path: '', children: [] }
  for (const b of branches) {
    const parts = b.name.split('/')
    let node = root
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = { name: part, path, children: [] }
        node.children.push(child)
      }
      if (isLeaf) child.branch = b
      node = child
    })
  }
  return sortNodes(root.children)
}

// Folders first, then leaves; alphabetical within each. Recurses into folders.
function sortNodes(nodes: BranchNode[]): BranchNode[] {
  nodes.sort((a, b) => {
    const aFolder = a.children.length > 0
    const bFolder = b.children.length > 0
    if (aFolder !== bFolder) return aFolder ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) if (n.children.length) sortNodes(n.children)
  return nodes
}

interface BranchTreeProps {
  nodes: BranchNode[]
  depth: number
  currentBranch: string | null
  onCheckout: (branch: string) => void
  onCreateBranch: (from: string) => void
  onDeleteBranch: (name: string) => void
  onRenameBranch?: (name: string) => void
  onSetUpstream?: (branch: string) => void
}

function BranchTree(props: BranchTreeProps) {
  const { nodes, depth, currentBranch, onCheckout, onCreateBranch, onDeleteBranch, onRenameBranch, onSetUpstream } = props
  // 12px base (matches the flat pl-3) + 14px per nesting level.
  const indentPx = 12 + depth * 14
  return (
    <>
      {nodes.map((node) =>
        node.children.length ? (
          <BranchFolder key={node.path} label={node.name} indentPx={indentPx}>
            <BranchTree {...props} nodes={node.children} depth={depth + 1} />
          </BranchFolder>
        ) : (
          node.branch && (
            <BranchItem
              key={node.path}
              branch={node.branch}
              label={node.name}
              indentPx={indentPx}
              active={node.branch.name === currentBranch}
              onCheckout={() => onCheckout(node.branch!.name)}
              onCreateFrom={() => onCreateBranch(node.branch!.name)}
              onDelete={() => onDeleteBranch(node.branch!.name)}
              onRename={onRenameBranch ? () => onRenameBranch(node.branch!.name) : undefined}
              onSetUpstream={onSetUpstream ? () => onSetUpstream(node.branch!.name) : undefined}
            />
          )
        )
      )}
    </>
  )
}

interface RemoteBranchTreeProps {
  nodes: BranchNode[]
  depth: number
  onSelectRef?: (objectId: string) => void
  onCheckoutRemote?: (remoteBranch: string) => void
}

// Same folder-tree rendering as BranchTree, but leaves are RemoteBranchItems.
// Branches sit one level under the remote's Group, so the base indent is deeper.
function RemoteBranchTree(props: RemoteBranchTreeProps) {
  const { nodes, depth, onSelectRef, onCheckoutRemote } = props
  // 28px base (matches the flat pl-7) + 14px per nesting level.
  const indentPx = 28 + depth * 14
  return (
    <>
      {nodes.map((node) =>
        node.children.length ? (
          <BranchFolder key={node.path} label={node.name} indentPx={indentPx}>
            <RemoteBranchTree {...props} nodes={node.children} depth={depth + 1} />
          </BranchFolder>
        ) : (
          node.branch && (
            <RemoteBranchItem
              key={node.path}
              branch={node.branch}
              label={node.name}
              indentPx={indentPx}
              onSelect={onSelectRef ? () => onSelectRef(node.branch!.objectId) : undefined}
              onCheckout={
                onCheckoutRemote
                  ? () => onCheckoutRemote(node.branch!.completeName.replace('refs/remotes/', ''))
                  : undefined
              }
            />
          )
        )
      )}
    </>
  )
}

function BranchFolder({ label, indentPx, children }: { label: string; indentPx: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ paddingLeft: indentPx }}
        className="w-full flex items-center gap-1 pr-2 py-1 rounded-md text-[12px] text-sidebar-foreground hover:bg-sidebar-hover"
      >
        <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Folder className="size-3.5 shrink-0 text-graph-3" />
        <span className="truncate font-medium">{label}</span>
      </button>
      {open && <div className="space-y-px">{children}</div>}
    </div>
  )
}

interface SidebarProps {
  refs: RefGroups
  repoName: string
  currentBranch: string | null
  onCheckout: (branch: string) => void
  onCreateBranch: (from: string) => void
  onDeleteBranch: (name: string) => void
  onRenameBranch?: (name: string) => void
  onDeleteTag?: (name: string) => void
  onPushTag?: (name: string) => void
  onApplyStash: (ref: string) => void
  onDropStash: (ref: string) => void
  onShowStaging: () => void
  hasChanges: boolean
  onCheckoutRemote?: (remoteBranch: string) => void
  onSelectRef?: (objectId: string) => void
  onSetUpstream?: (branch: string) => void
  onPruneRemote?: (remote: string) => void
  onPopStash?: (ref: string) => void
  width?: number
}

export function Sidebar({
  refs,
  repoName,
  currentBranch,
  onCheckout,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onDeleteTag,
  onPushTag,
  onApplyStash,
  onDropStash,
  onShowStaging,
  hasChanges,
  onCheckoutRemote,
  onSelectRef,
  onSetUpstream,
  onPruneRemote,
  onPopStash,
  width = 260,
}: SidebarProps) {
  const abbr = initials(repoName)
  const { recentRepos, setRepo, removeRecent } = useRepoStore()
  const branchView = useUiStore((s) => s.branchView)
  const [switchLoading, setSwitchLoading] = useState(false)

  const remoteGroups = refs.remotes.reduce<Record<string, GitRef[]>>((acc, r) => {
    ;(acc[r.remote] ||= []).push(r)
    return acc
  }, {})

  async function openRepo() {
    setSwitchLoading(true)
    try {
      const info = await gitApi.openRepo()
      if (info) setRepo(info)
    } finally {
      setSwitchLoading(false)
    }
  }

  async function switchToPath(path: string) {
    setSwitchLoading(true)
    try {
      const info = await gitApi.getRepoInfo(path)
      setRepo(info)
    } finally {
      setSwitchLoading(false)
    }
  }

  // Other repos in the recent list (not current)
  const otherRepos = recentRepos.filter((r) => r.path !== recentRepos.find((x) => x.name === repoName)?.path)

  return (
    <aside style={{ width }} className="vibrancy shrink-0 border-r border-sidebar-border flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-hover/60 hover:bg-sidebar-hover transition-colors">
              <div
                className="size-6 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                style={{ background: hashColor(repoName) }}
              >
                {abbr}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[12px] font-semibold text-sidebar-foreground truncate">{repoName}</div>
                {currentBranch && (
                  <div className="text-[10.5px] text-sidebar-muted truncate">{currentBranch}</div>
                )}
              </div>
              <ChevronDown className="size-3.5 text-sidebar-muted shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            {otherRepos.map((r) => (
              <DropdownMenuItem
                key={r.path}
                onClick={() => switchToPath(r.path)}
                disabled={switchLoading}
                className="group flex items-center gap-2 py-2"
              >
                <div className="flex flex-col items-start gap-0 min-w-0 flex-1">
                  <span className="text-[12.5px] font-medium truncate w-full">{r.name}</span>
                  <span className="text-[10.5px] text-muted-foreground font-mono truncate w-full">{r.path}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    removeRecent(r.path)
                  }}
                  title="Remove from recent"
                  aria-label={`Remove ${r.name} from recent`}
                  className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-opacity shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            {otherRepos.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={openRepo} disabled={switchLoading}>
              <FolderOpen className="size-3.5 mr-2" />
              Open another repository…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-mac px-1.5 pb-3 space-y-3">
        {/* Working tree shortcut */}
        <button
          onClick={onShowStaging}
          className="w-full flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-md text-[12px] transition-colors text-sidebar-foreground hover:bg-sidebar-hover"
        >
          <GitMerge className="size-3.5 text-sidebar-muted" />
          <span className="truncate">Working Tree</span>
          {hasChanges && (
            <span className="ml-auto size-2 rounded-full bg-graph-3 shrink-0" />
          )}
        </button>

        <Section icon={GitBranch} label="Branches" defaultOpen>
          {branchView === 'grouped' ? (
            <BranchTree
              nodes={buildBranchTree(refs.branches)}
              depth={0}
              currentBranch={currentBranch}
              onCheckout={onCheckout}
              onCreateBranch={onCreateBranch}
              onDeleteBranch={onDeleteBranch}
              onRenameBranch={onRenameBranch}
              onSetUpstream={onSetUpstream}
            />
          ) : (
            refs.branches.map((b) => (
              <BranchItem
                key={b.completeName}
                branch={b}
                active={b.name === currentBranch}
                onCheckout={() => onCheckout(b.name)}
                onCreateFrom={() => onCreateBranch(b.name)}
                onDelete={() => onDeleteBranch(b.name)}
                onRename={onRenameBranch ? () => onRenameBranch(b.name) : undefined}
                onSetUpstream={onSetUpstream ? () => onSetUpstream(b.name) : undefined}
              />
            ))
          )}
        </Section>

        <Section icon={Cloud} label="Remotes" defaultOpen>
          {Object.entries(remoteGroups).map(([remote, branches]) => (
            <Group
              key={remote}
              label={remote}
              defaultOpen
              onPrune={onPruneRemote ? () => onPruneRemote(remote) : undefined}
            >
              {branchView === 'grouped' ? (
                <RemoteBranchTree
                  nodes={buildBranchTree(branches)}
                  depth={0}
                  onSelectRef={onSelectRef}
                  onCheckoutRemote={onCheckoutRemote}
                />
              ) : (
                branches.map((b) => (
                  <RemoteBranchItem
                    key={b.completeName}
                    branch={b}
                    onSelect={onSelectRef ? () => onSelectRef(b.objectId) : undefined}
                    onCheckout={onCheckoutRemote ? () => onCheckoutRemote(b.completeName.replace('refs/remotes/', '')) : undefined}
                  />
                ))
              )}
            </Group>
          ))}
        </Section>

        {refs.tags.length > 0 && (
          <Section icon={Tag} label="Tags">
            {refs.tags.map((t) => (
              <TagItem
                key={t.completeName}
                tag={t}
                onSelect={onSelectRef ? () => onSelectRef(t.commitId) : undefined}
                onDelete={onDeleteTag ? () => onDeleteTag(t.name) : undefined}
                onPush={onPushTag ? () => onPushTag(t.name) : undefined}
              />
            ))}
          </Section>
        )}

        {refs.stashes.length > 0 && (
          <Section icon={Archive} label="Stashes">
            {refs.stashes.map((s) => (
              <StashItem
                key={s.completeName}
                stash={s}
                onApply={() => onApplyStash(s.completeName)}
                onDrop={() => onDropStash(s.completeName)}
                onPop={onPopStash ? () => onPopStash(s.completeName) : undefined}
              />
            ))}
          </Section>
        )}
      </div>

      <div className="border-t border-sidebar-border px-3 py-2 flex items-center gap-2 text-[11px] text-sidebar-muted">
        <span className="size-1.5 rounded-full bg-graph-2" />
        {refs.branches.length} branches · {refs.tags.length} tags
      </div>
    </aside>
  )
}

function BranchItem({
  branch,
  active,
  label,
  indentPx = 12,
  onCheckout,
  onCreateFrom,
  onDelete,
  onRename,
  onSetUpstream,
}: {
  branch: GitRef
  active: boolean
  label?: string // shown instead of branch.name (grouped view shows the leaf segment)
  indentPx?: number
  onCheckout: () => void
  onCreateFrom: () => void
  onDelete: () => void
  onRename?: () => void
  onSetUpstream?: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onCheckout}
          style={{ paddingLeft: indentPx }}
          className={`w-full flex items-center gap-1.5 pr-2 py-1 rounded-md text-[12px] transition-colors ${
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
              : 'text-sidebar-foreground hover:bg-sidebar-hover'
          }`}
        >
          <GitBranch className={`size-3.5 shrink-0 ${active ? '' : 'text-sidebar-muted'}`} />
          <span className="truncate">{label ?? branch.name}</span>
          {(branch.ahead !== undefined || branch.behind !== undefined) && (
            <span className={`ml-auto flex items-center gap-0.5 text-[10px] font-mono shrink-0 ${active ? 'text-primary-foreground/70' : 'text-sidebar-muted'}`}>
              {branch.ahead !== undefined && branch.ahead > 0 && <span className="text-graph-2">↑{branch.ahead}</span>}
              {branch.behind !== undefined && branch.behind > 0 && <span className="text-graph-3">↓{branch.behind}</span>}
            </span>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onCheckout} disabled={active}>
          <GitBranch className="size-3.5 mr-2" />
          Checkout
        </ContextMenuItem>
        <ContextMenuItem onClick={onCreateFrom}>
          <Plus className="size-3.5 mr-2" />
          New branch from here
        </ContextMenuItem>
        {onRename && (
          <ContextMenuItem onClick={onRename}>
            <Pencil className="size-3.5 mr-2" />
            Rename branch
          </ContextMenuItem>
        )}
        {onSetUpstream && (
          <ContextMenuItem onClick={onSetUpstream}>
            <Link className="size-3.5 mr-2" />
            Set upstream…
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          disabled={active}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-3.5 mr-2" />
          Delete branch
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function TagItem({
  tag,
  onSelect,
  onDelete,
  onPush,
}: {
  tag: GitRef
  onSelect?: () => void
  onDelete?: () => void
  onPush?: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className="w-full flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-md text-[12px] transition-colors text-sidebar-foreground hover:bg-sidebar-hover"
        >
          <Tag className="size-3.5 shrink-0 text-sidebar-muted" />
          <span className="truncate">{tag.name}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {onPush && (
          <ContextMenuItem onClick={onPush}>
            <Upload className="size-3.5 mr-2" />
            Push tag
          </ContextMenuItem>
        )}
        {onPush && onDelete && <ContextMenuSeparator />}
        {onDelete && (
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="size-3.5 mr-2" />
            Delete tag
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Section({ icon: Icon, label, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-sidebar-muted hover:text-sidebar-foreground"
      >
        <ChevronRight className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon className="size-3" />
        {label}
      </button>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  )
}

function Group({ label, children, defaultOpen = false, onPrune }: any) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => setOpen((o: boolean) => !o)}
            className="w-full flex items-center gap-1 pl-3 pr-2 py-1 rounded-md text-[12px] text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <ChevronRight className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`} />
            <Folder className="size-3.5 text-graph-3" />
            <span className="font-medium">{label}</span>
          </button>
        </ContextMenuTrigger>
        {onPrune && (
          <ContextMenuContent className="w-40">
            <ContextMenuItem onClick={onPrune}>
              <Scissors className="size-3.5 mr-2" />
              Prune remote
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
      {open && <div className="space-y-px">{children}</div>}
    </div>
  )
}

function RemoteBranchItem({
  branch,
  label,
  indentPx = 28,
  onSelect,
  onCheckout,
}: {
  branch: GitRef
  label?: string // shown instead of branch.name (grouped view shows the leaf segment)
  indentPx?: number
  onSelect?: () => void
  onCheckout?: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          style={{ paddingLeft: indentPx }}
          className="w-full flex items-center gap-1.5 pr-2 py-1 rounded-md text-[12px] transition-colors text-sidebar-foreground hover:bg-sidebar-hover"
        >
          <Cloud className="size-3.5 shrink-0 text-sidebar-muted" />
          <span className="truncate">{label ?? branch.name}</span>
        </button>
      </ContextMenuTrigger>
      {onCheckout && (
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onCheckout}>
            <ArrowDownToLine className="size-3.5 mr-2" />
            Checkout tracking branch
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}

function StashItem({
  stash,
  onApply,
  onDrop,
  onPop,
}: {
  stash: GitRef
  onApply: () => void
  onDrop: () => void
  onPop?: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button className="w-full flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-md text-[12px] transition-colors text-sidebar-foreground hover:bg-sidebar-hover">
          <Archive className="size-3.5 shrink-0 text-sidebar-muted" />
          <span className="truncate">{stash.name}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {onPop && (
          <ContextMenuItem onClick={onPop}>
            <ArrowDownToLine className="size-3.5 mr-2" />
            Pop stash
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={onApply}>
          <RotateCcw className="size-3.5 mr-2" />
          Apply stash
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDrop} className="text-destructive focus:text-destructive">
          <Trash2 className="size-3.5 mr-2" />
          Drop stash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function Item({
  icon: Icon,
  label,
  muted,
  active,
  indent,
  onClick,
}: {
  icon: any
  label: string
  muted?: string
  active?: boolean
  indent?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 ${indent ? 'pl-7' : 'pl-3'} pr-2 py-1 rounded-md text-[12px] transition-colors ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-hover'
      }`}
    >
      <Icon className={`size-3.5 shrink-0 ${active ? '' : 'text-sidebar-muted'}`} />
      <span className="truncate">{label}</span>
      {muted && (
        <span className={`ml-auto text-[10.5px] font-mono ${active ? 'text-primary-foreground/80' : 'text-sidebar-muted'}`}>
          {muted}
        </span>
      )}
    </button>
  )
}
