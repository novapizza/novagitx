import { useState } from 'react'
import { Play, RotateCw, ExternalLink, ArrowLeft, CheckCircle2, XCircle, CircleDot, Clock, MinusCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkflowRuns, useRunJobs, useRerunWorkflow, useGitHubAccounts, useActiveAccountId } from '@/hooks/useGitHub'
import { PanelShell, PanelLoading, PanelMessage, NotSignedIn, NotGitHubRepo } from './panelShared'
import type { GhWorkflowRun, GhRunStatus, GhRunConclusion } from '@/types/github'

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
  const [selected, setSelected] = useState<GhWorkflowRun | null>(null)

  const signedIn = (accounts?.accounts.length ?? 0) > 0

  if (selected) {
    return <RunDetail owner={owner} repo={repo} run={selected} onBack={() => setSelected(null)} />
  }

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
              <li key={run.id} className="flex gap-2.5 group hover:bg-muted/50 transition-colors">
                <button onClick={() => setSelected(run)} className="flex-1 min-w-0 flex gap-2.5 px-3 py-2.5 text-left">
                  <StatusIcon status={run.status} conclusion={run.conclusion} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{run.displayTitle || run.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {run.name} #{run.runNumber} · {run.headBranch} · {run.event}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

function RunDetail({ owner, repo, run, onBack }: { owner: string | null; repo: string | null; run: GhWorkflowRun; onBack: () => void }) {
  const jobs = useRunJobs(owner, repo, run.id)

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-2 bg-titlebar/60">
        <button onClick={onBack} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="text-[12px] font-semibold truncate">#{run.runNumber}</span>
        <button onClick={() => window.appOS.openExternal(run.htmlUrl)} title="Open run on GitHub"
          className="ml-auto h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ExternalLink className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac p-3 space-y-3">
        <div className="flex items-start gap-2">
          <StatusIcon status={run.status} conclusion={run.conclusion} />
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-snug">{run.displayTitle || run.name}</h2>
            <div className="text-[11px] text-muted-foreground">
              {run.name} #{run.runNumber} · {run.headBranch} · {run.event}
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jobs</div>
          {jobs.isLoading ? <PanelLoading />
            : jobs.isError ? (
              <p className="text-[12px] text-destructive px-1">
                {(jobs.error as Error)?.message || 'Failed to load jobs.'}
              </p>
            )
            : (jobs.data?.length ?? 0) === 0 ? <PanelMessage>No jobs found for this run.</PanelMessage>
            : (
              <ul className="space-y-2">
                {jobs.data!.map((job) => (
                  <li key={job.id} className="rounded-md border border-border/60 overflow-hidden">
                    <button onClick={() => job.htmlUrl && window.appOS.openExternal(job.htmlUrl)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors">
                      <StatusIcon status={job.status} conclusion={job.conclusion} />
                      <span className="text-[12.5px] font-medium truncate flex-1">{job.name}</span>
                      <StatusLabel status={job.status} conclusion={job.conclusion} />
                      {job.htmlUrl && <ExternalLink className="size-3 text-muted-foreground shrink-0" />}
                    </button>
                    {job.steps.length > 0 && (
                      <ul className="border-t border-border/60 bg-muted/20">
                        {job.steps.map((step) => (
                          <li key={step.number} className="flex items-center gap-2 px-2.5 py-1.5 pl-8">
                            <StatusIcon status={step.status} conclusion={step.conclusion} small />
                            <span className="text-[11.5px] truncate text-foreground/90 flex-1">{step.name}</span>
                            <StatusLabel status={step.status} conclusion={step.conclusion} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  )
}

function StatusLabel({ status, conclusion }: { status: GhRunStatus; conclusion: GhRunConclusion }) {
  const label = status === 'completed' ? (conclusion ?? 'completed') : status.replace('_', ' ')
  const color =
    status !== 'completed' ? 'text-yellow-600 dark:text-yellow-500'
      : conclusion === 'success' ? 'text-green-600 dark:text-green-500'
      : conclusion === 'failure' || conclusion === 'timed_out' ? 'text-red-600 dark:text-red-500'
      : 'text-muted-foreground'
  return <span className={`text-[10.5px] font-medium shrink-0 capitalize ${color}`}>{label.replace('_', ' ')}</span>
}

function StatusIcon({ status, conclusion, small }: { status: GhRunStatus; conclusion: GhRunConclusion; small?: boolean }) {
  const cls = `${small ? 'size-3.5' : 'size-4'} shrink-0 mt-0.5`
  if (status !== 'completed') {
    if (status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested')
      return <Clock className={`${cls} text-yellow-500`} />
    return <CircleDot className={`${cls} text-yellow-500 animate-pulse`} />
  }
  switch (conclusion) {
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
