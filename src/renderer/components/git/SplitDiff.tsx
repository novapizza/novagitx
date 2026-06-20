import { Columns2, AlignJustify } from 'lucide-react'
import { useMemo } from 'react'
import type { DiffLine } from '@/types/git'
import { useUiStore, type DiffViewMode } from '@/store/uiStore'
import { computeIntraLineSegments, SegmentedText } from '@/lib/wordDiff'

/** A row in the side-by-side view: either a full-width hunk header, or a left/right pair. */
type SplitRow =
  | { kind: 'hunk'; text: string }
  | { kind: 'pair'; left: DiffLine | null; right: DiffLine | null }

/**
 * Convert a flat unified `DiffLine[]` into paired rows for side-by-side rendering.
 * Context lines map to identical left/right cells; a run of deletions followed by
 * additions is zipped row-by-row, with leftover lines rendered against a blank filler.
 */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.type === 'hunk') {
      rows.push({ kind: 'hunk', text: l.text })
      i++
      continue
    }
    if (l.type === 'ctx') {
      rows.push({ kind: 'pair', left: l, right: l })
      i++
      continue
    }
    // Collect the contiguous block of deletions then additions.
    const dels: DiffLine[] = []
    const adds: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'del') dels.push(lines[i++])
    while (i < lines.length && lines[i].type === 'add') adds.push(lines[i++])
    const n = Math.max(dels.length, adds.length)
    for (let k = 0; k < n; k++) {
      rows.push({ kind: 'pair', left: dels[k] ?? null, right: adds[k] ?? null })
    }
  }
  return rows
}

/** Side-by-side (old | new) diff body. Mirrors the unified view's typography. */
export function SplitDiffBody({ lines }: { lines: DiffLine[] }) {
  const rows = toSplitRows(lines)
  const segMap = useMemo(() => computeIntraLineSegments(lines), [lines])
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((row, i) => {
          if (row.kind === 'hunk') {
            return (
              <tr key={i} className="bg-muted/70">
                <td colSpan={4} className="pl-2 pr-4 whitespace-pre text-muted-foreground">
                  {row.text}
                </td>
              </tr>
            )
          }
          const { left, right } = row
          const leftBg = left?.type === 'del' ? 'bg-diff-del' : left ? '' : 'bg-muted/20'
          const rightBg = right?.type === 'add' ? 'bg-diff-add' : right ? '' : 'bg-muted/20'
          const leftFg = left?.type === 'del' ? 'text-diff-del-fg' : 'text-foreground/85'
          const rightFg = right?.type === 'add' ? 'text-diff-add-fg' : 'text-foreground/85'
          return (
            <tr key={i}>
              <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-r border-border/40 align-top">
                {left?.oldLineNum ?? ''}
              </td>
              <td className={`pl-2 pr-4 whitespace-pre align-top ${leftBg} ${leftFg}`}>
                {left && segMap.has(left) ? (
                  <SegmentedText segments={segMap.get(left)!} kind="del" />
                ) : (
                  left?.text ?? ''
                )}
              </td>
              <td className="select-none w-10 text-right pr-2 text-muted-foreground/60 border-l border-r border-border/40 align-top">
                {right?.newLineNum ?? ''}
              </td>
              <td className={`pl-2 pr-4 whitespace-pre align-top ${rightBg} ${rightFg}`}>
                {right && segMap.has(right) ? (
                  <SegmentedText segments={segMap.get(right)!} kind="add" />
                ) : (
                  right?.text ?? ''
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Segmented unified/split toggle, backed by the persisted UI store. */
export function DiffModeToggle() {
  const mode = useUiStore((s) => s.diffViewMode)
  const setMode = useUiStore((s) => s.setDiffViewMode)
  const btn = (m: DiffViewMode, Icon: typeof Columns2, label: string) => (
    <button
      onClick={() => setMode(m)}
      title={`${label} view`}
      className={`flex items-center justify-center size-5 rounded ${
        mode === m ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="size-3" />
    </button>
  )
  return (
    <div className="flex items-center gap-0.5">
      {btn('unified', AlignJustify, 'Unified')}
      {btn('split', Columns2, 'Split')}
    </div>
  )
}
