import type { TokenStore } from './TokenStore.js'
import type { GitHubClient } from './GitHubClient.js'
import type { GhAccount, DeviceCodeResponse, AuthStatus } from './types.js'
import { GITHUB_CLIENT_ID, GITHUB_SCOPES, DEVICE_CODE_URL, ACCESS_TOKEN_URL } from './config.js'

interface RawUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * OAuth Device Flow. Adds a new account on success (does not replace existing
 * accounts), so several GitHub logins can coexist and be switched between.
 */
export class GitHubAuth {
  /** Set true to stop an in-progress poll (e.g. dialog closed). */
  private cancelled = false

  constructor(
    private readonly tokens: TokenStore,
    private readonly client: GitHubClient,
  ) {}

  cancel(): void {
    this.cancelled = true
  }

  async startDeviceFlow(): Promise<DeviceCodeResponse> {
    if (GITHUB_CLIENT_ID.startsWith('REPLACE_WITH')) {
      throw new Error(
        'GitHub OAuth App is not configured. Set GITHUB_CLIENT_ID (see src/main/github/config.ts).',
      )
    }
    this.cancelled = false
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_SCOPES }),
    })
    if (!res.ok) throw new Error(`Failed to start device flow (${res.status})`)
    const json = (await res.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      interval: number
      expires_in: number
    }
    return {
      deviceCode: json.device_code,
      userCode: json.user_code,
      verificationUri: json.verification_uri,
      interval: json.interval,
      expiresIn: json.expires_in,
    }
  }

  /**
   * Poll the access-token endpoint until the user authorizes, times out, or
   * cancels. Reports progress via onStatus and resolves with the new account.
   */
  async pollForToken(
    deviceCode: string,
    interval: number,
    onStatus: (status: AuthStatus) => void,
  ): Promise<GhAccount | null> {
    let delayMs = Math.max(interval, 5) * 1000
    const deadline = Date.now() + 15 * 60 * 1000

    while (!this.cancelled && Date.now() < deadline) {
      await sleep(delayMs)
      if (this.cancelled) return null

      const res = await fetch(ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })
      const json = (await res.json()) as {
        access_token?: string
        error?: string
      }

      if (json.access_token) {
        const account = await this.fetchAndStore(json.access_token)
        onStatus({ kind: 'authorized', account })
        return account
      }

      switch (json.error) {
        case 'authorization_pending':
          onStatus({ kind: 'pending' })
          break
        case 'slow_down':
          delayMs += 5000
          onStatus({ kind: 'slow_down' })
          break
        case 'expired_token':
          onStatus({ kind: 'expired' })
          return null
        case 'access_denied':
          onStatus({ kind: 'denied' })
          return null
        default:
          onStatus({ kind: 'error', message: json.error ?? 'Unknown error' })
          return null
      }
    }
    if (Date.now() >= deadline) onStatus({ kind: 'expired' })
    return null
  }

  private async fetchAndStore(token: string): Promise<GhAccount> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'NovaGitX',
      },
    })
    if (!res.ok) throw new Error(`Failed to fetch GitHub user (${res.status})`)
    const u = (await res.json()) as RawUser
    const account: GhAccount = {
      id: u.id,
      login: u.login,
      name: u.name,
      avatarUrl: u.avatar_url,
    }
    this.tokens.addAccount(account, token)
    return account
  }
}
