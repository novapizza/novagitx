import type { DiffLine } from '@/types/git'

/** A run of text within a diff line, flagged as changed (highlight) or not. */
export interface Seg {
  text: string
  changed: boolean
}

// Split into words, whitespace runs, and individual punctuation so highlights
// stay tight (only the token that actually changed, not the whole line).
function tokenize(s: string): string[] {
  return s.match(/\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) ?? []
}

function pushSeg(arr: Seg[], text: string, changed: boolean): void {
  const last = arr[arr.length - 1]
  if (last && last.changed === changed) last.text += text
  else arr.push({ text, changed })
}

/**
 * Token-level LCS diff of two strings → changed/unchanged segments for each
 * side. Used to highlight exactly what differs between a paired -/+ line.
 */
export function diffTokens(a: string, b: string): { del: Seg[]; add: Seg[] } {
  const at = tokenize(a)
  const bt = tokenize(b)
  const n = at.length
  const m = bt.length

  // dp[i][j] = LCS length of at[i:] and bt[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = at[i] === bt[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const del: Seg[] = []
  const add: Seg[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      pushSeg(del, at[i], false)
      pushSeg(add, bt[j], false)
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(del, at[i], true)
      i++
    } else {
      pushSeg(add, bt[j], true)
      j++
    }
  }
  while (i < n) pushSeg(del, at[i++], true)
  while (j < m) pushSeg(add, bt[j++], true)
  return { del, add }
}

const MAX_LINE = 2000 // skip word-diffing pathologically long lines (e.g. minified)

/**
 * Build a per-line segment map keyed by the original `DiffLine` object, so the
 * same result works for both the flat unified view and the paired split view.
 * A contiguous run of deletions is paired by index with the following run of
 * additions (mirroring the side-by-side layout); each pair is word-diffed.
 * Lines that changed entirely (no shared tokens) are left out — highlighting
 * the whole line adds nothing.
 */
export function computeIntraLineSegments(lines: DiffLine[]): Map<DiffLine, Seg[]> {
  const map = new Map<DiffLine, Seg[]>()
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== 'del') { i++; continue }
    const delStart = i
    while (i < lines.length && lines[i].type === 'del') i++
    const addStart = i
    while (i < lines.length && lines[i].type === 'add') i++

    const pairs = Math.min(addStart - delStart, i - addStart)
    for (let k = 0; k < pairs; k++) {
      const dLine = lines[delStart + k]
      const aLine = lines[addStart + k]
      if (dLine.text.length > MAX_LINE || aLine.text.length > MAX_LINE) continue
      const { del, add } = diffTokens(dLine.text, aLine.text)
      // Only worthwhile when some text is shared on both sides.
      if (del.some((s) => !s.changed) && add.some((s) => !s.changed)) {
        map.set(dLine, del)
        map.set(aLine, add)
      }
    }
  }
  return map
}

/** Render a line's segments with changed tokens highlighted. */
export function SegmentedText({ segments, kind }: { segments: Seg[]; kind: 'add' | 'del' }) {
  const hl = kind === 'add' ? 'bg-diff-add-word' : 'bg-diff-del-word'
  return (
    <>
      {segments.map((s, i) =>
        s.changed ? (
          <span key={i} className={`${hl} rounded-[2px]`}>{s.text}</span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}
