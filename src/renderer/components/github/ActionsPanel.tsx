import { Play, RotateCw, ExternalLink, CheckCircle2, XCircle, CircleDot, Clock, MinusCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkflowRuns, useRerunWorkflow, useGitHubAccounts, useActiveAccountId } from '@/hooks/useGitHub'
import { PanelShell, PanelLoading, PanelMessage, NotSignedIn, NotGitHubRepo } from './panelShared'
import type { GhWorkflowRun } from '@/types/github'

interface Props {
  owner: string | null
  repo: string | null
  isGitHub: boolean
  onClose: () => void
}

export function ActionsPanel({ owner, repo, isGitHub, onClose }: Props) {
  const accountId = useActiveAccountId()
  const { data: accounts } = useGitHubAccounts()
  const runs = useWorkflowRuns(owner, repo)
  const rerun = useRerunWorkflow(owner, repo)
  const qc = useQueryClient()

  const signedIn = (accounts?.accounts.length ?? 0) > 0

  return (
    <PanelShell
      title="Actions"
      icon={<Play className="size-3.5" />}
      onClose={onClose}
      actions={
        <button onClick={() => qc.invalidateQueries({ queryKey: ['gh', accountId, 'runs', owner, repo] })}
          title="Refresh"
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
          <RotateCw className="size-3.5" />
        </button>
      }
    >
      {!signedIn ? <NotSignedIn />
        : !isGitHub ? <NotGitHubRepo />
        : runs.isLoading ? <PanelLoading />
        : (runs.data?.length ?? 0) === 0 ? <PanelMessage>No workflow runs found.</PanelMessage>
        : (
          <ul className="divide-y divide-border/60">
            {runs.data!.map((run) => (
              <li key={run.id} className="px-3 py-2.5 flex gap-2.5 group">
                <RunIcon run={run} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate">{run.displayTitle || run.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {run.name} #{run.runNumber} · {run.headBranch} · {run.event}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {run.status === 'completed' && (
                    <button onClick={() => rerun.mutate(run.id)} title="Re-run"
                      className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                      <RotateCw className="size-3.5" />
                    </button>
                  )}
                  <button onClick={() => window.appOS.openExternal(run.htmlUrl)} title="Open run"
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </PanelShell>
  )
}

function RunIcon({ run }: { run: GhWorkflowRun }) {
  const cls = 'size-4 shrink-0 mt-0.5'
  if (run.status !== 'completed') {
    if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending' || run.status === 'requested')
      return <Clock className={`${cls} text-yellow-500`} />
    return <CircleDot className={`${cls} text-yellow-500 animate-pulse`} />
  }
  switch (run.conclusion) {
    case 'success': return <CheckCircle2 className={`${cls} text-green-500`} />
    case 'failure':
    case 'timed_out': return <XCircle className={`${cls} text-red-500`} />
    case 'cancelled':
    case 'skipped':
    case 'stale':
    case 'neutral': return <MinusCircle className={`${cls} text-muted-foreground`} />
    default: return <CircleDot className={`${cls} text-muted-foreground`} />
  }
}
