import { TokenStore } from './TokenStore.js'
import { GitHubClient } from './GitHubClient.js'
import { GitHubAuth } from './GitHubAuth.js'
import type {
  GhAccount, AccountsState, DeviceCodeResponse, AuthStatus,
  GhRepo, GhPullRequest, GhReview, GhIssue, GhComment, GhWorkflowRun, GhWorkflowJob, GhCommitStatus,
  ListOptions, CreatePullRequestInput, CreateIssueInput, MergeMethod, GhUserRef, GhLabel,
} from './types.js'

/* ── raw API shapes (only the fields we read) ─────────────────────────────── */
interface RawUserRef { login: string; avatar_url: string }
interface RawLabel { name: string; color: string }
interface RawRepo {
  id: number; name: string; full_name: string; owner: RawUserRef & { login: string }
  description: string | null; private: boolean; fork: boolean; language: string | null
  stargazers_count: number; default_branch: string; clone_url: string; ssh_url: string
  html_url: string; updated_at: string
}
interface RawPull {
  number: number; title: string; body: string | null; state: 'open' | 'closed'
  draft?: boolean; merged?: boolean; mergeable?: boolean | null; user: RawUserRef
  head: { ref: string; sha: string }; base: { ref: string }; html_url: string
  created_at: string; updated_at: string; comments?: number; changed_files?: number
  additions?: number; deletions?: number; labels?: RawLabel[]; requested_reviewers?: RawUserRef[]
}
interface RawIssue {
  number: number; title: string; body: string | null; state: 'open' | 'closed'
  user: RawUserRef; html_url: string; created_at: string; updated_at: string
  comments: number; labels: RawLabel[]; assignees: RawUserRef[]; pull_request?: unknown
}

const userRef = (u: RawUserRef): GhUserRef => ({ login: u.login, avatarUrl: u.avatar_url })
const label = (l: RawLabel): GhLabel => ({ name: l.name, color: l.color })
const enc = encodeURIComponent

/**
 * App-global GitHub API surface. Owns the token store, the shared client (which
 * always reads the active account's token), and the device-flow auth helper.
 */
export class GitHubModule {
  private readonly tokens = new TokenStore()
  private readonly client = new GitHubClient(() => this.tokens.getActiveToken())
  private readonly auth = new GitHubAuth(this.tokens, this.client)

  /* ── Auth / accounts ────────────────────────────────────────────────────── */

  startDeviceFlow(): Promise<DeviceCodeResponse> {
    return this.auth.startDeviceFlow()
  }

  pollForToken(deviceCode: string, interval: number, onStatus: (s: AuthStatus) => void): Promise<GhAccount | null> {
    return this.auth.pollForToken(deviceCode, interval, onStatus)
  }

  cancelAuth(): void {
    this.auth.cancel()
  }

  listAccounts(): AccountsState {
    return this.tokens.getState()
  }

  setActiveAccount(accountId: number): AccountsState {
    this.tokens.setActiveId(accountId)
    return this.tokens.getState()
  }

  signOut(accountId: number): AccountsState {
    this.tokens.removeAccount(accountId)
    return this.tokens.getState()
  }

  signOutAll(): AccountsState {
    this.tokens.removeAll()
    return this.tokens.getState()
  }

  private requireAuth(): void {
    if (this.tokens.getActiveToken() === null) {
      throw new Error('Not signed in to GitHub.')
    }
  }

  /* ── Repos ──────────────────────────────────────────────────────────────── */

  async listMyRepos(): Promise<GhRepo[]> {
    this.requireAuth()
    const raw = await this.client.request<RawRepo[]>(
      '/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100',
      { fetchAll: true },
    )
    return raw.map((r) => this.mapRepo(r))
  }

  async listOrgs(): Promise<string[]> {
    this.requireAuth()
    const raw = await this.client.request<{ login: string }[]>('/user/orgs?per_page=100', { fetchAll: true })
    return raw.map((o) => o.login)
  }

  async listOrgRepos(org: string): Promise<GhRepo[]> {
    this.requireAuth()
    const raw = await this.client.request<RawRepo[]>(
      `/orgs/${enc(org)}/repos?sort=updated&per_page=100`, { fetchAll: true },
    )
    return raw.map((r) => this.mapRepo(r))
  }

  async searchRepos(query: string): Promise<GhRepo[]> {
    this.requireAuth()
    const res = await this.client.request<{ items: RawRepo[] }>(
      `/search/repositories?q=${enc(query)}&per_page=50`,
    )
    return res.items.map((r) => this.mapRepo(r))
  }

