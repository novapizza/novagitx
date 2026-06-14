import type { ReactNode } from 'react'
import { X, Github, Loader2 } from 'lucide-react'

/** Side-panel shell matching the ReflogPanel/FileHistory chrome. */
export function PanelShell({
  title, icon, onClose, actions, children,
}: {
  title: string
  icon: ReactNode
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-3 bg-titlebar/60">
        <span className="text-primary">{icon}</span>
        <span className="text-[12px] font-semibold">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {actions}
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac">{children}</div>
    </div>
  )
}

/** Centered message for empty / not-signed-in / non-GitHub states. */
export function PanelMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full px-6 text-center text-[12px] text-muted-foreground">
      {children}
    </div>
  )
}

export function PanelLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  )
}

export function NotSignedIn() {
  return (
    <PanelMessage>
      <Github className="size-6 opacity-40" />
      <span>Sign in to GitHub from Settings → GitHub to use this panel.</span>
    </PanelMessage>
  )
}

export function NotGitHubRepo() {
  return (
    <PanelMessage>
      <Github className="size-6 opacity-40" />
      <span>This repository's <span className="font-mono">origin</span> is not a GitHub remote.</span>
    </PanelMessage>
  )
}

/** Small open/closed/all segmented filter shared by the PR and Issue panels. */
export function StateFilter({
  value, onChange, includeAll = true,
}: {
  value: 'open' | 'closed' | 'all'
  onChange: (v: 'open' | 'closed' | 'all') => void
  includeAll?: boolean
}) {
  const opts: ('open' | 'closed' | 'all')[] = includeAll ? ['open', 'closed', 'all'] : ['open', 'closed']
  return (
    <div className="flex items-center gap-0.5 text-[11px]">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2 py-0.5 rounded-md capitalize transition-colors ${
            value === o ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
