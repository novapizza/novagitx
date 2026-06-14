import { Github, Plus, Check, Settings2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGitHubAccounts, useSwitchAccount } from '@/hooks/useGitHub'

interface Props {
  onAddAccount: () => void
  onManage: () => void
}

/** TitleBar control: shows the active GitHub identity and switches between accounts. */
export function AccountSwitcher({ onAddAccount, onManage }: Props) {
  const { data } = useGitHubAccounts()
  const switchAccount = useSwitchAccount()

  const accounts = data?.accounts ?? []
  const activeId = data?.activeAccountId ?? null
  const active = accounts.find((a) => a.id === activeId) ?? null

  if (accounts.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onAddAccount}
            className="relative flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] text-foreground/80 hover:bg-background/70 active:bg-background transition-colors"
          >
            <Github className="size-3.5" />
            <span className="hidden lg:inline">Sign in</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">Sign in to GitHub</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center gap-1.5 h-7 px-1.5 rounded-md hover:bg-background/70 active:bg-background transition-colors">
          <Avatar className="size-5">
            {active && <AvatarImage src={active.avatarUrl} alt={active.login} />}
            <AvatarFallback className="text-[9px]">
              {(active?.login ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden lg:inline text-[12px] text-foreground/80">{active?.login}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">GitHub accounts</DropdownMenuLabel>
        {accounts.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onClick={() => { if (a.id !== activeId) switchAccount.mutate(a.id) }}
            className="gap-2"
          >
            <Avatar className="size-5">
              <AvatarImage src={a.avatarUrl} alt={a.login} />
              <AvatarFallback className="text-[9px]">{a.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] truncate">{a.login}</span>
              {a.name && <span className="text-[10.5px] text-muted-foreground truncate">{a.name}</span>}
            </div>
            {a.id === activeId && <Check className="size-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddAccount} className="gap-2">
          <Plus className="size-3.5" /> Add account…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManage} className="gap-2">
          <Settings2 className="size-3.5" /> Manage accounts…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
