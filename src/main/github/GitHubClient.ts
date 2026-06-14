const API_BASE = 'https://api.github.com'

/** Thrown for non-2xx GitHub API responses; carries enough for the renderer to map a message. */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'auth' | 'rate_limit' | 'not_found' | 'forbidden' | 'validation' | 'server' | 'unknown',
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Follow Link rel="next" headers and concatenate all pages (arrays only). */
  fetchAll?: boolean
}

/**
 * Thin REST wrapper over global fetch. Reads the active token lazily on every
 * request (via the supplied getter) so account switches take effect immediately.
 * Handles auth headers, pagination, rate-limit detection, and error mapping.
 */
export class GitHubClient {
  constructor(private readonly getToken: () => string | null) {}

  private headers(): Record<string, string> {
    const token = this.getToken()
    const h: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'NovaGitX',
    }
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }

  private async parseError(res: Response): Promise<GitHubApiError> {
    let detail = res.statusText
    try {
      const json = (await res.json()) as { message?: string }
      if (json.message) detail = json.message
    } catch { /* keep statusText */ }

    const remaining = res.headers.get('X-RateLimit-Remaining')
    if (res.status === 401) return new GitHubApiError(detail, 401, 'auth')
    if (res.status === 403 && remaining === '0') {
      const reset = res.headers.get('X-RateLimit-Reset')
      const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'later'
      return new GitHubApiError(`GitHub API rate limit exceeded. Resets at ${when}.`, 403, 'rate_limit')
    }
    if (res.status === 403) return new GitHubApiError(detail, 403, 'forbidden')
    if (res.status === 404) return new GitHubApiError(detail, 404, 'not_found')
    if (res.status === 422) return new GitHubApiError(detail, 422, 'validation')
    if (res.status >= 500) return new GitHubApiError(detail, res.status, 'server')
    return new GitHubApiError(detail, res.status, 'unknown')
  }

  /** Issue a single request against a full path (e.g. "/repos/o/r/pulls?state=open"). */
  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, fetchAll = false } = opts

    if (fetchAll && method === 'GET') {
      return this.requestAll<T>(path)
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...this.headers(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) throw await this.parseError(res)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  /** Follow Link rel="next" and concatenate array pages. */
  private async requestAll<T>(path: string): Promise<T> {
    const collected: unknown[] = []
    let next: string | null = `${API_BASE}${path}`

    while (next) {
      const res: Response = await fetch(next, { headers: this.headers() })
      if (!res.ok) throw await this.parseError(res)
      const page = (await res.json()) as unknown[]
      collected.push(...page)
      next = this.nextLink(res.headers.get('Link'))
    }
    return collected as T
  }

  private nextLink(link: string | null): string | null {
    if (!link) return null
    for (const part of link.split(',')) {
      const m = part.match(/<([^>]+)>;\s*rel="next"/)
      if (m) return m[1]
    }
    return null
  }
}
