import { useRef, useState, useEffect, useLayoutEffect, memo } from 'react'
import { flushSync } from 'react-dom'
import type { GitRevision, GitRef } from '@/types/git'
import { hashColor, initials } from '@/types/git'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { GitBranch, Tag, RotateCcw, SkipForward, RefreshCw, Copy, GitCommit } from 'lucide-react'

const ROW_H = 40
const LANE_W = 16
const LEFT_PAD = 14
const OVERSCAN = 10

const laneColor = (lane: number) => `hsl(var(--graph-${(lane % 6) + 1}))`

function relativeTime(unixTime: number): string {
  const s = Math.floor(Date.now() / 1000) - unixTime
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  if (s < 2592000) return `${Math.floor(s / 604800)}w`
  return `${Math.floor(s / 2592000)}mo`
}

interface CommitGraphProps {
  commits: GitRevision[]
  selectedId: string | null
  onSelect: (c: GitRevision) => void
  isLoading?: boolean
  onCreateBranchFrom?: (hash: string) => void
  onCreateTagAt?: (hash: string) => void
  onCherryPick?: (hash: string) => void
  onRevert?: (hash: string) => void
  onResetTo?: (hash: string, mode: 'soft' | 'mixed' | 'hard') => void
  onCheckoutRevision?: (hash: string) => void
  onReachEnd?: () => void
  isFetchingMore?: boolean
  // Identity of the current view (repo + branch + filter). When it changes the graph
  // scrolls back to the top — switching branches should show the newest commits, not
  // wherever the previous view was scrolled to.
  resetScrollKey?: string
}

// Column widths — shared between header and rows so they stay aligned.
// graphW is dynamic (depends on lane count), so it's passed as a prop to rows.
const COL_AUTHOR = 180
const COL_DATE   = 80
const COL_HASH   = 110
const MSG_MIN_W  = 320
const MSG_W_KEY  = 'novagitx-msg-col-width'
// Graph column. Its natural width tracks the widest row's lane count across the
// whole loaded set, so one busy merge region (dozens of concurrent lanes) would
// otherwise force a huge graph on every row and push the messages off-screen.
// Keep the default compact so the message gets the room; the user can drag it
// wider, and the SVG clips any lanes past the column edge.
const GRAPH_MIN_W     = 32
const GRAPH_DEFAULT_MAX = 160
const GRAPH_W_KEY     = 'novagitx-graph-col-width'

