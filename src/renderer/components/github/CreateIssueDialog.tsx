import { useState, useEffect } from 'react'
import { CircleDot, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useIssueMutations } from '@/hooks/useGitHub'
import { toast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onClose: () => void
  owner: string | null
  repo: string | null
}

export function CreateIssueDialog({ open, onClose, owner, repo }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const { create } = useIssueMutations(owner, repo)

  useEffect(() => {
    if (open) { setTitle(''); setBody('') }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!owner || !repo || !title.trim()) return
    const issue = await create.mutateAsync({ title: title.trim(), body: body.trim() || undefined })
    toast({ title: `Issue #${issue.number} created`, description: issue.title })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !create.isPending) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CircleDot className="size-4" /> New issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
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
            rows={6}
            className="rounded-md border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-primary/50 resize-none scrollbar-mac"
          />
          <DialogFooter>
            <button type="button" onClick={onClose} disabled={create.isPending}
              className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={create.isPending || !title.trim()}
              className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5">
              {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Create issue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
