import { useState } from 'react'
import { CircleDot, CircleCheck, Plus, RotateCw, ExternalLink, ArrowLeft, Loader2, Send } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useIssues, useIssueComments, useIssueMutations,
  useGitHubAccounts, useActiveAccountId,
} from '@/hooks/useGitHub'
import { PanelShell, PanelLoading, PanelMessage, NotSignedIn, NotGitHubRepo, StateFilter } from './panelShared'
import { CreateIssueDialog } from './CreateIssueDialog'

interface Props {
  owner: string | null
  repo: string | null
  isGitHub: boolean
  onClose: () => void
}

export function IssuesPanel({ owner, repo, isGitHub, onClose }: Props) {
  const accountId = useActiveAccountId()
  const { data: accounts } = useGitHubAccounts()
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open')
  const [selected, setSelected] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const list = useIssues(owner, repo, state)
  const qc = useQueryClient()

  const signedIn = (accounts?.accounts.length ?? 0) > 0
  const refresh = () => qc.invalidateQueries({ queryKey: ['gh', accountId, 'issues', owner, repo] })

  if (selected !== null) {
    return <IssueDetail owner={owner} repo={repo} number={selected} onBack={() => setSelected(null)} />
  }

  return (
    <PanelShell
      title="Issues"
      icon={<CircleDot className="size-3.5" />}
      onClose={onClose}
      actions={
        <>
          <StateFilter value={state} onChange={setState} />
          <button onClick={() => setCreateOpen(true)} title="New issue"
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
        : (list.data?.length ?? 0) === 0 ? <PanelMessage>No {state} issues.</PanelMessage>
        : (
          <ul className="divide-y divide-border/60">
            {list.data!.map((iss) => (
              <li key={iss.number}>
                <button onClick={() => setSelected(iss.number)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex gap-2.5">
                  {iss.state === 'open'
                    ? <CircleDot className="size-4 shrink-0 mt-0.5 text-green-500" />
                    : <CircleCheck className="size-4 shrink-0 mt-0.5 text-purple-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{iss.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      #{iss.number} · {iss.user.login}
                      {iss.comments > 0 && ` · ${iss.comments} comment${iss.comments === 1 ? '' : 's'}`}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

      <CreateIssueDialog open={createOpen} onClose={() => setCreateOpen(false)} owner={owner} repo={repo} />
    </PanelShell>
  )
}

function IssueDetail({ owner, repo, number, onBack }: { owner: string | null; repo: string | null; number: number; onBack: () => void }) {
  const detail = useIssues(owner, repo, 'all') // reuse list cache; fallback below fetches single
  const issue = detail.data?.find((i) => i.number === number)
  const comments = useIssueComments(owner, repo, number)
  const { setState, comment } = useIssueMutations(owner, repo)
  const [draft, setDraft] = useState('')

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-2 bg-titlebar/60">
        <button onClick={onBack} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="text-[12px] font-semibold truncate">#{number}</span>
        {issue && (
          <button onClick={() => window.appOS.openExternal(issue.htmlUrl)} title="Open on GitHub"
            className="ml-auto h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <ExternalLink className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac p-3 space-y-3">
        {!issue ? <PanelLoading /> : (
          <>
            <h2 className="text-[14px] font-semibold leading-snug">{issue.title}</h2>
            <div className="text-[11px] text-muted-foreground">
              {issue.user.login} · {issue.state}
            </div>
            {issue.body && (
              <p className="text-[12px] whitespace-pre-wrap text-foreground/90 border-t border-border/60 pt-2">{issue.body}</p>
            )}

            <div className="border-t border-border/60 pt-2 space-y-2">
              {comments.isLoading ? <PanelLoading />
                : comments.data?.map((c) => (
                  <div key={c.id} className="text-[12px]">
                    <span className="font-medium">{c.user.login}</span>
                    <p className="whitespace-pre-wrap text-foreground/90">{c.body}</p>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {issue && (
        <div className="shrink-0 border-t border-border p-2 space-y-2">
          <div className="flex items-end gap-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary/50 resize-none scrollbar-mac"
            />
            <button
              onClick={() => { if (draft.trim()) { comment.mutate({ num: number, body: draft.trim() }); setDraft('') } }}
              disabled={!draft.trim() || comment.isPending}
              className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
              {comment.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            </button>
          </div>
          <button
            onClick={() => setState.mutate({ num: number, state: issue.state === 'open' ? 'closed' : 'open' })}
            disabled={setState.isPending}
            className="h-7 px-3 rounded-md text-[11.5px] border border-border hover:bg-muted transition-colors disabled:opacity-40">
            {issue.state === 'open' ? 'Close issue' : 'Reopen issue'}
          </button>
        </div>
      )}
    </div>
  )
}
