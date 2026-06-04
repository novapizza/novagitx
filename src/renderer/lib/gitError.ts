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

  const detail = firstMeaningfulLine(text)

  if (isPermissionError(text)) {
    return {
      title: "You don't have permission to do that",
      description: detail,
    }
  }

  return { title: 'Operation failed', description: detail }
}
