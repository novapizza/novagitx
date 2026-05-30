import { contextBridge, ipcRenderer } from 'electron/renderer'
import { CHANNELS } from '../main/ipc/channels.js'

const themeApi = {
  getTheme: (): Promise<{ shouldUseDarkColors: boolean; themeSource: 'system' | 'light' | 'dark' }> =>
    ipcRenderer.invoke(CHANNELS.THEME_GET),
  setThemeSource: (source: 'system' | 'light' | 'dark'): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.THEME_SET, source),
  onThemeChanged: (cb: (dark: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: { shouldUseDarkColors: boolean }) =>
      cb(payload.shouldUseDarkColors)
    ipcRenderer.on(CHANNELS.THEME_CHANGED, listener)
    return () => ipcRenderer.removeListener(CHANNELS.THEME_CHANGED, listener)
  },
}
import type { LogOptions, BlameLine, ReflogEntry, Remote, ConflictFile, StashEntry, Submodule, CleanEntry, RebaseCommit, RepoInfo } from '../main/git/types.js'

const appApi = {
  platform: process.platform as NodeJS.Platform,
  onRepoOpenedFromOS: (cb: (info: RepoInfo) => void) => {
    const listener = (_: Electron.IpcRendererEvent, info: RepoInfo) => cb(info)
    ipcRenderer.on(CHANNELS.REPO_OPENED_FROM_OS, listener)
    return () => ipcRenderer.removeListener(CHANNELS.REPO_OPENED_FROM_OS, listener)
  },
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke(CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(CHANNELS.OPEN_EXTERNAL, url),

  // Auto-update
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke(CHANNELS.UPDATE_CHECK),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(CHANNELS.UPDATE_INSTALL),
  onUpdateStatus: (cb: (status: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, status: unknown) => cb(status)
    ipcRenderer.on(CHANNELS.UPDATE_STATUS, listener)
    return () => ipcRenderer.removeListener(CHANNELS.UPDATE_STATUS, listener)
  },
}

const gitApi = {
  // Repo
  openRepo: () =>
    ipcRenderer.invoke(CHANNELS.REPO_OPEN),
  getRepoInfo: (repoPath: string) =>
    ipcRenderer.invoke(CHANNELS.REPO_INFO, repoPath),
  cloneRepo: (url: string, destination: string, depth?: number) =>
    ipcRenderer.invoke(CHANNELS.REPO_CLONE, url, destination, depth),
  initRepo: (path?: string) =>
    ipcRenderer.invoke(CHANNELS.REPO_INIT, path),

  // Log / refs
  getLog: (repoPath: string, opts?: LogOptions) =>
    ipcRenderer.invoke(CHANNELS.LOG_GET, repoPath, opts),
  getRefs: (repoPath: string) =>
    ipcRenderer.invoke(CHANNELS.REFS_GET, repoPath),
  getStatus: (repoPath: string) =>
    ipcRenderer.invoke(CHANNELS.STATUS_GET, repoPath),

  // Diff
  getDiffCommit: (repoPath: string, commitHash: string) =>
    ipcRenderer.invoke(CHANNELS.DIFF_COMMIT, repoPath, commitHash),
  getDiffFile: (repoPath: string, commitHash: string, filePath: string) =>
    ipcRenderer.invoke(CHANNELS.DIFF_FILE, repoPath, commitHash, filePath),
  getDiffWorking: (repoPath: string, filePath?: string) =>
    ipcRenderer.invoke(CHANNELS.DIFF_WORKING, repoPath, filePath),
  getDiffStaged: (repoPath: string, filePath?: string) =>
    ipcRenderer.invoke(CHANNELS.DIFF_STAGED, repoPath, filePath),

  // Branch
  checkoutBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke(CHANNELS.BRANCH_CHECKOUT, repoPath, branchName),
  createBranch: (repoPath: string, name: string, from?: string) =>
    ipcRenderer.invoke(CHANNELS.BRANCH_CREATE, repoPath, name, from),
  deleteBranch: (repoPath: string, name: string, force?: boolean) =>
    ipcRenderer.invoke(CHANNELS.BRANCH_DELETE, repoPath, name, force),
  renameBranch: (repoPath: string, oldName: string, newName: string) =>
    ipcRenderer.invoke(CHANNELS.BRANCH_RENAME, repoPath, oldName, newName),
  mergeBranch: (repoPath: string, branch: string, strategy?: string) =>
    ipcRenderer.invoke(CHANNELS.BRANCH_MERGE, repoPath, branch, strategy),

  // Remote
  fetch: (repoPath: string, remote?: string) =>
    ipcRenderer.invoke(CHANNELS.REMOTE_FETCH, repoPath, remote),
  pull: (repoPath: string, remote: string, branch: string) =>
    ipcRenderer.invoke(CHANNELS.REMOTE_PULL, repoPath, remote, branch),
  push: (repoPath: string, remote: string, branch: string, force?: boolean) =>
    ipcRenderer.invoke(CHANNELS.REMOTE_PUSH, repoPath, remote, branch, force),

  // Staging & commit
  stageFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_STAGE, repoPath, filePath),
  unstageFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_UNSTAGE, repoPath, filePath),
  discardFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_DISCARD, repoPath, filePath),
  createCommit: (repoPath: string, message: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_CREATE, repoPath, message),
  amendCommit: (repoPath: string, message?: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_AMEND, repoPath, message),
  revertCommit: (repoPath: string, hash: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_REVERT, repoPath, hash),
  resetToCommit: (repoPath: string, hash: string, mode: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_RESET, repoPath, hash, mode),
  cherryPick: (repoPath: string, hash: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_CHERRY_PICK, repoPath, hash),
  createTag: (repoPath: string, name: string, hash?: string, message?: string) =>
    ipcRenderer.invoke(CHANNELS.TAG_CREATE, repoPath, name, hash, message),
  deleteTag: (repoPath: string, name: string) =>
    ipcRenderer.invoke(CHANNELS.TAG_DELETE, repoPath, name),
  pushTag: (repoPath: string, remote: string, name: string) =>
    ipcRenderer.invoke(CHANNELS.TAG_PUSH, repoPath, remote, name),

  // Stash
  stashSave: (repoPath: string, message?: string) =>
    ipcRenderer.invoke(CHANNELS.STASH_SAVE, repoPath, message),
  stashApply: (repoPath: string, ref: string) =>
    ipcRenderer.invoke(CHANNELS.STASH_APPLY, repoPath, ref),
  stashDrop: (repoPath: string, ref: string) =>
    ipcRenderer.invoke(CHANNELS.STASH_DROP, repoPath, ref),

  // File History
  getFileHistory: (repoPath: string, filePath: string, opts?: LogOptions): Promise<ReturnType<typeof ipcRenderer.invoke>> =>
    ipcRenderer.invoke(CHANNELS.LOG_FILE, repoPath, filePath, opts),

  // Reflog
  getReflog: (repoPath: string): Promise<ReflogEntry[]> =>
    ipcRenderer.invoke(CHANNELS.LOG_REFLOG, repoPath),

  // Blame
  getBlame: (repoPath: string, filePath: string, commitHash?: string): Promise<BlameLine[]> =>
    ipcRenderer.invoke(CHANNELS.DIFF_BLAME, repoPath, filePath, commitHash),

  // Remotes CRUD
  getRemotes: (repoPath: string): Promise<Remote[]> =>
    ipcRenderer.invoke(CHANNELS.REMOTE_LIST, repoPath),
  addRemote: (repoPath: string, name: string, url: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REMOTE_ADD, repoPath, name, url),
  removeRemote: (repoPath: string, name: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REMOTE_REMOVE, repoPath, name),
  renameRemote: (repoPath: string, oldName: string, newName: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REMOTE_RENAME, repoPath, oldName, newName),
  pruneRemote: (repoPath: string, name: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REMOTE_PRUNE, repoPath, name),

  // Rebase
  rebase: (repoPath: string, onto: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.BRANCH_REBASE, repoPath, onto),
  abortRebase: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.BRANCH_REBASE_ABORT, repoPath),

  // Conflicts
  getConflicts: (repoPath: string): Promise<ConflictFile[]> =>
    ipcRenderer.invoke(CHANNELS.CONFLICT_LIST, repoPath),
  resolveConflict: (repoPath: string, filePath: string, strategy: 'ours' | 'theirs'): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.CONFLICT_RESOLVE, repoPath, filePath, strategy),

  // Partial staging
  stageHunk: (repoPath: string, patch: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.STAGE_HUNK, repoPath, patch),
  unstageHunk: (repoPath: string, patch: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.UNSTAGE_HUNK, repoPath, patch),

  // Stash improvements
  stashPop: (repoPath: string, ref?: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.STASH_POP, repoPath, ref),
  stashSaveFlags: (repoPath: string, message?: string, includeUntracked?: boolean, all?: boolean): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.STASH_SAVE_FLAGS, repoPath, message, includeUntracked, all),
  listStashes: (repoPath: string): Promise<StashEntry[]> =>
    ipcRenderer.invoke(CHANNELS.STASH_LIST, repoPath),
  getStashDiff: (repoPath: string, ref: string): Promise<ReturnType<typeof ipcRenderer.invoke>> =>
    ipcRenderer.invoke(CHANNELS.STASH_DIFF, repoPath, ref),

  // Compare
  compareDiff: (repoPath: string, ref1: string, ref2: string, filePath?: string): Promise<ReturnType<typeof ipcRenderer.invoke>> =>
    ipcRenderer.invoke(CHANNELS.DIFF_COMPARE, repoPath, ref1, ref2, filePath),

  // Branch extras
  setUpstream: (repoPath: string, branch: string, upstream: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.BRANCH_SET_UPSTREAM, repoPath, branch, upstream),
  checkoutRemoteBranch: (repoPath: string, remoteBranch: string, localName?: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.BRANCH_CHECKOUT_REMOTE, repoPath, remoteBranch, localName),
  checkoutRevision: (repoPath: string, hash: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.BRANCH_CHECKOUT_HASH, repoPath, hash),

  // Interactive rebase
  getRebaseCommits: (repoPath: string, base: string): Promise<RebaseCommit[]> =>
    ipcRenderer.invoke(CHANNELS.LOG_REBASE_COMMITS, repoPath, base),
  interactiveRebase: (repoPath: string, base: string, commits: RebaseCommit[]): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REBASE_INTERACTIVE, repoPath, base, commits),

  // Patch
  formatPatch: (repoPath: string, base: string, outputDir: string): Promise<string[]> =>
    ipcRenderer.invoke(CHANNELS.PATCH_FORMAT, repoPath, base, outputDir),
  applyPatch: (repoPath: string, patchPath: string, useAm?: boolean): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.PATCH_APPLY, repoPath, patchPath, useAm),
  openDirDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(CHANNELS.DIALOG_OPEN_DIR),
  openFileDialog: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke(CHANNELS.DIALOG_OPEN_FILE, filters),

  // Submodules
  listSubmodules: (repoPath: string): Promise<Submodule[]> =>
    ipcRenderer.invoke(CHANNELS.SUBMODULE_LIST, repoPath),
  addSubmodule: (repoPath: string, url: string, path: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.SUBMODULE_ADD, repoPath, url, path),
  updateSubmodules: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.SUBMODULE_UPDATE, repoPath),
  removeSubmodule: (repoPath: string, path: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.SUBMODULE_REMOVE, repoPath, path),

  // Clean
  cleanDryRun: (repoPath: string): Promise<CleanEntry[]> =>
    ipcRenderer.invoke(CHANNELS.REPO_CLEAN_DRY, repoPath),
  clean: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REPO_CLEAN, repoPath),

  // .gitignore / .gitattributes
  readGitignore: (repoPath: string): Promise<string> =>
    ipcRenderer.invoke(CHANNELS.REPO_READ_GITIGNORE, repoPath),
  writeGitignore: (repoPath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REPO_WRITE_GITIGNORE, repoPath, content),
  addToGitignore: (repoPath: string, pattern: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REPO_ADD_GITIGNORE, repoPath, pattern),
  readGitattributes: (repoPath: string): Promise<string> =>
    ipcRenderer.invoke(CHANNELS.REPO_READ_GITATTRIBUTES, repoPath),
  writeGitattributes: (repoPath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.REPO_WRITE_GITATTRIBUTES, repoPath, content),

  // Worktrees
  listWorktrees: (repoPath: string) => ipcRenderer.invoke(CHANNELS.WORKTREE_LIST, repoPath),
  addWorktree: (repoPath: string, path: string, ref: string, newBranch?: string) =>
    ipcRenderer.invoke(CHANNELS.WORKTREE_ADD, repoPath, path, ref, newBranch),
  removeWorktree: (repoPath: string, path: string, force?: boolean) =>
    ipcRenderer.invoke(CHANNELS.WORKTREE_REMOVE, repoPath, path, force),
  pruneWorktrees: (repoPath: string) => ipcRenderer.invoke(CHANNELS.WORKTREE_PRUNE, repoPath),

  // Archive
  archive: (repoPath: string, ref: string, format: 'zip' | 'tar.gz', outputPath: string) =>
    ipcRenderer.invoke(CHANNELS.REPO_ARCHIVE, repoPath, ref, format, outputPath),

  // fsck
  fsck: (repoPath: string) => ipcRenderer.invoke(CHANNELS.REPO_FSCK, repoPath),

  // GPG signing
  getCommitSignature: (repoPath: string, hash: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_SIGNATURE, repoPath, hash),
  createSignedCommit: (repoPath: string, message: string) =>
    ipcRenderer.invoke(CHANNELS.COMMIT_SIGN, repoPath, message),

  // Mailmap
  readMailmap: (repoPath: string) => ipcRenderer.invoke(CHANNELS.REPO_READ_MAILMAP, repoPath),
  writeMailmap: (repoPath: string, content: string) => ipcRenderer.invoke(CHANNELS.REPO_WRITE_MAILMAP, repoPath, content),

  // Sparse checkout
  getSparseCheckout: (repoPath: string) => ipcRenderer.invoke(CHANNELS.SPARSE_GET, repoPath),
  setSparseCheckout: (repoPath: string, patterns: string[], cone: boolean) =>
    ipcRenderer.invoke(CHANNELS.SPARSE_SET, repoPath, patterns, cone),

  // Git config
  listConfig: (repoPath: string, scope: 'local' | 'global') =>
    ipcRenderer.invoke(CHANNELS.CONFIG_LIST, repoPath, scope),
  getConfigValue: (repoPath: string, key: string, scope: 'local' | 'global') =>
    ipcRenderer.invoke(CHANNELS.CONFIG_GET, repoPath, key, scope),
  setConfigValue: (repoPath: string, key: string, value: string, scope: 'local' | 'global') =>
    ipcRenderer.invoke(CHANNELS.CONFIG_SET, repoPath, key, value, scope),
  unsetConfigValue: (repoPath: string, key: string, scope: 'local' | 'global') =>
    ipcRenderer.invoke(CHANNELS.CONFIG_UNSET, repoPath, key, scope),

  // Save-file dialog
  saveFileDialog: (defaultPath?: string, filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke(CHANNELS.DIALOG_SAVE_FILE, defaultPath, filters),

  // Commit template
  readCommitTemplate: (path?: string): Promise<{ path: string; content: string }> =>
    ipcRenderer.invoke(CHANNELS.TEMPLATE_READ, path),
  writeCommitTemplate: (path: string | undefined, content: string): Promise<string> =>
    ipcRenderer.invoke(CHANNELS.TEMPLATE_WRITE, path, content),

  // SSH keys
  listSshKeys: (): Promise<{ name: string; path: string; publicKey: string }[]> =>
    ipcRenderer.invoke(CHANNELS.SSH_LIST),
  generateSshKey: (args: { name: string; type: 'ed25519' | 'rsa'; comment: string; passphrase: string }): Promise<{ name: string; path: string; publicKey: string }> =>
    ipcRenderer.invoke(CHANNELS.SSH_GENERATE, args),
}

contextBridge.exposeInMainWorld('git', gitApi)
contextBridge.exposeInMainWorld('theme', themeApi)
contextBridge.exposeInMainWorld('appOS', appApi)

export type GitApi = typeof gitApi
export type ThemeApi = typeof themeApi
export type AppApi = typeof appApi
