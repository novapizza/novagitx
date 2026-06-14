import { GitPullRequest, CircleDot, Play } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AccountSwitcher } from './AccountSwitcher'
import { useGitHubStore, type GitHubPanel } from '@/store/githubStore'

interface Props {
  onAddAccount: () => void
  onManageAccounts: () => void
}

/** TitleBar GitHub cluster: account switcher + PR/Issues/Actions panel toggles. */
export function GitHubToolbar({ onAddAccount, onManageAccounts }: Props) {
  const panel = useGitHubStore((s) => s.panel)
  const togglePanel = useGitHubStore((s) => s.togglePanel)

  return (
    <div className="flex items-center gap-1">
      <AccountSwitcher onAddAccount={onAddAccount} onManage={onManageAccounts} />
      <Toggle icon={GitPullRequest} label="Pull requests" name="pull-requests" active={panel} onToggle={togglePanel} />
      <Toggle icon={CircleDot} label="Issues" name="issues" active={panel} onToggle={togglePanel} />
      <Toggle icon={Play} label="Actions" name="actions" active={panel} onToggle={togglePanel} />
    </div>
  )
}

function Toggle({
  icon: Icon, label, name, active, onToggle,
}: {
  icon: typeof GitPullRequest
  label: string
  name: Exclude<GitHubPanel, null>
  active: GitHubPanel
  onToggle: (p: Exclude<GitHubPanel, null>) => void
}) {
  const isActive = active === name
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onToggle(name)}
          className={`relative flex items-center h-7 px-2 rounded-md text-[12px] transition-colors ${
            isActive ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-background/70 active:bg-background'
          }`}
        >
          <Icon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] px-2 py-1">{label}</TooltipContent>
    </Tooltip>
  )
}
