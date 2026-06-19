import { useState, useEffect, useRef } from 'react'
import { Search, X, GitBranch, ChevronDown } from 'lucide-react'
import type { LogOptions } from '@/types/git'

interface LogFilterProps {
  value: LogOptions
  onChange: (opts: LogOptions) => void
}

export function LogFilter({ value, onChange }: LogFilterProps) {
  const [author, setAuthor] = useState(value.author ?? '')
  const [grep, setGrep] = useState(value.grep ?? '')
  const [pickaxe, setPickaxe] = useState(value.pickaxe ?? '')
  const [pickaxeRegex, setPickaxeRegex] = useState(value.pickaxeRegex ?? '')
  const [pathFilter, setPathFilter] = useState(value.pathFilter ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange({
        ...value,
        author: author.trim() || undefined,
        grep: grep.trim() || undefined,
        pickaxe: pickaxe.trim() || undefined,
        pickaxeRegex: pickaxeRegex.trim() || undefined,
        pathFilter: pathFilter.trim() || undefined,
      })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [author, grep, pickaxe, pickaxeRegex, pathFilter])

  function toggleCurrentBranch() {
    onChange({ ...value, onlyCurrentBranch: !value.onlyCurrentBranch })
  }

  function clearAll() {
    setAuthor(''); setGrep(''); setPickaxe(''); setPickaxeRegex(''); setPathFilter('')
    onChange({ onlyCurrentBranch: value.onlyCurrentBranch })
  }

  const hasFilter = author.trim() || grep.trim() || pickaxe.trim() || pickaxeRegex.trim() || pathFilter.trim()

  return (
    <div className="border-b border-border bg-titlebar/40">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <Search className="size-3.5 text-muted-foreground shrink-0" />
        <input
          value={grep}
          onChange={(e) => setGrep(e.target.value)}
          placeholder="Filter message…"
          className="h-6 flex-1 min-w-0 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author…"
          className="h-6 w-[110px] bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none border-l border-border pl-2"
        />
        <button
          onClick={toggleCurrentBranch}
          title="Current branch only"
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] transition-colors ${
            value.onlyCurrentBranch ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <GitBranch className="size-3" />
          <span>This branch</span>
        </button>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] transition-colors ${
            showAdvanced || pickaxe || pickaxeRegex || pathFilter
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          title="Advanced search"
        >
          <ChevronDown className={`size-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          <span>Advanced</span>
        </button>
        {hasFilter && (
          <button onClick={clearAll} className="text-muted-foreground hover:text-foreground" title="Clear filters">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {showAdvanced && (
        <div className="flex items-center gap-1.5 px-3 pb-2 pt-1 border-t border-border/60">
          <input
            value={pickaxe}
            onChange={(e) => setPickaxe(e.target.value)}
            placeholder="Pickaxe -S: text added/removed in diff…"
            className="h-6 flex-1 min-w-0 bg-background/40 rounded px-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none border border-border/60"
          />
          <input
            value={pickaxeRegex}
            onChange={(e) => setPickaxeRegex(e.target.value)}
            placeholder="Pickaxe -G regex…"
            className="h-6 w-[160px] bg-background/40 rounded px-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none border border-border/60"
          />
          <input
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            placeholder="Path…"
            className="h-6 w-[160px] bg-background/40 rounded px-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none border border-border/60"
          />
        </div>
      )}
    </div>
  )
}
