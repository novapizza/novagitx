import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, GitBranch, GitCommit, Tag, FileText, ArrowRight, Cloud,
  ArrowDownToLine, ArrowUpFromLine, RotateCw, GitMerge, FolderOpen, Settings2, Loader2,
} from 'lucide-react'
import type { RefGroups, GitRevision } from '@/types/git'
import { useTrackedFiles, useCommitSearch } from '@/hooks/useRepo'

export type PaletteAction = 'pull' | 'push' | 'fetch' | 'new-branch' | 'merge' | 'open-repo' | 'settings'

type Item = {
  key: string
  icon: typeof Search
  label: string
  sublabel?: string
  hint: string
  run: () => void
  idx?: number
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  repoPath: string | null
  refs: RefGroups
  commits: GitRevision[]
  onCheckout: (branch: string) => void
  onCheckoutRemote: (remoteBranch: string) => void
  onSelectCommit: (c: GitRevision) => void
  onSelectRef: (objectId: string) => void
  onOpenFile: (path: string) => void
  onRunAction: (action: PaletteAction) => void
}

// Per-group caps so one source can't crowd the others out of view.
const CAP = { branches: 8, remotes: 6, tags: 6, commits: 12, files: 12 }

const ACTIONS: { id: PaletteAction; icon: typeof Search; label: string; hint: string }[] = [
  { id: 'pull',       icon: ArrowDownToLine, label: 'Pull from remote',  hint: '⌘⇧P' },
  { id: 'push',       icon: ArrowUpFromLine, label: 'Push to remote',    hint: '⌘⇧U' },
  { id: 'fetch',      icon: RotateCw,        label: 'Fetch from remote', hint: '⌘⇧F' },
  { id: 'new-branch', icon: GitBranch,       label: 'New branch…',       hint: '⌘⇧B' },
  { id: 'merge',      icon: GitMerge,        label: 'Merge a branch…',   hint: '⌘⇧M' },
  { id: 'open-repo',  icon: FolderOpen,      label: 'Open repository…',  hint: '⌘O'  },
  { id: 'settings',   icon: Settings2,       label: 'Settings…',         hint: '⌘,'  },
]

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export function CommandPalette({
  open, onClose, repoPath, refs, commits,
  onCheckout, onCheckoutRemote, onSelectCommit, onSelectRef, onOpenFile, onRunAction,
}: CommandPaletteProps) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Tracked files (loaded while open) + full-history commit search (debounced).
  const { data: files = [], isFetching: filesFetching } = useTrackedFiles(repoPath, open)
  const { data: searchedCommits = [], isFetching: commitsFetching } = useCommitSearch(repoPath, debouncedQ)

  // Reset query when the palette closes.
  useEffect(() => {
    if (!open) { setQ(''); setDebouncedQ('') }
  }, [open])

  // Debounce the query that drives the backend commit search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  // Reset the active row whenever the query changes.
  useEffect(() => { setActive(0) }, [q])

  const ql = q.trim().toLowerCase()

  const groups = useMemo(() => {
    const close = onClose
    const groups: { name: string; items: Item[] }[] = []

    // Branches — always shown (all when empty, filtered otherwise).
    const branches = refs.branches
      .filter((b) => !ql || b.name.toLowerCase().includes(ql))
      .slice(0, CAP.branches)
      .map<Item>((b) => ({
        key: `branch:${b.completeName}`,
        icon: GitBranch,
        label: b.name,
        hint: b.isHead ? 'current' : 'checkout',
        run: () => { onCheckout(b.name); close() },
      }))
    if (branches.length) groups.push({ name: 'Branches', items: branches })

    // The remaining sources only appear once there's a query (keeps the empty state tidy).
    if (ql) {
      const remotes = refs.remotes
        .filter((r) => r.completeName.toLowerCase().includes(ql))
        .slice(0, CAP.remotes)
        .map<Item>((r) => {
          const name = r.completeName.replace('refs/remotes/', '')
          return {
            key: `remote:${r.completeName}`,
            icon: Cloud,
            label: name,
            hint: 'checkout',
            run: () => { onCheckoutRemote(name); close() },
          }
        })
      if (remotes.length) groups.push({ name: 'Remote branches', items: remotes })

      const tags = refs.tags
        .filter((t) => t.name.toLowerCase().includes(ql))
        .slice(0, CAP.tags)
        .map<Item>((t) => ({
          key: `tag:${t.completeName}`,
          icon: Tag,
          label: t.name,
          hint: t.commitId.slice(0, 8),
          run: () => { onSelectRef(t.commitId); close() },
        }))
      if (tags.length) groups.push({ name: 'Tags', items: tags })
    }

    // Commits — merge loaded matches (cover subject/author/hash) with backend
    // message search (covers history beyond the loaded window). Dedupe by hash.
    const matchCommit = (c: GitRevision) =>
      c.subject.toLowerCase().includes(ql) ||
      c.author.toLowerCase().includes(ql) ||
      c.objectId.startsWith(ql) ||
      (c.body?.toLowerCase().includes(ql) ?? false)
    const loaded = ql ? commits.filter(matchCommit) : commits.slice(0, 8)
    const seen = new Set<string>()
    const commitItems: Item[] = []
    for (const c of [...loaded, ...(ql ? searchedCommits : [])]) {
      if (seen.has(c.objectId)) continue
      seen.add(c.objectId)
      commitItems.push({
        key: `commit:${c.objectId}`,
        icon: GitCommit,
        label: c.subject,
        sublabel: c.author,
        hint: c.objectId.slice(0, 8),
        run: () => { onSelectCommit(c); close() },
      })
      if (commitItems.length >= CAP.commits) break
    }
    if (commitItems.length) groups.push({ name: 'Commits', items: commitItems })

    // Files — only when searching (the full tree is too long for an empty query).
    if (ql) {
      const fileItems = files
        .filter((f) => f.toLowerCase().includes(ql))
        .sort((a, b) => {
          // Prefer matches in the filename over matches deep in the path.
          const ab = basename(a).toLowerCase().includes(ql) ? 0 : 1
          const bb = basename(b).toLowerCase().includes(ql) ? 0 : 1
          return ab - bb || a.length - b.length
        })
        .slice(0, CAP.files)
        .map<Item>((f) => ({
          key: `file:${f}`,
          icon: FileText,
          label: basename(f),
          sublabel: f,
          hint: 'open',
          run: () => { onOpenFile(f); close() },
        }))
      if (fileItems.length) groups.push({ name: 'Files', items: fileItems })
    }

    // Actions — filtered by label.
    const actions = ACTIONS
      .filter((a) => !ql || a.label.toLowerCase().includes(ql))
      .map<Item>((a) => ({
        key: `action:${a.id}`,
        icon: a.icon,
        label: a.label,
        hint: a.hint,
        run: () => { onRunAction(a.id); close() },
      }))
    if (actions.length) groups.push({ name: 'Actions', items: actions })

    return groups
  }, [ql, refs, commits, searchedCommits, files, onCheckout, onCheckoutRemote, onSelectCommit, onSelectRef, onOpenFile, onRunAction, onClose])

  // Flatten in display order and stamp each item with its global index for nav.
  const flat = useMemo(() => {
    let idx = 0
    const flat: Item[] = []
    for (const g of groups) for (const it of g.items) { it.idx = idx++; flat.push(it) }
    return flat
  }, [groups])

  const safeActive = flat.length ? Math.min(active, flat.length - 1) : 0
  const loading = commitsFetching || filesFetching

  // Keep the active row visible.
  useEffect(() => {
    itemRefs.current[safeActive]?.scrollIntoView({ block: 'nearest' })
  }, [safeActive])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flat[safeActive]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-[min(640px,92vw)] mac-window flex flex-col max-h-[60vh]"
      >
        <div className="flex items-center gap-2 px-3 h-12 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search commits, branches, tags, files & actions…"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" />}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10.5px] font-mono shrink-0">esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-mac py-1.5">
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                {g.name}
              </div>
              {g.items.map((it) => {
                const isActive = it.idx === safeActive
                return (
                  <button
                    key={it.key}
                    ref={(el) => { itemRefs.current[it.idx!] = el }}
                    onClick={it.run}
                    onMouseMove={() => setActive(it.idx!)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <it.icon className={`size-3.5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span className="truncate">{it.label}</span>
                    {it.sublabel && (
                      <span className={`truncate text-[11px] ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                        {it.sublabel}
                      </span>
                    )}
                    <span className={`ml-auto shrink-0 text-[10.5px] font-mono ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {it.hint}
                    </span>
                    <ArrowRight className={`size-3 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                )
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
              {loading ? 'Searching…' : ql ? 'No results' : 'Type to search'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-3 h-8 border-t border-border text-[10.5px] text-muted-foreground">
          <span><kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↵</kbd> select</span>
          <span className="ml-auto">NovaGitX</span>
        </div>
      </div>
    </div>
  )
}
