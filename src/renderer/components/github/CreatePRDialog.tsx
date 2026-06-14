import { useState, useEffect } from 'react'
import { GitPullRequest, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { gitApi } from '@/api/git'
import { usePullRequestMutations } from '@/hooks/useGitHub'
import { toast } from '@/hooks/use-toast'
import { describeGitError } from '@/lib/gitError'

interface Props {
  open: boolean
  onClose: () => void
  repoPath: string | null
  owner: string | null
  repo: string | null
  currentBranch: string | null
  defaultBase: string
  /** Prefill the title from the latest commit subject. */
  defaultTitle?: string
}

export function CreatePRDialog({
  open, onClose, repoPath, owner, repo, currentBranch, defaultBase, defaultTitle,
}: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [base, setBase] = useState(defaultBase)
  const [draft, setDraft] = useState(false)
  const [pushing, setPushing] = useState(false)
  const { create } = usePullRequestMutations(owner, repo)

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle ?? '')
      setBody('')
      setBase(defaultBase)
      setDraft(false)
    }
  }, [open, defaultTitle, defaultBase])

  const busy = pushing || create.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!owner || !repo || !currentBranch || !title.trim()) return
    try {
      // Ensure the head branch exists on the remote before opening the PR.
      setPushing(true)
      await gitApi.push(repoPath!, 'origin', currentBranch, false)
      setPushing(false)

      const pr = await create.mutateAsync({
        title: title.trim(), body: body.trim() || undefined, head: currentBranch, base, draft,
      })
      toast({ title: `Pull request #${pr.number} created`, description: pr.title })
      onClose()
    } catch (err) {
      setPushing(false)
      const { title: t, description } = describeGitError(err)
      toast({ variant: 'destructive', title: t, description })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="size-4" /> New pull request
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="font-mono text-foreground">{currentBranch ?? '—'}</span>
            <span>→</span>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[12px] font-mono outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px] outline-none focus:ring-1 focus:ring-primary/50"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Description (optional)"
            rows={5}
            className="rounded-md border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-primary/50 resize-none scrollbar-mac"
          />
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            Create as draft
          </label>
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={busy}
              className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={busy || !title.trim() || !currentBranch}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5">
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {pushing ? 'Pushing…' : 'Create pull request'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
