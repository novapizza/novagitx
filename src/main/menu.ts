import * as electronMain from 'electron/main'
import { checkForUpdatesManually } from './updater.js'

const { app, Menu, shell } = electronMain

const REPO_URL = 'https://github.com/novapizza/novagitx'

/**
 * Builds the application menu. On macOS the "Check for Updates…" item sits right
 * under "About NovaGitX" in the app menu, matching platform convention; on
 * Windows/Linux (which have no app menu) it lives under Help.
 *
 * Setting a custom menu replaces Electron's default, so the standard Edit/View/
 * Window roles are recreated here to preserve copy/paste, dev tools, etc.
 */
export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const checkForUpdatesItem: Electron.MenuItemConstructorOptions = {
    label: 'Check for Updates…',
    click: () => checkForUpdatesManually(),
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              checkForUpdatesItem,
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ] as Electron.MenuItemConstructorOptions[])
          : ([{ role: 'close' }] as Electron.MenuItemConstructorOptions[])),
      ],
    },
    {
      role: 'help',
      submenu: [
        ...(!isMac
          ? ([checkForUpdatesItem, { type: 'separator' }] as Electron.MenuItemConstructorOptions[])
          : []),
        { label: 'Learn More', click: () => shell.openExternal(REPO_URL) },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
