import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Github, Copy, Check, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { githubApi } from '@/api/github'
import { toast } from '@/hooks/use-toast'
import { describeGitError } from '@/lib/gitError'
import type { DeviceCodeResponse, AuthStatus } from '@/types/github'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * OAuth Device Flow dialog. Adds a new account on success — existing accounts are
 * untouched, so this doubles as the "Add account" entry point.
 */
export function GitHubAuthDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [device, setDevice] = useState<DeviceCodeResponse | null>(null)
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const unsub = useRef<(() => void) | null>(null)

  // onClose is passed as an inline arrow by callers, so its identity changes on
  // every parent render. Keep it in a ref so the auth effect below depends only on
  // `open` — otherwise a parent re-render (the repo view polls every few seconds)
  // would tear down the in-flight poll and request a fresh device code, abandoning
  // the code the user just authorized ("Waiting for authorization…" forever).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Begin the flow whenever the dialog opens; clean up the poll on close.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus(null)
    setDevice(null)
    setStarting(true)

    unsub.current = githubApi.onAuthStatus((s) => setStatus(s))

    githubApi
      .startDeviceFlow()
      .then((d) => {
        if (cancelled) return
        setDevice(d)
        setStarting(false)
        return githubApi.pollForToken(d.deviceCode, d.interval)
      })
      .then((account) => {
        if (cancelled || !account) return
        qc.invalidateQueries({ queryKey: ['gh', 'accounts'] })
        toast({ title: 'Signed in to GitHub', description: `@${account.login}` })
        onCloseRef.current()
      })
      .catch((err) => {
        if (cancelled) return
        setStarting(false)
        const { title, description } = describeGitError(err)
        toast({ variant: 'destructive', title, description })
        onCloseRef.current()
      })

    return () => {
      cancelled = true
      githubApi.cancelAuth()
      unsub.current?.()
      unsub.current = null
    }
  }, [open, qc])

  const copyCode = () => {
    if (!device) return
    navigator.clipboard.writeText(device.userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const openVerify = () => {
    if (device) window.appOS.openExternal(device.verificationUri)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-4" />
            Sign in to GitHub
          </DialogTitle>
        </DialogHeader>

        {starting || !device ? (
          <div className="flex items-center gap-2 py-8 justify-center text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Requesting device code…
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Enter this code at <span className="font-mono text-foreground">github.com/login/device</span> to
              authorize NovaGitX. The window will update automatically once you approve.
            </p>

            <div className="flex items-center justify-center gap-2">
              <code className="text-[22px] font-mono tracking-[0.25em] px-4 py-2 rounded-md bg-muted border border-border select-all">
                {device.userCode}
              </code>
              <button
                onClick={copyCode}
                title="Copy code"
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
              >
                {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
              </button>
            </div>

            <button
              onClick={openVerify}
              className="flex items-center justify-center gap-2 h-9 rounded-md bg-primary text-primary-foreground text-[12.5px] font-medium hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Open github.com/login/device
            </button>

            <div className="flex items-center gap-2 text-[12px] text-muted-foreground min-h-[20px]">
              {statusLine(status)}
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md text-[12px] text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function statusLine(status: AuthStatus | null) {
  switch (status?.kind) {
    case 'pending':
    case 'slow_down':
      return (<><Loader2 className="size-3.5 animate-spin" /> Waiting for authorization…</>)
    case 'authorized':
      return (<><Check className="size-3.5 text-green-500" /> Authorized — signing in…</>)
    case 'expired':
      return <span className="text-destructive">Code expired. Close and try again.</span>
    case 'denied':
      return <span className="text-destructive">Authorization was denied.</span>
    case 'error':
      return <span className="text-destructive">{status.message}</span>
    default:
      return (<><Loader2 className="size-3.5 animate-spin" /> Waiting for authorization…</>)
  }
}