  private mapRepo(r: RawRepo): GhRepo {
    return {
      id: r.id, name: r.name, fullName: r.full_name, owner: r.owner.login,
      description: r.description, private: r.private, fork: r.fork, language: r.language,
      stars: r.stargazers_count, defaultBranch: r.default_branch, cloneUrl: r.clone_url,
      sshUrl: r.ssh_url, htmlUrl: r.html_url, updatedAt: r.updated_at,
    }
  }

  /* ── Pull Requests ──────────────────────────────────────────────────────── */

  async listPullRequests(owner: string, repo: string, opts: ListOptions = {}): Promise<GhPullRequest[]> {
    this.requireAuth()
    const state = opts.state ?? 'open'
    const raw = await this.client.request<RawPull[]>(
      `/repos/${enc(owner)}/${enc(repo)}/pulls?state=${state}&sort=updated&direction=desc&per_page=50`,
    )
    return raw.map((p) => this.mapPull(p))
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<GhPullRequest> {
    this.requireAuth()
    const p = await this.client.request<RawPull>(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}`)
    return this.mapPull(p)
  }

  async getPullRequestReviews(owner: string, repo: string, number: number): Promise<GhReview[]> {
    this.requireAuth()
    const raw = await this.client.request<{
      id: number; user: RawUserRef; state: GhReview['state']; body: string | null; submitted_at: string | null
    }[]>(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}/reviews`)
    return raw.map((r) => ({ id: r.id, user: userRef(r.user), state: r.state, body: r.body, submittedAt: r.submitted_at }))
  }

  async createPullRequest(owner: string, repo: string, input: CreatePullRequestInput): Promise<GhPullRequest> {
    this.requireAuth()
    const p = await this.client.request<RawPull>(`/repos/${enc(owner)}/${enc(repo)}/pulls`, {
      method: 'POST', body: input,
    })
    return this.mapPull(p)
  }

