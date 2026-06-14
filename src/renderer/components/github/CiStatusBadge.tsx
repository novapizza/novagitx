import { CheckCircle2, XCircle, CircleDot, AlertCircle } from 'lucide-react'
import { useCommitStatus } from '@/hooks/useGitHub'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  owner: string | null
  repo: string | null
  sha: string
  enabled: boolean
}

/** Inline CI status dot for a commit row. Renders nothing until a state is known. */
export function CiStatusBadge({ owner, repo, sha, enabled }: Props) {
  const { data } = useCommitStatus(owner, repo, sha, enabled)
  if (!data || data.state === 'none') return null

  const meta = {
    success: { Icon: CheckCircle2, cls: 'text-green-500', label: 'All checks passed' },
    failure: { Icon: XCircle, cls: 'text-red-500', label: 'Some checks failed' },
    pending: { Icon: CircleDot, cls: 'text-yellow-500 animate-pulse', label: 'Checks running' },
    error: { Icon: AlertCircle, cls: 'text-red-500', label: 'Checks errored' },
  }[data.state]
  if (!meta) return null
  const { Icon, cls, label } = meta

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); if (data.htmlUrl) window.appOS.openExternal(data.htmlUrl) }}
          className="shrink-0 mr-1 flex items-center"
        >
          <Icon className={`size-3.5 ${cls}`} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-[11px] px-2 py-1">{label}</TooltipContent>
    </Tooltip>
  )
}
