import { useState } from 'react'
import { GitPullRequest, GitMerge, Plus, RotateCw, ExternalLink, ArrowLeft, Loader2, GitPullRequestDraft } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  usePullRequests, usePullRequestDetail, usePullRequestMutations,
  useGitHubAccounts, useActiveAccountId,
} from '@/hooks/useGitHub'
import { useGitHubStore } from '@/store/githubStore'
import { PanelShell, PanelLoading, PanelMessage, NotSignedIn, NotGitHubRepo, StateFilter } from './panelShared'
import { CreatePRDialog } from './CreatePRDialog'
import type { GhPullRequest, MergeMethod } from '@/types/github'

interface Props {
  repoPath: string | null
  owner: string | null
  repo: string | null
  isGitHub: boolean
  currentBranch: string | null
  defaultBase: string
  defaultTitle?: string
  onClose: () => void
}

export function PullRequestsPanel(props: Props) {
  const { owner, repo, isGitHub, onClose } = props
  const accountId = useActiveAccountId()
  const { data: accounts } = useGitHubAccounts()
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open')
  const [selected, setSelected] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const list = usePullRequests(owner, repo, state)
  const qc = useQueryClient()

  const signedIn = (accounts?.accounts.length ?? 0) > 0
  const icon = <GitPullRequest className="size-3.5" />

  const refresh = () => qc.invalidateQueries({ queryKey: ['gh', accountId, 'prs', owner, repo] })

  if (selected !== null) {
    return (
      <PullRequestDetail
        {...props}
        number={selected}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <PanelShell
      title="Pull requests"
      icon={icon}
      onClose={onClose}
      actions={
        <>
          <StateFilter value={state} onChange={setState} />
          <button onClick={() => setCreateOpen(true)} title="New pull request"
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <Plus className="size-3.5" />
          </button>
          <button onClick={refresh} title="Refresh"
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <RotateCw className="size-3.5" />
          </button>
        </>
      }
    >
      {!signedIn ? <NotSignedIn />
        : !isGitHub ? <NotGitHubRepo />
        : list.isLoading ? <PanelLoading />
        : (list.data?.length ?? 0) === 0 ? <PanelMessage>No {state} pull requests.</PanelMessage>
        : (
          <ul className="divide-y divide-border/60">
            {list.data!.map((pr) => (
              <li key={pr.number}>
                <button onClick={() => setSelected(pr.number)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex gap-2.5">
                  <PrStateIcon pr={pr} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{pr.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      #{pr.number} · {pr.user.login} · {pr.headRef} → {pr.baseRef}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

      <CreatePRDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        repoPath={props.repoPath}
        owner={owner}
        repo={repo}
        currentBranch={props.currentBranch}
        defaultBase={props.defaultBase}
        defaultTitle={props.defaultTitle}
      />
    </PanelShell>
  )
}

function PrStateIcon({ pr }: { pr: GhPullRequest }) {
  if (pr.merged) return <GitMerge className="size-4 shrink-0 mt-0.5 text-purple-500" />
  if (pr.draft) return <GitPullRequestDraft className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
  return <GitPullRequest className={`size-4 shrink-0 mt-0.5 ${pr.state === 'open' ? 'text-green-500' : 'text-red-500'}`} />
}

const MERGE_METHODS: MergeMethod[] = ['merge', 'squash', 'rebase']

function PullRequestDetail({ owner, repo, number, onBack }: Props & { number: number; onBack: () => void }) {
  const detail = usePullRequestDetail(owner, repo, number)
  const { merge, setState } = usePullRequestMutations(owner, repo)
  const mergeMethod = useGitHubStore((s) => s.lastMergeMethod)
  const setMergeMethod = useGitHubStore((s) => s.setLastMergeMethod)
  const pr = detail.data

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-2 bg-titlebar/60">
        <button onClick={onBack} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="text-[12px] font-semibold truncate">#{number}</span>
        {pr && (
          <button onClick={() => window.appOS.openExternal(pr.htmlUrl)} title="Open on GitHub"
            className="ml-auto h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <ExternalLink className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac p-3 space-y-3">
        {detail.isLoading || !pr ? <PanelLoading /> : (
          <>
            <h2 className="text-[14px] font-semibold leading-snug">{pr.title}</h2>
            <div className="text-[11px] text-muted-foreground">
              {pr.user.login} wants to merge <span className="font-mono">{pr.headRef}</span> into{' '}
              <span className="font-mono">{pr.baseRef}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Stat label="State" value={pr.merged ? 'merged' : pr.state} />
              <Stat label="Files" value={String(pr.changedFiles)} />
              <Stat label="+/−" value={`+${pr.additions} −${pr.deletions}`} />
              <Stat label="Comments" value={String(pr.comments)} />
            </div>
            {pr.body && (
              <p className="text-[12px] whitespace-pre-wrap text-foreground/90 border-t border-border/60 pt-2">
                {pr.body}
              </p>
            )}

            {pr.state === 'open' && !pr.merged && (
              <div className="border-t border-border/60 pt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  {MERGE_METHODS.map((m) => (
                    <button key={m} onClick={() => setMergeMethod(m)}
                      className={`px-2 py-0.5 rounded-md text-[11px] capitalize transition-colors ${
                        mergeMethod === m ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => merge.mutate({ num: number, method: mergeMethod })}
                    disabled={merge.isPending || pr.mergeable === false}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
                    {merge.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    <GitMerge className="size-3.5" /> Merge
                  </button>
                  <button
                    onClick={() => setState.mutate({ num: number, state: 'closed' })}
                    disabled={setState.isPending}
                    className="h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
                    Close
                  </button>
                </div>
                {pr.mergeable === false && (
                  <p className="text-[11px] text-destructive">This branch has conflicts that must be resolved.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2 py-0.5 rounded bg-muted text-foreground/80">
      {label}: <span className="font-medium">{value}</span>
    </span>
  )
}
