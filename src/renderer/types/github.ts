// GitHub API types — used in the renderer.
// MUST stay in sync with src/main/github/types.ts (identical shape, no imports from main).

export interface GhAccount {
  id: number
  login: string
  name: string | null
  avatarUrl: string
}

export interface DeviceCodeResponse {
  userCode: string
  verificationUri: string
  deviceCode: string
  interval: number
  expiresIn: number
}

export type AuthStatus =
  | { kind: 'pending' }
  | { kind: 'slow_down' }
  | { kind: 'authorized'; account: GhAccount }
  | { kind: 'expired' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }

export interface AccountsState {
  accounts: GhAccount[]
  activeAccountId: number | null
}

export interface GhRepo {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  private: boolean
  fork: boolean
  language: string | null
  stars: number
  defaultBranch: string
  cloneUrl: string
  sshUrl: string
  htmlUrl: string
  updatedAt: string
}

export interface GhUserRef {
  login: string
  avatarUrl: string
}

export interface GhLabel {
  name: string
  color: string
}

export interface GhPullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  draft: boolean
  merged: boolean
  mergeable: boolean | null
  user: GhUserRef
  headRef: string
  baseRef: string
  headSha: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  comments: number
  changedFiles: number
  additions: number
  deletions: number
  labels: GhLabel[]
  requestedReviewers: GhUserRef[]
}

export interface GhReview {
  id: number
  user: GhUserRef
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED'
  body: string | null
  submittedAt: string | null
}

export interface GhIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  user: GhUserRef
  htmlUrl: string
  createdAt: string
  updatedAt: string
  comments: number
  labels: GhLabel[]
  assignees: GhUserRef[]
}

export interface GhComment {
  id: number
  user: GhUserRef
  body: string
  createdAt: string
}

export type GhRunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending'
export type GhRunConclusion =
  | 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out'
  | 'action_required' | 'neutral' | 'stale' | null

export interface GhWorkflowRun {
  id: number
  name: string
  displayTitle: string
  status: GhRunStatus
  conclusion: GhRunConclusion
  headBranch: string
  headSha: string
  event: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  runNumber: number
}

export interface GhCommitStatus {
  sha: string
  state: 'success' | 'failure' | 'pending' | 'error' | 'none'
  total: number
  htmlUrl: string | null
}

export interface ListOptions {
  state?: 'open' | 'closed' | 'all'
  perPage?: number
  page?: number
  fetchAll?: boolean
}

export interface CreatePullRequestInput {
  title: string
  body?: string
  head: string
  base: string
  draft?: boolean
}

export interface CreateIssueInput {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}

export type MergeMethod = 'merge' | 'squash' | 'rebase'
