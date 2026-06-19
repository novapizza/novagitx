import type { MouseEvent, ReactNode } from 'react'
import { Search, GitBranch, ArrowDownToLine, ArrowUpFromLine, RotateCw, Plus, Settings2, Sun, Moon, Monitor } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useThemeContext } from '@/ThemeContext'
import type { ThemeMode } from '@/hooks/useTheme'

interface TitleBarProps {
  repoName: string
  repoPath: string
  currentBranch: string | null
  onOpenPalette: () => void
  onFetch?: () => void
  onPull?: () => void
  onPush?: () => void
  onOpenRepo?: () => void
  onCloneRepo?: () => void
  onBrowseGitHub?: () => void
  onInitRepo?: () => void
  onCreateBranch?: () => void
  onRenameBranch?: () => void
  onOpenSettings?: () => void
  /** GitHub controls (account switcher + panel toggles), composed by the page. */
  githubSlot?: ReactNode
  isFetching?: boolean
  isPulling?: boolean
  isPushing?: boolean
}

export function TitleBar({
  repoName,
  repoPath,
  currentBranch,
  onOpenPalette,
  onFetch,
  onPull,
  onPush,
  onOpenRepo,
  onCloneRepo,
  onBrowseGitHub,
  onInitRepo,
  onCreateBranch,
  onRenameBranch,
  onOpenSettings,
  githubSlot,
  isFetching,
  isPulling,
  isPushing,
}: TitleBarProps) {
  const displayPath = repoPath.replace(/^\/Users\/[^/]+/, '~')
  const isMac = window.appOS.platform === 'darwin'
  // mac: leave room for traffic lights on the left.
  // win/linux: leave room for window-controls overlay on the right (~140px covers min/max/close).
  const chromePad = isMac ? 'pl-[80px] pr-3' : 'pl-3 pr-[140px]'

  const handleTitleBarDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    // Only trigger when double-clicking blank titlebar area, not interactive children.
    if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return
    window.appOS.toggleMaximize()
  }

  return (
    <div
      onDoubleClick={handleTitleBarDoubleClick}
      className={`titlebar-vibrancy flex h-11 items-center gap-3 border-b border-titlebar-border ${chromePad} select-none`}
    >
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground/80">
        <GitBranch className="size-3.5 text-primary" />
        {repoName}
      </div>
      <span className="text-muted-foreground/60 text-[13px]">—</span>
      <WithTooltip label={repoPath} contentClassName="max-w-[480px] break-all">
        <span className="no-drag text-[13px] text-muted-foreground truncate max-w-[200px] cursor-default">
          {displayPath}
        </span>
      </WithTooltip>

      <button
        onClick={onOpenPalette}
        className="ml-auto mr-auto hidden md:flex items-center gap-2 h-8 w-[520px] rounded-md bg-background/60 hover:bg-background border border-border/70 px-3 text-[13px] text-muted-foreground transition-colors"
      >
        <Search className="size-4" />
        <span className="truncate">Search commits, branches, files…</span>
        <span className="ml-auto flex items-center gap-1 text-[11.5px] text-muted-foreground/80">
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono">⌘</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono">K</kbd>
        </span>
      </button>

      <div className="ml-auto md:ml-0 flex items-center gap-1">
        <ToolbarButton icon={ArrowDownToLine} label="Pull" tooltip="Pull from remote" loading={isPulling} onClick={onPull} />
        <ToolbarButton icon={ArrowUpFromLine} label="Push" tooltip="Push to remote" loading={isPushing} onClick={onPush} />
        <ToolbarButton icon={RotateCw} label="Fetch" tooltip="Fetch from remote" loading={isFetching} onClick={onFetch} />
        <Divider />
        <WithTooltip label="Branch actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] text-foreground/80 hover:bg-background/70 active:bg-background transition-colors">
                <GitBranch className="size-3.5" />
                <span className="hidden lg:inline">Branch</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCreateBranch}>Create branch…</DropdownMenuItem>
              <DropdownMenuItem onClick={onRenameBranch} disabled={!currentBranch}>
                Rename current branch…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenPalette}>Checkout branch…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </WithTooltip>
        <Divider />
        {githubSlot}
        {githubSlot && <Divider />}
        <WithTooltip label="Open / clone / new repository">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] text-foreground/80 hover:bg-background/70 active:bg-background transition-colors">
                <Plus className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenRepo}>Open repository…</DropdownMenuItem>
              <DropdownMenuItem onClick={onCloneRepo}>Clone repository…</DropdownMenuItem>
              <DropdownMenuItem onClick={onBrowseGitHub}>Clone from GitHub…</DropdownMenuItem>
              <DropdownMenuItem onClick={onInitRepo}>New repository…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </WithTooltip>
        <ThemeToggle />
        <ToolbarButton icon={Settings2} label="" tooltip="Settings" onClick={onOpenSettings} />
      </div>
    </div>
  )
}

const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system']
const THEME_ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }
const THEME_LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' }

function ThemeToggle() {
  const { mode, setMode } = useThemeContext()
  const Icon = THEME_ICONS[mode]
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(mode) + 1) % THEME_CYCLE.length]
  return (
    <WithTooltip label={`Theme: ${THEME_LABELS[mode]} — click for ${THEME_LABELS[next]}`}>
      <button
        onClick={() => setMode(next)}
        className="relative flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] text-foreground/80 hover:bg-background/70 active:bg-background transition-colors"
      >
        <Icon className="size-3.5" />
      </button>
    </WithTooltip>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  tooltip,
  badge,
  loading,
  onClick,
}: {
  icon: any
  label: string
  tooltip?: string
  badge?: string
  loading?: boolean
  onClick?: () => void
}) {
  const button = (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] text-foreground/80 hover:bg-background/70 active:bg-background transition-colors disabled:opacity-50"
    >
      <Icon className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
      {label && <span className="hidden lg:inline">{label}</span>}
      {badge && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
  if (!tooltip) return button
  return <WithTooltip label={tooltip}>{button}</WithTooltip>
}

function WithTooltip({ label, children, contentClassName }: { label: string; children: ReactNode; contentClassName?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className={`text-[11px] px-2 py-1 ${contentClassName ?? ''}`}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />
}
