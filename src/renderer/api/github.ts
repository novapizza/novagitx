import type {
  GhAccount, AccountsState, DeviceCodeResponse, AuthStatus, GhRepo, GhPullRequest,
  GhReview, GhIssue, GhComment, GhWorkflowRun, GhWorkflowJob, GhCommitStatus, ListOptions,
  CreatePullRequestInput, CreateIssueInput, MergeMethod, GhLabel,
} from '@/types/github'

interface GitHubBridge {
  // Auth / accounts
  startDeviceFlow: () => Promise<DeviceCodeResponse>
  pollForToken: (deviceCode: string, interval: number) => Promise<GhAccount | null>
  cancelAuth: () => Promise<void>
  onAuthStatus: (cb: (status: AuthStatus) => void) => () => void
  listAccounts: () => Promise<AccountsState>
  setActiveAccount: (id: number) => Promise<AccountsState>
  signOut: (id: number) => Promise<AccountsState>
  signOutAll: () => Promise<AccountsState>

  // Repos
  listMyRepos: () => Promise<GhRepo[]>
  listOrgs: () => Promise<string[]>
  listOrgRepos: (org: string) => Promise<GhRepo[]>
  searchRepos: (query: string) => Promise<GhRepo[]>

  // Pull Requests
  listPullRequests: (owner: string, repo: string, opts?: ListOptions) => Promise<GhPullRequest[]>
  getPullRequest: (owner: string, repo: string, num: number) => Promise<GhPullRequest>
  getPullRequestReviews: (owner: string, repo: string, num: number) => Promise<GhReview[]>
  createPullRequest: (owner: string, repo: string, input: CreatePullRequestInput) => Promise<GhPullRequest>
  mergePullRequest: (owner: string, repo: string, num: number, method: MergeMethod) => Promise<void>
  updatePullRequest: (owner: string, repo: string, num: number, patch: { state?: 'open' | 'closed'; title?: string; body?: string }) => Promise<GhPullRequest>
  requestReviewers: (owner: string, repo: string, num: number, reviewers: string[]) => Promise<void>

  // Issues
  listIssues: (owner: string, repo: string, opts?: ListOptions) => Promise<GhIssue[]>
  getIssue: (owner: string, repo: string, num: number) => Promise<GhIssue>
  createIssue: (owner: string, repo: string, input: CreateIssueInput) => Promise<GhIssue>
  updateIssue: (owner: string, repo: string, num: number, patch: { state?: 'open' | 'closed'; title?: string; body?: string }) => Promise<GhIssue>
  listIssueComments: (owner: string, repo: string, num: number) => Promise<GhComment[]>
  addIssueComment: (owner: string, repo: string, num: number, body: string) => Promise<GhComment>
  listLabels: (owner: string, repo: string) => Promise<GhLabel[]>

  // Actions / CI
  listWorkflowRuns: (owner: string, repo: string) => Promise<GhWorkflowRun[]>
  listRunJobs: (owner: string, repo: string, runId: number) => Promise<GhWorkflowJob[]>
  getCommitStatus: (owner: string, repo: string, sha: string) => Promise<GhCommitStatus>
  rerunWorkflow: (owner: string, repo: string, runId: number) => Promise<void>
}

declare global {
  interface Window {
    github: GitHubBridge
  }
}

export const githubApi = {
  startDeviceFlow: () => window.github.startDeviceFlow(),
  pollForToken: (deviceCode: string, interval: number) => window.github.pollForToken(deviceCode, interval),
  cancelAuth: () => window.github.cancelAuth(),
  onAuthStatus: (cb: (status: AuthStatus) => void) => window.github.onAuthStatus(cb),
  listAccounts: () => window.github.listAccounts(),
  setActiveAccount: (id: number) => window.github.setActiveAccount(id),
  signOut: (id: number) => window.github.signOut(id),
  signOutAll: () => window.github.signOutAll(),

  listMyRepos: () => window.github.listMyRepos(),
  listOrgs: () => window.github.listOrgs(),
  listOrgRepos: (org: string) => window.github.listOrgRepos(org),
  searchRepos: (query: string) => window.github.searchRepos(query),

  listPullRequests: (owner: string, repo: string, opts?: ListOptions) =>
    window.github.listPullRequests(owner, repo, opts),
  getPullRequest: (owner: string, repo: string, num: number) =>
    window.github.getPullRequest(owner, repo, num),
  getPullRequestReviews: (owner: string, repo: string, num: number) =>
    window.github.getPullRequestReviews(owner, repo, num),
  createPullRequest: (owner: string, repo: string, input: CreatePullRequestInput) =>
    window.github.createPullRequest(owner, repo, input),
  mergePullRequest: (owner: string, repo: string, num: number, method: MergeMethod) =>
    window.github.mergePullRequest(owner, repo, num, method),
  updatePullRequest: (owner: string, repo: string, num: number, patch: { state?: 'open' | 'closed'; title?: string; body?: string }) =>
    window.github.updatePullRequest(owner, repo, num, patch),
  requestReviewers: (owner: string, repo: string, num: number, reviewers: string[]) =>
    window.github.requestReviewers(owner, repo, num, reviewers),

  listIssues: (owner: string, repo: string, opts?: ListOptions) =>
    window.github.listIssues(owner, repo, opts),
  getIssue: (owner: string, repo: string, num: number) => window.github.getIssue(owner, repo, num),
  createIssue: (owner: string, repo: string, input: CreateIssueInput) =>
    window.github.createIssue(owner, repo, input),
  updateIssue: (owner: string, repo: string, num: number, patch: { state?: 'open' | 'closed'; title?: string; body?: string }) =>
    window.github.updateIssue(owner, repo, num, patch),
  listIssueComments: (owner: string, repo: string, num: number) =>
    window.github.listIssueComments(owner, repo, num),
  addIssueComment: (owner: string, repo: string, num: number, body: string) =>
    window.github.addIssueComment(owner, repo, num, body),
  listLabels: (owner: string, repo: string) => window.github.listLabels(owner, repo),

  listWorkflowRuns: (owner: string, repo: string) => window.github.listWorkflowRuns(owner, repo),
  listRunJobs: (owner: string, repo: string, runId: number) =>
    window.github.listRunJobs(owner, repo, runId),
  getCommitStatus: (owner: string, repo: string, sha: string) =>
    window.github.getCommitStatus(owner, repo, sha),
  rerunWorkflow: (owner: string, repo: string, runId: number) =>
    window.github.rerunWorkflow(owner, repo, runId),
}
