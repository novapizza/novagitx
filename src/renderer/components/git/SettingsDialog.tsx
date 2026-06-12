import { useEffect, useMemo, useState } from 'react'
import { Settings2, KeyRound, FileText, Copy, Plus, Loader2, Keyboard, GitBranch, SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useGitConfig, useGitConfigMutations } from '@/hooks/useRepo'
import { gitApi } from '@/api/git'
import type { GitConfigEntry } from '@/types/git'
import { HotkeysPanel } from '@/components/git/HotkeysPanel'
import { useUiStore, type BranchView } from '@/store/uiStore'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  repoPath: string | null
}

const COMMON_KEYS = [
  { key: 'user.name',          label: 'User name' },
  { key: 'user.email',         label: 'User email' },
  { key: 'user.signingkey',    label: 'GPG signing key' },
  { key: 'commit.gpgsign',     label: 'Sign commits by default (true/false)' },
  { key: 'commit.template',    label: 'Commit message template path' },
  { key: 'core.editor',        label: 'Editor' },
  { key: 'core.autocrlf',      label: 'Autocrlf (true/false/input)' },
  { key: 'pull.rebase',        label: 'pull.rebase (true/false/merges)' },
  { key: 'diff.tool',          label: 'External diff tool' },
  { key: 'merge.tool',         label: 'External merge tool' },
  { key: 'init.defaultBranch', label: 'Default branch name' },
] as const

type Tab = 'general' | 'config' | 'template' | 'ssh' | 'keys'

export function SettingsDialog({ open, onOpenChange, repoPath }: Props) {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] h-[600px] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2"><Settings2 className="size-4" />Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left nav — fixed width so switching tabs never resizes the window */}
          <nav className="w-44 shrink-0 border-r border-border p-2 space-y-0.5 overflow-y-auto scrollbar-mac">
            <TabButton active={tab === 'general'} onClick={() => setTab('general')} icon={SlidersHorizontal}>General</TabButton>
            <TabButton active={tab === 'config'} onClick={() => setTab('config')} icon={Settings2}>Git config</TabButton>
            <TabButton active={tab === 'template'} onClick={() => setTab('template')} icon={FileText}>Commit template</TabButton>
            <TabButton active={tab === 'ssh'} onClick={() => setTab('ssh')} icon={KeyRound}>SSH keys</TabButton>
            <TabButton active={tab === 'keys'} onClick={() => setTab('keys')} icon={Keyboard}>Keyboard</TabButton>
          </nav>

          {/* Content — scrolls internally; the dialog keeps a constant size */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-mac p-5">
            {tab === 'general' && <GeneralPanel />}
            {tab === 'config' && <ConfigPanel repoPath={repoPath} open={open} />}
            {tab === 'template' && <TemplatePanel />}
            {tab === 'ssh' && <SshPanel open={open} />}
            {tab === 'keys' && <HotkeysPanel />}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
          <button onClick={() => onOpenChange(false)} className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted">Close</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Settings2; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[12px] text-left transition-colors ${active ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
      <Icon className="size-3.5 shrink-0" />{children}
    </button>
  )
}

// ── General (app preferences) ───────────────────────────────────────────────

