import { app, safeStorage } from 'electron/main'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { GhAccount, AccountsState } from './types.js'

interface PersistedShape {
  accounts: GhAccount[]
  tokens: Record<string, string>
  activeAccountId: number | null
}

const EMPTY: PersistedShape = { accounts: [], tokens: {}, activeAccountId: null }

/**
 * Stores multiple GitHub accounts and their OAuth tokens, encrypted at rest via
 * Electron safeStorage (OS keychain). The whole structure is serialized to one
 * encrypted blob. Tokens never leave the main process.
 *
 * If OS encryption is unavailable, falls back to an in-memory-only store (tokens
 * are lost on quit) rather than writing plaintext secrets to disk.
 */
export class TokenStore {
  private readonly file = join(app.getPath('userData'), 'github-accounts.bin')
  private data: PersistedShape
  private readonly canEncrypt: boolean

  constructor() {
    this.canEncrypt = safeStorage.isEncryptionAvailable()
    this.data = this.load()
  }

  private load(): PersistedShape {
    if (!this.canEncrypt || !existsSync(this.file)) return { ...EMPTY }
    try {
      const encrypted = readFileSync(this.file)
      const json = safeStorage.decryptString(encrypted)
      const parsed = JSON.parse(json) as PersistedShape
      return {
        accounts: parsed.accounts ?? [],
        tokens: parsed.tokens ?? {},
        activeAccountId: parsed.activeAccountId ?? null,
      }
    } catch {
      return { ...EMPTY }
    }
  }

  private persist(): void {
    if (!this.canEncrypt) {
      console.warn('[github] safeStorage unavailable — tokens kept in memory only')
      return
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(this.data))
    writeFileSync(this.file, encrypted)
  }

  addAccount(account: GhAccount, token: string): void {
    this.data.accounts = [
      account,
      ...this.data.accounts.filter((a) => a.id !== account.id),
    ]
    this.data.tokens[String(account.id)] = token
    if (this.data.activeAccountId === null) this.data.activeAccountId = account.id
    this.persist()
  }

  removeAccount(accountId: number): void {
    this.data.accounts = this.data.accounts.filter((a) => a.id !== accountId)
    delete this.data.tokens[String(accountId)]
    if (this.data.activeAccountId === accountId) {
      this.data.activeAccountId = this.data.accounts[0]?.id ?? null
    }
    this.persist()
  }

  removeAll(): void {
    this.data = { ...EMPTY, tokens: {} }
    if (this.canEncrypt && existsSync(this.file)) {
      try { unlinkSync(this.file) } catch { /* ignore */ }
    }
  }

  getToken(accountId: number): string | null {
    return this.data.tokens[String(accountId)] ?? null
  }

  getActiveToken(): string | null {
    if (this.data.activeAccountId === null) return null
    return this.getToken(this.data.activeAccountId)
  }

  getActiveId(): number | null {
    return this.data.activeAccountId
  }

  setActiveId(accountId: number): void {
    if (!this.data.accounts.some((a) => a.id === accountId)) return
    this.data.activeAccountId = accountId
    this.persist()
  }

  getState(): AccountsState {
    return {
      accounts: this.data.accounts,
      activeAccountId: this.data.activeAccountId,
    }
  }
}