  async mergePullRequest(owner: string, repo: string, number: number, method: MergeMethod): Promise<void> {
    this.requireAuth()
    await this.client.request(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}/merge`, {
      method: 'PUT', body: { merge_method: method },
    })
  }

  async updatePullRequest(
    owner: string, repo: string, number: number,
    patch: { state?: 'open' | 'closed'; title?: string; body?: string },
  ): Promise<GhPullRequest> {
    this.requireAuth()
    const p = await this.client.request<RawPull>(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}`, {
      method: 'PATCH', body: patch,
    })
    return this.mapPull(p)
  }

  async requestReviewers(owner: string, repo: string, number: number, reviewers: string[]): Promise<void> {
    this.requireAuth()
    await this.client.request(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}/requested_reviewers`, {
      method: 'POST', body: { reviewers },
    })
  }

  private mapPull(p: RawPull): GhPullRequest {
    return {
      number: p.number, title: p.title, body: p.body, state: p.state,
      draft: p.draft ?? false, merged: p.merged ?? false, mergeable: p.mergeable ?? null,
      user: userRef(p.user), headRef: p.head.ref, baseRef: p.base.ref, headSha: p.head.sha,
      htmlUrl: p.html_url, createdAt: p.created_at, updatedAt: p.updated_at,
      comments: p.comments ?? 0, changedFiles: p.changed_files ?? 0,
      additions: p.additions ?? 0, deletions: p.deletions ?? 0,
      labels: (p.labels ?? []).map(label), requestedReviewers: (p.requested_reviewers ?? []).map(userRef),
    }
  }

  /* ── Issues ─────────────────────────────────────────────────────────────── */

  async listIssues(owner: string, repo: string, opts: ListOptions = {}): Promise<GhIssue[]> {
    this.requireAuth()
    const state = opts.state ?? 'open'
    const raw = await this.client.request<RawIssue[]>(
      `/repos/${enc(owner)}/${enc(repo)}/issues?state=${state}&sort=updated&direction=desc&per_page=50`,
    )
    // The issues endpoint returns PRs too; drop anything carrying a pull_request field.
    return raw.filter((i) => !i.pull_request).map((i) => this.mapIssue(i))
  }

  async getIssue(owner: string, repo: string, number: number): Promise<GhIssue> {
    this.requireAuth()
    const i = await this.client.request<RawIssue>(`/repos/${enc(owner)}/${enc(repo)}/issues/${number}`)
    return this.mapIssue(i)
  }

  async createIssue(owner: string, repo: string, input: CreateIssueInput): Promise<GhIssue> {
    this.requireAuth()
    const i = await this.client.request<RawIssue>(`/repos/${enc(owner)}/${enc(repo)}/issues`, {
      method: 'POST', body: input,
    })
    return this.mapIssue(i)
  }

  async updateIssue(
    owner: string, repo: string, number: number,
    patch: { state?: 'open' | 'closed'; title?: string; body?: string },
  ): Promise<GhIssue> {
    this.requireAuth()
    const i = await this.client.request<RawIssue>(`/repos/${enc(owner)}/${enc(repo)}/issues/${number}`, {
      method: 'PATCH', body: patch,
    })
    return this.mapIssue(i)
  }

  async listIssueComments(owner: string, repo: string, number: number): Promise<GhComment[]> {
    this.requireAuth()
    const raw = await this.client.request<{ id: number; user: RawUserRef; body: string; created_at: string }[]>(
      `/repos/${enc(owner)}/${enc(repo)}/issues/${number}/comments`,
    )
    return raw.map((c) => ({ id: c.id, user: userRef(c.user), body: c.body, createdAt: c.created_at }))
  }

  async addIssueComment(owner: string, repo: string, number: number, body: string): Promise<GhComment> {
    this.requireAuth()
    const c = await this.client.request<{ id: number; user: RawUserRef; body: string; created_at: string }>(
      `/repos/${enc(owner)}/${enc(repo)}/issues/${number}/comments`, { method: 'POST', body: { body } },
    )
    return { id: c.id, user: userRef(c.user), body: c.body, createdAt: c.created_at }
  }

  async listLabels(owner: string, repo: string): Promise<GhLabel[]> {
    this.requireAuth()
    const raw = await this.client.request<RawLabel[]>(`/repos/${enc(owner)}/${enc(repo)}/labels?per_page=100`)
    return raw.map(label)
  }

  private mapIssue(i: RawIssue): GhIssue {
    return {
      number: i.number, title: i.title, body: i.body, state: i.state, user: userRef(i.user),
      htmlUrl: i.html_url, createdAt: i.created_at, updatedAt: i.updated_at, comments: i.comments,
      labels: (i.labels ?? []).map(label), assignees: (i.assignees ?? []).map(userRef),
    }
  }

  /* ── Actions / CI ───────────────────────────────────────────────────────── */

  async listWorkflowRuns(owner: string, repo: string): Promise<GhWorkflowRun[]> {
    this.requireAuth()
    const res = await this.client.request<{ workflow_runs: {
      id: number; name: string; display_title: string; status: GhWorkflowRun['status']
      conclusion: GhWorkflowRun['conclusion']; head_branch: string; head_sha: string
      event: string; html_url: string; created_at: string; updated_at: string; run_number: number
    }[] }>(`/repos/${enc(owner)}/${enc(repo)}/actions/runs?per_page=30`)
    return res.workflow_runs.map((r) => ({
      id: r.id, name: r.name, displayTitle: r.display_title, status: r.status, conclusion: r.conclusion,
      headBranch: r.head_branch, headSha: r.head_sha, event: r.event, htmlUrl: r.html_url,
      createdAt: r.created_at, updatedAt: r.updated_at, runNumber: r.run_number,
    }))
  }

  async getCommitStatus(owner: string, repo: string, sha: string): Promise<GhCommitStatus> {
    // Fired automatically per visible commit row, not by an explicit user action —
    // so degrade to "no status" when signed out rather than throwing (which would
    // spam the main-process console with one error per row).
    if (this.tokens.getActiveToken() === null) {
      return { sha, state: 'none', total: 0, htmlUrl: null }
    }
    const res = await this.client.request<{
      state: 'success' | 'failure' | 'pending' | 'error'; total_count: number
      statuses: { target_url: string | null }[]
    }>(`/repos/${enc(owner)}/${enc(repo)}/commits/${enc(sha)}/status`)
    return {
      sha,
      state: res.total_count === 0 ? 'none' : res.state,
      total: res.total_count,
      htmlUrl: res.statuses[0]?.target_url ?? null,
    }
  }

  async listRunJobs(owner: string, repo: string, runId: number): Promise<GhWorkflowJob[]> {
    this.requireAuth()
    const res = await this.client.request<{ jobs: {
      id: number; name: string; status: GhWorkflowRun['status']; conclusion: GhWorkflowRun['conclusion']
      started_at: string | null; completed_at: string | null; html_url: string | null
      steps?: { name: string; status: GhWorkflowRun['status']; conclusion: GhWorkflowRun['conclusion']; number: number }[]
    }[] }>(`/repos/${enc(owner)}/${enc(repo)}/actions/runs/${runId}/jobs?per_page=100`)
    return res.jobs.map((j) => ({
      id: j.id, name: j.name, status: j.status, conclusion: j.conclusion,
      startedAt: j.started_at, completedAt: j.completed_at, htmlUrl: j.html_url,
      steps: (j.steps ?? []).map((s) => ({
        name: s.name, status: s.status, conclusion: s.conclusion, number: s.number,
      })),
    }))
  }

  async rerunWorkflow(owner: string, repo: string, runId: number): Promise<void> {
    this.requireAuth()
    await this.client.request(`/repos/${enc(owner)}/${enc(repo)}/actions/runs/${runId}/rerun`, { method: 'POST' })
  }
}