function GeneralPanel() {
  const branchView = useUiStore((s) => s.branchView)
  const setBranchView = useUiStore((s) => s.setBranchView)

  const options: { value: BranchView; label: string; hint: string }[] = [
    { value: 'grouped', label: 'Grouped by name', hint: 'Nest branches into collapsible folders (e.g. feat/foo, feat/bar → a "feat" folder).' },
    { value: 'flat', label: 'Flat list', hint: 'Show every branch with its full name on one line.' },
  ]

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <GitBranch className="size-3.5 text-muted-foreground" />
          <h3 className="text-[12.5px] font-medium">Branch list</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">How branches are displayed in the side pane.</p>
        <div className="space-y-1.5 pt-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setBranchView(o.value)}
              className={`w-full flex items-start gap-2.5 text-left rounded-md border px-3 py-2.5 transition-colors ${
                branchView === o.value ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted'
              }`}
            >
              <span className={`mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${branchView === o.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
              <span className="min-w-0">
                <span className="block text-[12px] font-medium">{o.label}</span>
                <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Git config panel (existing) ─────────────────────────────────────────────

function ConfigPanel({ repoPath, open }: { repoPath: string | null; open: boolean }) {
  const [scope, setScope] = useState<'local' | 'global'>('local')
  const { data: entries = [] } = useGitConfig(open ? repoPath : null, scope)
  const { set, unset } = useGitConfigMutations(repoPath)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const map = useMemo<Record<string, GitConfigEntry>>(() => {
    const m: Record<string, GitConfigEntry> = {}
    for (const e of entries) m[e.key] = e
    return m
  }, [entries])

  useEffect(() => { if (open) setDraft({}) }, [open, scope])

  async function commit(key: string, raw: string) {
    const value = raw.trim()
    if (!value) {
      if (map[key]) await unset.mutateAsync({ key, scope })
    } else if (map[key]?.value !== value) {
      await set.mutateAsync({ key, value, scope })
    }
  }

  async function saveAll() {
    for (const { key } of COMMON_KEYS) {
      if (key in draft) await commit(key, draft[key])
    }
    setDraft({})
  }

  return (
    <>
      <div className="flex items-center gap-1.5 pb-2">
        {(['local', 'global'] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)}
            className={`h-7 px-3 rounded text-[11.5px] capitalize ${scope === s ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
            {s}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-muted-foreground">
          {scope === 'local' ? 'Repository-level git config (.git/config)' : 'User-level git config (~/.gitconfig)'}
        </span>
      </div>

      <div className="border border-border rounded-md max-h-[360px] overflow-y-auto scrollbar-mac">
        {COMMON_KEYS.map(({ key, label }) => {
          const current = map[key]?.value ?? ''
          const value = key in draft ? draft[key] : current
          return (
            <div key={key} className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0">
              <div className="w-[180px] shrink-0">
                <div className="text-[12px] font-mono">{key}</div>
                <div className="text-[10.5px] text-muted-foreground">{label}</div>
              </div>
              <input value={value} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="h-7 flex-1 bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60" />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Tip: external diff/merge tools must already be configured (e.g. <code className="font-mono">code</code>, <code className="font-mono">meld</code>).
        </span>
        <button onClick={saveAll} disabled={Object.keys(draft).length === 0 || set.isPending}
          className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] disabled:opacity-40">
          {set.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  )
}

// ── Commit template panel ───────────────────────────────────────────────────

function TemplatePanel() {
  const [path, setPath] = useState('~/.gitmessage')
  const [content, setContent] = useState('')
  const [resolvedPath, setResolvedPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    let cancel = false
    setLoading(true)
    gitApi.readCommitTemplate(path).then((r) => {
      if (cancel) return
      setContent(r.content)
      setResolvedPath(r.path)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { cancel = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload() {
    setLoading(true)
    const r = await gitApi.readCommitTemplate(path)
    setContent(r.content); setResolvedPath(r.path); setLoading(false)
  }

  async function save() {
    setSaving(true)
    try {
      const file = await gitApi.writeCommitTemplate(path, content)
      setResolvedPath(file)
      setSavedNote('Saved')
      setTimeout(() => setSavedNote(''), 1500)
    } catch (e) {
      setSavedNote((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input value={path} onChange={(e) => setPath(e.target.value)}
          onBlur={reload}
          placeholder="~/.gitmessage"
          className="h-7 flex-1 bg-background/40 rounded px-2 text-[12px] font-mono outline-none border border-border/60" />
        <button onClick={reload} className="h-7 px-3 rounded text-[11.5px] text-muted-foreground hover:bg-muted">Reload</button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Saved at: <span className="font-mono">{resolvedPath || '—'}</span>. Tip: set <code className="font-mono">commit.template</code> in Git config to use this file.
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        rows={12}
        placeholder={loading ? 'Loading…' : 'Subject line\n\nBody — wrap at ~72 chars\n\n# Lines starting with # are stripped'}
        className="w-full bg-background/40 rounded px-3 py-2 text-[12px] font-mono outline-none border border-border/60 resize-y scrollbar-mac" />
      <div className="flex items-center justify-end gap-2">
        {savedNote && <span className="text-[11px] text-muted-foreground">{savedNote}</span>}
        <button onClick={save} disabled={saving || loading}
          className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] disabled:opacity-40">
          {saving ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </div>
  )
}

// ── SSH keys panel ──────────────────────────────────────────────────────────

function SshPanel({ open }: { open: boolean }) {
  const [keys, setKeys] = useState<{ name: string; path: string; publicKey: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('id_ed25519_novagitx')
  const [type, setType] = useState<'ed25519' | 'rsa'>('ed25519')
  const [comment, setComment] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function refresh() {
    setLoading(true)
    try { setKeys(await gitApi.listSshKeys()) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) refresh() }, [open])

  async function generate() {
    setError('')
    setGenerating(true)
    try {
      await gitApi.generateSshKey({ name, type, comment, passphrase })
      setShowForm(false)
      setPassphrase('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function copy(key: string, name: string) {
    await navigator.clipboard.writeText(key)
    setCopied(name)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Public keys in <code className="font-mono">~/.ssh/</code></span>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 h-7 px-3 rounded text-[11.5px] text-primary hover:bg-primary/10">
          <Plus className="size-3.5" />New key
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-md p-3 space-y-2 bg-background/30">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <div className="text-[10.5px] text-muted-foreground">File name</div>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="h-7 w-full bg-background/40 rounded px-2 text-[12px] font-mono outline-none border border-border/60" />
            </label>
            <label className="space-y-1">
              <div className="text-[10.5px] text-muted-foreground">Type</div>
              <select value={type} onChange={(e) => setType(e.target.value as 'ed25519' | 'rsa')}
                className="h-7 w-full bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60">
                <option value="ed25519">ed25519 (recommended)</option>
                <option value="rsa">rsa-4096</option>
              </select>
            </label>
            <label className="space-y-1">
              <div className="text-[10.5px] text-muted-foreground">Comment / email</div>
              <input value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="you@example.com"
                className="h-7 w-full bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60" />
            </label>
            <label className="space-y-1">
              <div className="text-[10.5px] text-muted-foreground">Passphrase (optional)</div>
              <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                className="h-7 w-full bg-background/40 rounded px-2 text-[12px] outline-none border border-border/60" />
            </label>
          </div>
          {error && <div className="text-[11px] text-destructive">{error}</div>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded text-[11.5px] text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={generate} disabled={generating || !name.trim()}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[11.5px] disabled:opacity-40 flex items-center gap-1.5">
              {generating && <Loader2 className="size-3 animate-spin" />}
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-md max-h-[280px] overflow-y-auto scrollbar-mac">
        {loading ? (
          <div className="p-4 text-[12px] text-muted-foreground">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-4 text-[12px] text-muted-foreground">No SSH keys found in ~/.ssh/. Create one above.</div>
        ) : keys.map((k) => (
          <div key={k.path} className="px-3 py-2 border-b border-border/50 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[12px] font-mono">{k.name}</div>
                <div className="text-[10.5px] text-muted-foreground font-mono">{k.path}</div>
              </div>
              <button onClick={() => copy(k.publicKey, k.name)}
                className="flex items-center gap-1 h-7 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted">
                <Copy className="size-3" />{copied === k.name ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-1 text-[10.5px] font-mono text-muted-foreground break-all">{k.publicKey}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
