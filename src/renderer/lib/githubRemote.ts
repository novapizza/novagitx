export interface GitHubRepoRef {
  owner: string
  repo: string
}

/**
 * Derive owner/repo from a git remote URL, for both forms:
 *   git@github.com:owner/repo.git
 *   https://github.com/owner/repo(.git)
 *   ssh://git@github.com/owner/repo.git
 * Returns null for non-GitHub remotes.
 */
export function parseGitHubRemote(url: string | undefined | null): GitHubRepoRef | null {
  if (!url) return null
  const trimmed = url.trim()

  // scp-like: git@github.com:owner/repo.git
  const scp = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
  if (scp) return { owner: scp[1], repo: scp[2] }

  // https:// or ssh:// URLs
  const url2 = trimmed.match(/^(?:https?|ssh):\/\/(?:[^@]+@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/i)
  if (url2) return { owner: url2[1], repo: url2[2] }

  return null
}
