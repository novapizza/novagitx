import * as electronMain from 'electron/main'
import { shell } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { stat } from 'fs/promises'
import { registerHandlers } from './ipc/handlers.js'
import { CHANNELS } from './ipc/channels.js'
import { GitModule } from './git/GitModule.js'
import { initAutoUpdater } from './updater.js'
import { buildAppMenu } from './menu.js'

const { app, BrowserWindow, nativeTheme } = electronMain
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = process.env.NODE_ENV === 'development'

let mainWindow: Electron.BrowserWindow | null = null
let pendingRepoPath: string | null = null

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

async function extractRepoPathFromArgv(argv: string[]): Promise<string | null> {
  // Skip the executable; on Windows packaged builds the first arg is the .exe.
  // The OS context-menu invocation passes the directory as the last positional arg.
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (!arg || arg.startsWith('-')) continue
    if (await isDirectory(arg)) return arg
  }
  return null
}

async function openRepoFromOS(repoPath: string): Promise<void> {
  if (!(await isDirectory(repoPath))) return
  const mod = new GitModule(repoPath)
  if (!(await mod.isValidRepo())) return
  const info = await mod.getRepoInfo()
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send(CHANNELS.REPO_OPENED_FROM_OS, info)
  } else {
    pendingRepoPath = repoPath
  }
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  const platformOpts: Electron.BrowserWindowConstructorOptions = isMac
    ? {
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 12, y: 14 },
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
      }
    : isWin
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#888888',
            height: 44,
          },
          backgroundColor: '#1e1e1e',
        }
      : {
          frame: false,
          backgroundColor: '#1e1e1e',
        }

  // For mac, .icns embedded in the bundle is used; ignored elsewhere.
  // For Windows/Linux dev runs the bundled .ico/.png isn't available, so point at resources/icon.png.
  const iconPath = isMac ? undefined : join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    ...platformOpts,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    if (pendingRepoPath) {
      const path = pendingRepoPath
      pendingRepoPath = null
      openRepoFromOS(path)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' as const }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // Windows: a second invocation (e.g. from Explorer context menu) forwards its argv here.
  app.on('second-instance', async (_event: Electron.Event, argv: string[]) => {
    const repoPath = await extractRepoPathFromArgv(argv)
    if (repoPath) openRepoFromOS(repoPath)
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // macOS: fired by the Services menu and `open` command with a path.
  app.on('open-file', (event: Electron.Event, path: string) => {
    event.preventDefault()
    if (app.isReady()) openRepoFromOS(path)
    else pendingRepoPath = path
  })

  app.whenReady().then(async () => {
    registerHandlers()
    buildAppMenu()
    createWindow()
    initAutoUpdater()

    // Resolve initial argv (Windows context-menu launch) off the critical path.
    extractRepoPathFromArgv(process.argv).then((p) => {
      if (!p) return
      if (mainWindow && !mainWindow.webContents.isLoading()) openRepoFromOS(p)
      else pendingRepoPath = p
    })

    nativeTheme.on('updated', () => {
      const dark = nativeTheme.shouldUseDarkColors
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(CHANNELS.THEME_CHANGED, { shouldUseDarkColors: dark })
        if (process.platform === 'win32') {
          win.setTitleBarOverlay?.({
            color: '#00000000',
            symbolColor: dark ? '#cccccc' : '#333333',
          })
        }
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
