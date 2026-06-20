# NovaGitX

A native-feeling macOS Git GUI built with Electron, React, and TypeScript. Inspired by GitExtensions, redesigned for macOS.

![NovaGitX](resources/icon.icns)

## Features

- **Commit graph** — visual branch lane graph with topological ordering
- **Staging area** — stage/unstage files and individual hunks
- **Diff viewer** — unified diff with line numbers and hunk-level staging
- **Branch management** — create, checkout, rename, delete, set upstream
- **Remote operations** — fetch, pull, push with ahead/behind indicators
- **Merge & Rebase** — merge strategies, standard and interactive rebase
- **3-way merge editor** — resolve conflicts with base/ours/theirs side by side
- **Conflict resolution** — ours/theirs strategy per file
- **Word-level diff** — intra-line highlighting of added/removed words
- **Undo last action** — revert the most recent git operation
- **Stash manager** — save with flags, pop/apply/drop, diff preview
- **Tags** — create, delete, push to remote
- **Reflog** — browse and checkout any reflog entry
- **Blame** — line-by-line blame with commit info
- **File history** — full log for any file with rename tracking
- **Compare branches** — side-by-side diff between any two refs
- **Submodules** — list, add, update, remove
- **Clean** — dry-run preview then remove untracked files
- **Patch** — format-patch export and apply (git am / git apply)
- **.gitignore / .gitattributes** — in-app editor
- **Command palette** — ⌘K search across commits, branches, files

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop | Electron 41 via electron-vite |
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| State | Zustand (UI) + TanStack React Query (git data) |
| Git | Node.js `child_process.spawn` — no libgit2 dependency |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (hot-reload renderer, restarts main on save)
npm run dev

# Production build
npm run build

# Package as .app
npm run pack

# Create distributable .dmg
npm run dist
```

> **Note:** Changes to `src/main/` or `src/preload/` require restarting `npm run dev` — only the renderer hot-reloads.

## Project Structure

```
src/
├── main/               # Electron main process (Node.js)
│   ├── index.ts        # BrowserWindow setup
│   ├── ipc/
│   │   ├── channels.ts # IPC channel name constants
│   │   └── handlers.ts # ipcMain.handle() registrations
│   └── git/
│       ├── GitExecutor.ts    # git subprocess wrapper
│       ├── GitModule.ts      # facade — one instance per repo
│       ├── RevisionReader.ts # git log parser
│       ├── RefResolver.ts    # git for-each-ref parser
│       ├── GraphBuilder.ts   # branch lane algorithm
│       ├── StatusParser.ts   # git status parser
│       └── DiffParser.ts     # unified diff parser
├── preload/
│   └── index.ts        # contextBridge → window.git
└── renderer/           # React SPA
    ├── api/git.ts      # typed window.git wrappers
    ├── hooks/useRepo.ts # React Query hooks
    ├── store/repoStore.ts # Zustand store
    ├── components/git/ # Git UI components
    └── pages/          # Welcome + Repository views
```

## Adding a New Git Operation

Every feature threads through 5 files in order:

1. `src/main/ipc/channels.ts` — add a channel constant
2. `src/main/ipc/handlers.ts` — register `ipcMain.handle`
3. `src/preload/index.ts` — expose via `contextBridge`
4. `src/renderer/api/git.ts` — add typed wrapper + Window interface
5. `src/renderer/hooks/useRepo.ts` — add `useQuery` / `useMutation`

## Requirements

- macOS 12+
- Node.js 18+
- Git installed and available in PATH

## License

MIT
