import { useEffect } from 'react'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import type { UpdateStatus } from '@/api/git'

/**
 * Subscribes to auto-update status from the main process and surfaces it as toasts.
 * The only actionable state is `downloaded` — it offers a "Restart" button that
 * quits and installs the staged update. Other states are quiet or informational.
 *
 * `manual` controls whether "checking"/"up to date" toasts show. Background checks
 * stay silent; pass true when wiring a user-initiated "Check for updates" action.
 */
export function useAutoUpdate({ manual = false }: { manual?: boolean } = {}): void {
  useEffect(() => {
    return window.appOS.onUpdateStatus((status: UpdateStatus) => {
      switch (status.state) {
        case 'available':
          toast({
            title: `Update available — v${status.version}`,
            description: 'Downloading in the background…',
          })
          break
        case 'downloaded':
          toast({
            title: `Update ready — v${status.version}`,
            description: 'Restart to finish installing.',
            duration: Infinity,
            action: (
              <ToastAction altText="Restart now" onClick={() => window.appOS.installUpdate()}>
                Restart
              </ToastAction>
            ),
          })
          break
        case 'error':
          // Background failures are usually transient (offline, etc.) — only show
          // on a user-initiated check to avoid noise on launch.
          if (manual) {
            toast({
              title: 'Update check failed',
              description: status.message,
              variant: 'destructive',
            })
          }
          break
        case 'not-available':
          if (manual) toast({ title: "You're up to date" })
          break
      }
    })
  }, [manual])
}