export function CommitGraph({
  commits,
  selectedId,
  onSelect,
  isLoading,
  onCreateBranchFrom,
  onCreateTagAt,
  onCherryPick,
  onRevert,
  onResetTo,
  onCheckoutRevision,
  onReachEnd,
  isFetchingMore,
  resetScrollKey,
}: CommitGraphProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)
  const [containerW, setContainerW] = useState(0)
  const readStoredW = (key: string) => {
    const v = localStorage.getItem(key)
    const n = v ? parseInt(v, 10) : NaN
    return Number.isFinite(n) ? n : null
  }
  const [userMsgW, setUserMsgW] = useState<number | null>(() => readStoredW(MSG_W_KEY))
  const [userGraphW, setUserGraphW] = useState<number | null>(() => readStoredW(GRAPH_W_KEY))
  const dragRef = useRef<
    { startX: number; startW: number; min: number; apply: (w: number) => void } | null
  >(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    setContainerW(el.clientWidth)
    const onScroll = () => {
      // flushSync keeps the virtual window in sync with scrollTop on every event —
      // React 18 concurrent mode otherwise defers scroll updates and paints blank rows.
      flushSync(() => setScrollTop(el.scrollTop))
    }
    const ro = new ResizeObserver(() => {
      setViewportH(el.clientHeight)
      setContainerW(el.clientWidth)
    })
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [])

  useEffect(() => {
    if (userMsgW != null) localStorage.setItem(MSG_W_KEY, String(userMsgW))
  }, [userMsgW])

  useEffect(() => {
    if (userGraphW != null) localStorage.setItem(GRAPH_W_KEY, String(userGraphW))
  }, [userGraphW])

  // Scroll coordination. We must NOT scroll on every `commits` change — the list
  // gets a new reference on each background refetch and on every load-more append,
  // and re-running scroll-to-selected then would yank the viewport (jump to the
  // selected row, or snap back to the top while paging). So:
  //   • view switch (resetScrollKey changes) → jump to top, and suppress the
  //     selection scroll that the subsequent reload would otherwise trigger
  //   • selection actually changed (user picked a row) → bring it into view
  //   • anything else (reload, load-more) → leave the scroll position alone
  const prevResetKey = useRef(resetScrollKey)
  const lastScrolledId = useRef<string | null>(selectedId)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevResetKey.current !== resetScrollKey) {
      prevResetKey.current = resetScrollKey
      lastScrolledId.current = selectedId // skip the selection scroll right after a switch
      el.scrollTop = 0
      setScrollTop(0)
      return
    }
    if (!selectedId || lastScrolledId.current === selectedId) return
    const idx = commits.findIndex((c) => c.objectId === selectedId)
    if (idx === -1) return
    lastScrolledId.current = selectedId
    const commitTop = idx * ROW_H
    const commitBottom = commitTop + ROW_H
    if (commitTop < el.scrollTop || commitBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = commitTop - el.clientHeight / 2 + ROW_H / 2
    }
  }, [selectedId, commits, resetScrollKey])

  const maxLanes = commits.reduce((m, c) => Math.max(m, c.lanes.length), 1)
  const naturalGraphW = LEFT_PAD + maxLanes * LANE_W + 8
  // Cap the graph by default so a busy merge region can't push everything right;
  // the user can drag it wider (lanes past the column edge are clipped by the SVG).
  const graphW = userGraphW != null ? Math.max(GRAPH_MIN_W, userGraphW) : Math.min(naturalGraphW, GRAPH_DEFAULT_MAX)
  // Derive message column width from measured container — never rely on CSS flex
  // inside absolutely-positioned rows, which Chromium can misresolve on first paint.
  const naturalMsgW = Math.max(MSG_MIN_W, containerW - graphW - COL_AUTHOR - COL_DATE - COL_HASH)
  const msgW = userMsgW != null ? Math.max(MSG_MIN_W, userMsgW) : naturalMsgW

  function startResize(e: React.MouseEvent, opts: { startW: number; min: number; apply: (w: number) => void }) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: opts.startW, min: opts.min, apply: opts.apply }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const next = dragRef.current.startW + (ev.clientX - dragRef.current.startX)
      dragRef.current.apply(Math.max(dragRef.current.min, Math.round(next)))
    }
    const onUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function resetWidth(apply: (w: null) => void, key: string) {
    apply(null)
    localStorage.removeItem(key)
  }

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const visibleCount = Math.ceil(viewportH / ROW_H) + OVERSCAN * 2
  const endIdx = Math.min(commits.length, startIdx + visibleCount)
  const offsetY = startIdx * ROW_H
  const totalH = commits.length * ROW_H
  const visibleCommits = commits.slice(startIdx, endIdx)
  const totalRowW = msgW + graphW + COL_AUTHOR + COL_DATE + COL_HASH

  // Fetch the next page when scrolled within an overscan window of the bottom.
  // The parent gates onReachEnd on hasNextPage && !isFetching, so extra calls are no-ops.
  useEffect(() => {
    if (!onReachEnd || commits.length === 0) return
    if (totalH - (scrollTop + viewportH) < ROW_H * OVERSCAN) onReachEnd()
  }, [scrollTop, totalH, viewportH, commits.length, onReachEnd])

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto scrollbar-mac">
      {/* Sticky column headers — widths mirror row layout exactly */}
      <div
        className="sticky top-0 z-10 bg-window/95 backdrop-blur border-b border-border flex items-center text-[10.5px] uppercase tracking-wider text-muted-foreground select-none"
        style={{ width: totalRowW }}
      >
        <div className="relative font-semibold px-2 py-2 shrink-0" style={{ width: msgW + graphW }}>
          Graph &amp; Message
          {/* Graph/message boundary — drag to resize the graph column */}
          <div
            onMouseDown={(e) => startResize(e, { startW: graphW, min: GRAPH_MIN_W, apply: setUserGraphW })}
            onDoubleClick={() => resetWidth(setUserGraphW, GRAPH_W_KEY)}
            title="Drag to resize graph · double-click to reset"
            style={{ left: graphW, marginLeft: -3 }}
            className="absolute top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary/70 transition-colors z-20"
          />
          {/* Right edge — drag to resize the message column */}
          <div
            onMouseDown={(e) => startResize(e, { startW: msgW, min: MSG_MIN_W, apply: setUserMsgW })}
            onDoubleClick={() => resetWidth(setUserMsgW, MSG_W_KEY)}
            title="Drag to resize · double-click to reset"
            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary/70 transition-colors z-20"
          />
        </div>
        <div className="font-semibold px-2 py-2 shrink-0" style={{ width: COL_AUTHOR }}>Author</div>
        <div className="font-semibold px-2 py-2 shrink-0" style={{ width: COL_DATE }}>Date</div>
        <div className="font-semibold px-2 py-2 shrink-0" style={{ width: COL_HASH }}>Hash</div>
      </div>

      {/* Fixed-height container establishes exact total scroll height. */}
      {isLoading && commits.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-[13px]">
          Loading commits…
        </div>
      ) : (
        <div style={{ height: totalH + (isFetchingMore ? ROW_H : 0), position: 'relative', width: totalRowW }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: totalRowW, transform: `translateY(${offsetY}px)` }}>
            {visibleCommits.map((c, i) => (
              <CommitRow
                key={c.objectId}
                commit={c}
                next={commits[startIdx + i + 1]}
                graphW={graphW}
                msgW={msgW}
                isSel={c.objectId === selectedId}
                onSelect={onSelect}
                onCheckoutRevision={onCheckoutRevision}
                onCreateBranchFrom={onCreateBranchFrom}
                onCreateTagAt={onCreateTagAt}
                onCherryPick={onCherryPick}
                onRevert={onRevert}
                onResetTo={onResetTo}
              />
            ))}
          </div>
          {isFetchingMore && (
            <div
              className="absolute left-0 flex items-center text-[11px] text-muted-foreground"
              style={{ top: totalH, height: ROW_H, paddingLeft: LEFT_PAD }}
            >
              Loading more…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface RowProps {
  commit: GitRevision
  next?: GitRevision
  graphW: number
  msgW: number
  isSel: boolean
  onSelect: (c: GitRevision) => void
  onCheckoutRevision?: (hash: string) => void
  onCreateBranchFrom?: (hash: string) => void
  onCreateTagAt?: (hash: string) => void
  onCherryPick?: (hash: string) => void
  onRevert?: (hash: string) => void
  onResetTo?: (hash: string, mode: 'soft' | 'mixed' | 'hard') => void
}

const CommitRow = memo(function CommitRow({
  commit: c,
  next,
  graphW,
  msgW,
  isSel,
  onSelect,
  onCheckoutRevision,
  onCreateBranchFrom,
  onCreateTagAt,
  onCherryPick,
  onRevert,
  onResetTo,
}: RowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => onSelect(c)}
          style={{ height: ROW_H }}
          className={`flex items-center cursor-pointer transition-colors border-b border-border/30 ${isSel ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
        >
          <div className="flex items-center overflow-hidden shrink-0" style={{ width: graphW + msgW }}>
            <GraphCell commit={c} next={next} graphW={graphW} />
            <Refs refs={c.refs} />
            <span className="truncate text-[12px] text-foreground/90 pr-2">{c.subject}</span>
          </div>
          <div className="shrink-0 px-2" style={{ width: COL_AUTHOR }}>
            <Author author={c.author} />
          </div>
          <div className="shrink-0 px-2 text-muted-foreground font-mono text-[11px]" style={{ width: COL_DATE }}>
            {relativeTime(c.authorUnixTime)}
          </div>
          <div className="shrink-0 px-2 text-muted-foreground/80 font-mono text-[11px]" style={{ width: COL_HASH }}>
            {c.objectId.slice(0, 8)}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(c.objectId)}>
          <Copy className="size-3.5 mr-2" />
          Copy hash
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCheckoutRevision?.(c.objectId)}>
          <GitCommit className="size-3.5 mr-2" />
          Checkout (detach HEAD)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCreateBranchFrom?.(c.objectId)}>
          <GitBranch className="size-3.5 mr-2" />
          New branch from here
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCreateTagAt?.(c.objectId)}>
          <Tag className="size-3.5 mr-2" />
          Create tag here
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCherryPick?.(c.objectId)}>
          <SkipForward className="size-3.5 mr-2" />
          Cherry-pick
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRevert?.(c.objectId)}>
          <RotateCcw className="size-3.5 mr-2" />
          Revert commit
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <RefreshCw className="size-3.5 mr-2" />
            Reset to here
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onResetTo?.(c.objectId, 'soft')}>Soft — keep staged</ContextMenuItem>
            <ContextMenuItem onClick={() => onResetTo?.(c.objectId, 'mixed')}>Mixed — keep unstaged</ContextMenuItem>
            <ContextMenuItem onClick={() => onResetTo?.(c.objectId, 'hard')} className="text-destructive focus:text-destructive">
              Hard — discard all changes
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
})

const REF_STYLES: Record<string, string> = {
  isHead:  'bg-graph-2/15 text-[hsl(var(--graph-2))] border-graph-2/40',
  head:    'bg-primary/15 text-primary border-primary/40',
  remote:  'bg-graph-3/15 text-[hsl(var(--graph-3))] border-graph-3/40',
  tag:     'bg-graph-4/15 text-[hsl(var(--graph-4))] border-graph-4/40',
}

const Refs = memo(function Refs({ refs }: { refs: GitRef[] | undefined }) {
  if (!refs?.length) return null
  return (
    <div className="flex items-center gap-1 mr-2 shrink-0">
      {refs.map((r) => {
        const styleKey = r.isHead ? 'isHead' : r.type
        return (
          <span
            key={r.completeName}
            className={`inline-flex items-center px-1.5 py-px rounded-[5px] border text-[10.5px] font-medium font-mono ${REF_STYLES[styleKey] ?? REF_STYLES.tag}`}
          >
            {r.name}
          </span>
        )
      })}
    </div>
  )
})

const Author = memo(function Author({ author }: { author: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="size-5 shrink-0 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white"
        style={{ background: hashColor(author) }}
      >
        {initials(author)}
      </span>
      <span className="truncate text-[11.5px] text-foreground/85">{author}</span>
    </div>
  )
})

const GraphCell = memo(function GraphCell({ commit, next, graphW }: { commit: GitRevision; next?: GitRevision; graphW: number }) {
  const cy = ROW_H / 2
  const dotX = LEFT_PAD + commit.branchLane * LANE_W
  const nextLanes = next ? new Set(next.lanes) : null
  const commitLanes = new Set(commit.lanes)

  return (
    <svg width={graphW} height={ROW_H} className="shrink-0">
      {commit.lanes.map((lane) => {
        const x = LEFT_PAD + lane * LANE_W
        const goesDown = nextLanes?.has(lane) ?? false
        return (
          <g key={lane}>
            <line x1={x} y1={0} x2={x} y2={cy} stroke={laneColor(lane)} strokeWidth={1.75} opacity={0.85} />
            {goesDown && (
              <line x1={x} y1={cy} x2={x} y2={ROW_H} stroke={laneColor(lane)} strokeWidth={1.75} opacity={0.85} />
            )}
          </g>
        )
      })}
      {nextLanes &&
        [...nextLanes]
          .filter((l) => !commitLanes.has(l))
          .map((l) => {
            const x2 = LEFT_PAD + l * LANE_W
            return (
              <path
                key={`m-${l}`}
                d={`M ${dotX} ${cy} C ${dotX} ${ROW_H}, ${x2} ${cy}, ${x2} ${ROW_H}`}
                stroke={laneColor(l)}
                strokeWidth={1.75}
                fill="none"
                opacity={0.85}
              />
            )
          })}
      <circle cx={dotX} cy={cy} r={4.5} fill={laneColor(commit.branchLane)} stroke="hsl(var(--window))" strokeWidth={2} />
    </svg>
  )
})
