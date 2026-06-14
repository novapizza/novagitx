import { useState } from 'react'
import { Github, Plus, LogOut, Check } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useGitHubAccounts, useSwitchAccount, useSignOut, useSignOutAll } from '@/hooks/useGitHub'
import { useGitHubStore } from '@/store/githubStore'
import { GitHubAuthDialog } from './GitHubAuthDialog'

/** Settings → GitHub tab: list / add / switch / sign out of accounts. */
export function GitHubAccountsPanel() {
  const { data } = useGitHubAccounts()
  const switchAccount = useSwitchAccount()
  const signOut = useSignOut()
  const signOutAll = useSignOutAll()
  const showCiBadges = useGitHubStore((s) => s.showCiBadges)
  const setShowCiBadges = useGitHubStore((s) => s.setShowCiBadges)
  const [authOpen, setAuthOpen] = useState(false)

  const accounts = data?.accounts ?? []
  const activeId = data?.activeAccountId ?? null

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Github className="size-3.5 text-muted-foreground" />
          <h3 className="text-[12.5px] font-medium">GitHub accounts</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sign in to browse repos, manage pull requests &amp; issues, and see CI status. Multiple accounts
          can be connected; the active one is used for all GitHub actions. Tokens are encrypted in your OS keychain.
        </p>

        <div className="space-y-1.5 pt-1">
          {accounts.length === 0 && (
            <p className="text-[12px] text-muted-foreground italic py-2">No accounts connected.</p>
          )}
          {accounts.map((a) => {
            const isActive = a.id === activeId
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
                  isActive ? 'border-primary bg-primary/10' : 'border-border/60'
                }`}
              >
                <Avatar className="size-8">
                  <AvatarImage src={a.avatarUrl} alt={a.login} />
                  <AvatarFallback className="text-[10px]">{a.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate flex items-center gap-1.5">
                    @{a.login}
                    {isActive && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                        <Check className="size-3" /> active
                      </span>
                    )}
                  </div>
                  {a.name && <div className="text-[11px] text-muted-foreground truncate">{a.name}</div>}
                </div>
                {!isActive && (
                  <button
                    onClick={() => switchAccount.mutate(a.id)}
                    className="h-7 px-2.5 rounded-md text-[11.5px] border border-border hover:bg-muted transition-colors"
                  >
                    Switch
                  </button>
                )}
                <button
                  onClick={() => signOut.mutate(a.id)}
                  title="Sign out"
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => setAuthOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-3.5" /> Add account
          </button>
          {accounts.length > 0 && (
            <button
              onClick={() => signOutAll.mutate()}
              className="h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors"
            >
              Sign out all
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2 border-t border-border/60 pt-4">
        <h3 className="text-[12.5px] font-medium">Preferences</h3>
        <label className="flex items-center gap-2 text-[12px] text-foreground/90">
          <input type="checkbox" checked={showCiBadges} onChange={(e) => setShowCiBadges(e.target.checked)} />
          Show CI status badges on commits in the graph
        </label>
        <p className="text-[11px] text-muted-foreground pl-6">
          Fetches the combined check status for each visible commit from GitHub. Disable to reduce API usage.
        </p>
      </section>

      <GitHubAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
