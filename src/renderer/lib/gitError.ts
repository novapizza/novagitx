// Turns a thrown git error (whose message is typically git's raw stderr) into a
// concise, user-facing title + description. The main goal is to recognise the
// "you don't have permission to do this" family of failures — which git reports
// in several different shapes depending on transport (SSH vs HTTPS) and server —
// and give them a clear, consistent message instead of dumping raw stderr.

export interface GitErrorMessage {
  title: string
  description: string
}

/** Heuristics for the various ways git signals "permission denied". */
const PERMISSION_PATTERNS: RegExp[] = [
  /permission denied/i,
  /permission to .+ denied/i, // remote: Permission to org/repo denied to user
  /access denied/i,
  /\b403\b|forbidden/i, // HTTPS 403
  /\b401\b|unauthorized/i, // HTTPS 401
  /authentication failed/i,
  /could not read (username|password)/i,
  /protected branch/i, // server-side branch protection
  /pre-receive hook declined|push declined/i,
  /not authorized|insufficient permission/i,
  /operation not permitted|read-only file system|eacces|eperm/i, // local FS perms
]

function isPermissionError(text: string): boolean {
  return PERMISSION_PATTERNS.some((re) => re.test(text))
}

// git refuses checkout/merge/pull/rebase/stash when it would clobber uncommitted work.
// stderr shape:
//   error: Your local changes to the following files would be overwritten by checkout:
//   \tsrc/foo.ts
//   \tsrc/bar.ts
//   Please commit your changes or stash them before you switch branches.
//   Aborting
// (or "The following untracked working tree files would be overwritten by ...")
const OVERWRITE_RE =
  /(?:your local changes to the following files|the following untracked working tree files) would be overwritten by (checkout|merge|pull|rebase|reset|stash|switch)/i

/** Extract the tab/space-indented file paths git lists between the header and its trailer. */
function extractOverwriteFiles(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => /^[\t ]+\S/.test(l)) // indented lines are the file paths
    .map((l) => l.trim())
    .filter((l) => !/^(please|aborting|hint:)/i.test(l))
}

function describeOverwriteError(text: string): GitErrorMessage {
  const action = OVERWRITE_RE.exec(text)?.[1]?.toLowerCase() ?? 'this operation'
  const files = extractOverwriteFiles(text)
  const fileList =
    files.length === 0
      ? ''
      : files.length <= 3
        ? ` (${files.join(', ')})`
        : ` (${files.slice(0, 3).join(', ')} +${files.length - 3} more)`
  return {
    title: 'Commit or stash your changes first',
    description: `You have uncommitted changes${fileList} that ${action} would overwrite. Commit or stash them, then try again.`,
  }
}

/** Collapse multi-line git stderr to its most useful single line. */
function firstMeaningfulLine(text: string): string {
  const lines = text
    .split('\n')
    .map((l) =>
      l
        // Electron wraps IPC rejections: "Error invoking remote method 'git:x': Error: <msg>"
        .replace(/^Error invoking remote method '[^']*':\s*/i, '')
        .replace(/^(remote:|fatal:|error:|hint:)\s*/i, '')
        .trim(),
    )
    .filter(Boolean)
  // Prefer a line that actually mentions the permission problem, else the first line.
  return lines.find((l) => isPermissionError(l)) ?? lines[0] ?? text.trim()
}

export function describeGitError(error: unknown): GitErrorMessage {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as { message?: unknown })?.message ?? error ?? '')

  const text = raw.trim()
  if (!text) {
    return { title: 'Operation failed', description: 'The git command failed for an unknown reason.' }
  }

  if (OVERWRITE_RE.test(text)) {
    return describeOverwriteError(text)
  }

  // GitHub API failures surface through the same MutationCache safety net.
  if (/rate limit exceeded/i.test(text)) {
    return { title: 'GitHub rate limit reached', description: firstMeaningfulLine(text) }
  }
  if (/bad credentials/i.test(text)) {
    return {
      title: 'GitHub sign-in expired',
      description: 'Your GitHub token is no longer valid. Sign in again from Settings → GitHub.',
    }
  }
  if (/not signed in to github/i.test(text)) {
    return {
      title: 'Not signed in to GitHub',
      description: 'Sign in from Settings → GitHub to use this feature.',
    }
  }

  const detail = firstMeaningfulLine(text)

  if (isPermissionError(text)) {
    return {
      title: "You don't have permission to do that",
      description: detail,
    }
  }

  return { title: 'Operation failed', description: detail }
}
