import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { githubApi } from '@/api/github'
import { gitApi } from '@/api/git'
import { parseGitHubRemote, type GitHubRepoRef } from '@/lib/githubRemote'
import type {
  CreatePullRequestInput, CreateIssueInput, MergeMethod,
} from '@/types/github'

/**
 * Resolve owner/repo for the current repo from its `origin` (or first) remote.
 * Returns null when the repo has no GitHub remote — callers render an empty state.
 */
export function useLinkedGitHubRepo(repoPath: string | null): {
  ref: GitHubRepoRef | null; isLoading: boolean; isGitHub: boolean
} {
  const { data, isLoading } = useQuery({
    queryKey: ['gh', 'linked-remote', repoPath],
    queryFn: async () => {
      const remotes = await gitApi.getRemotes(repoPath!)
      const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
      return parseGitHubRemote(origin?.fetchUrl || origin?.pushUrl)
    },
    enabled: !!repoPath,
    staleTime: 60_000,
  })
  return { ref: data ?? null, isLoading, isGitHub: !!data }
}

/* ── Accounts / auth ──────────────────────────────────────────────────────── */

export function useGitHubAccounts() {
  return useQuery({
    queryKey: ['gh', 'accounts'],
    queryFn: () => githubApi.listAccounts(),
    staleTime: Infinity, // changes only via explicit mutations below
  })
}

/** The active account id, used to namespace all other query keys. */
export function useActiveAccountId(): number | null {
  const { data } = useGitHubAccounts()
  return data?.activeAccountId ?? null
}

export function useSwitchAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => githubApi.setActiveAccount(id),
    onSuccess: (state) => {
      qc.setQueryData(['gh', 'accounts'], state)
      // New identity → drop every cached GitHub view so panels reload as that account.
      qc.invalidateQueries({ queryKey: ['gh'] })
    },
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => githubApi.signOut(id),
    onSuccess: (state) => {
      qc.setQueryData(['gh', 'accounts'], state)
      qc.invalidateQueries({ queryKey: ['gh'] })
    },
  })
}

export function useSignOutAll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => githubApi.signOutAll(),
    onSuccess: (state) => {
      qc.setQueryData(['gh', 'accounts'], state)
      qc.invalidateQueries({ queryKey: ['gh'] })
    },
  })
}

/* ── Repos ────────────────────────────────────────────────────────────────── */

export function useMyRepos(enabled: boolean) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'repos'],
    queryFn: () => githubApi.listMyRepos(),
    enabled: enabled && accountId !== null,
    staleTime: 60_000,
  })
}

/* ── Pull Requests ────────────────────────────────────────────────────────── */

export function usePullRequests(
  owner: string | null, repo: string | null, state: 'open' | 'closed' | 'all' = 'open',
) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'prs', owner, repo, state],
    queryFn: () => githubApi.listPullRequests(owner!, repo!, { state }),
    enabled: accountId !== null && !!owner && !!repo,
    staleTime: 30_000,
  })
}

export function usePullRequestDetail(owner: string | null, repo: string | null, num: number | null) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'pr', owner, repo, num],
    queryFn: () => githubApi.getPullRequest(owner!, repo!, num!),
    enabled: accountId !== null && !!owner && !!repo && num !== null,
    staleTime: 30_000,
  })
}

export function usePullRequestMutations(owner: string | null, repo: string | null) {
  const qc = useQueryClient()
  const accountId = useActiveAccountId()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gh', accountId, 'prs', owner, repo] })

  const create = useMutation({
    mutationFn: (input: CreatePullRequestInput) => githubApi.createPullRequest(owner!, repo!, input),
    onSuccess: invalidate,
  })
  const merge = useMutation({
    mutationFn: ({ num, method }: { num: number; method: MergeMethod }) =>
      githubApi.mergePullRequest(owner!, repo!, num, method),
    onSuccess: invalidate,
  })
  const setState = useMutation({
    mutationFn: ({ num, state }: { num: number; state: 'open' | 'closed' }) =>
      githubApi.updatePullRequest(owner!, repo!, num, { state }),
    onSuccess: invalidate,
  })
  return { create, merge, setState }
}

/* ── Issues ───────────────────────────────────────────────────────────────── */

export function useIssues(
  owner: string | null, repo: string | null, state: 'open' | 'closed' | 'all' = 'open',
) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'issues', owner, repo, state],
    queryFn: () => githubApi.listIssues(owner!, repo!, { state }),
    enabled: accountId !== null && !!owner && !!repo,
    staleTime: 30_000,
  })
}

export function useIssueComments(owner: string | null, repo: string | null, num: number | null) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'issue-comments', owner, repo, num],
    queryFn: () => githubApi.listIssueComments(owner!, repo!, num!),
    enabled: accountId !== null && !!owner && !!repo && num !== null,
    staleTime: 30_000,
  })
}

export function useIssueMutations(owner: string | null, repo: string | null) {
  const qc = useQueryClient()
  const accountId = useActiveAccountId()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gh', accountId, 'issues', owner, repo] })

  const create = useMutation({
    mutationFn: (input: CreateIssueInput) => githubApi.createIssue(owner!, repo!, input),
    onSuccess: invalidate,
  })
  const setState = useMutation({
    mutationFn: ({ num, state }: { num: number; state: 'open' | 'closed' }) =>
      githubApi.updateIssue(owner!, repo!, num, { state }),
    onSuccess: invalidate,
  })
  const comment = useMutation({
    mutationFn: ({ num, body }: { num: number; body: string }) =>
      githubApi.addIssueComment(owner!, repo!, num, body),
    onSuccess: (_d, { num }) =>
      qc.invalidateQueries({ queryKey: ['gh', accountId, 'issue-comments', owner, repo, num] }),
  })
  return { create, setState, comment }
}

/* ── Actions / CI ─────────────────────────────────────────────────────────── */

export function useWorkflowRuns(owner: string | null, repo: string | null) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'runs', owner, repo],
    queryFn: () => githubApi.listWorkflowRuns(owner!, repo!),
    enabled: accountId !== null && !!owner && !!repo,
    staleTime: 20_000,
  })
}

export function useRerunWorkflow(owner: string | null, repo: string | null) {
  const qc = useQueryClient()
  const accountId = useActiveAccountId()
  return useMutation({
    mutationFn: (runId: number) => githubApi.rerunWorkflow(owner!, repo!, runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gh', accountId, 'runs', owner, repo] }),
  })
}

/** Combined CI status for one commit (for the inline graph badge). Cached per SHA. */
export function useCommitStatus(owner: string | null, repo: string | null, sha: string | null, enabled = true) {
  const accountId = useActiveAccountId()
  return useQuery({
    queryKey: ['gh', accountId, 'commit-status', owner, repo, sha],
    queryFn: () => githubApi.getCommitStatus(owner!, repo!, sha!),
    enabled: enabled && accountId !== null && !!owner && !!repo && !!sha,
    staleTime: 60_000,
  })
}
