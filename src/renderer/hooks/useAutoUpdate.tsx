import { useEffect, useRef } from 'react'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import type { UpdateStatus } from '@/api/git'

/**
 * Subscribes to auto-update status from the main process and surfaces it as toasts.
 * The only actionable state is `downloaded` — it offers a "Restart" button that
 * quits and installs the staged update. Other states are quiet or informational.
 *
 * Background checks stay silent on "up to date"/error to avoid launch noise. A
 * user-initiated check from the "Check for Updates…" menu item flips a one-shot
 * manual flag (via `onManualUpdateCheck`) so its result is always surfaced.
 */
export function useAutoUpdate(): void {
  const manualRef = useRef(false)

  useEffect(() => {
    const offManual = window.appOS.onManualUpdateCheck(() => {
      manualRef.current = true
      toast({ title: 'Checking for updates…' })
    })

    const offStatus = window.appOS.onUpdateStatus((status: UpdateStatus) => {
      const manual = manualRef.current
      // Any terminal result ends the manual window.
      if (status.state !== 'checking') manualRef.current = false

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

    return () => {
      offManual()
      offStatus()
    }
  }, [])
}
