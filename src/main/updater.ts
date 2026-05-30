import * as electronMain from 'electron/main'
// electron-updater is CommonJS; in this ESM main process we take the default
// export and destructure autoUpdater off it.
import electronUpdater from 'electron-updater'
import { CHANNELS } from './ipc/channels.js'

const { app, ipcMain, BrowserWindow } = electronMain
const { autoUpdater } = electronUpdater

/** Status pushed to the renderer over CHANNELS.UPDATE_STATUS. */
export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

// Re-check this often while the app stays open (6h).
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

function broadcast(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(CHANNELS.UPDATE_STATUS, status)
  }
}

let initialized = false

export function initAutoUpdater(): void {
  // Auto-update only works on packaged, signed builds. In dev there is no
  // app-update.yml, so checking would throw — skip entirely.
  if (initialized || !app.isPackaged) return
  initialized = true

  // We surface progress in-app and let the user choose when to restart.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    broadcast({ state: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => broadcast({ state: 'not-available' }))
  autoUpdater.on('download-progress', (p) =>
    broadcast({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) =>
    broadcast({ state: 'error', message: err?.message ?? String(err) })
  )

  // Renderer-triggered manual check (e.g. a "Check for updates" menu item).
  ipcMain.handle(CHANNELS.UPDATE_CHECK, async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      broadcast({ state: 'error', message: (err as Error)?.message ?? String(err) })
    }
  })

  // Renderer-triggered install: quit and apply the staged update now.
  ipcMain.handle(CHANNELS.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })

  // Initial check shortly after launch, then on an interval.
  autoUpdater.checkForUpdates().catch((err) =>
    broadcast({ state: 'error', message: (err as Error)?.message ?? String(err) })
  )
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {
      /* transient; next tick retries */
    })
  }, CHECK_INTERVAL_MS)
}
