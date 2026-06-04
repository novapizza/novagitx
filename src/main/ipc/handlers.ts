import { ipcMain, dialog, nativeTheme, BrowserWindow } from 'electron/main'
import { shell } from 'electron'
import { CHANNELS } from './channels.js'
import { GitModule } from '../git/GitModule.js'
import type { LogOptions, RebaseCommit } from '../git/types.js'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { spawn } from 'child_process'

const modules = new Map<string, GitModule>()

function getModule(repoPath: string): GitModule {
  if (!modules.has(repoPath)) modules.set(repoPath, new GitModule(repoPath))
  return modules.get(repoPath)!
}

export function registerHandlers(): void {
  // ── Repo ──────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_OPEN, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: 'Open Git Repository',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    const mod = getModule(path)
    if (!(await mod.isValidRepo())) return null
    return mod.getRepoInfo()
  })

  ipcMain.handle(CHANNELS.REPO_INFO, async (_, repoPath: string) => {
    return getModule(repoPath).getRepoInfo()
  })

  ipcMain.handle(CHANNELS.REPO_CLONE, async (_, url: string, destination: string, depth?: number) => {
    return GitModule.clone(url, destination, depth)
  })

  ipcMain.handle(CHANNELS.REPO_INIT, async (_, path?: string) => {
    let targetPath = path
    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        message: 'Choose folder to initialize as Git repository',
        buttonLabel: 'Initialize Here',
      })
      if (result.canceled || !result.filePaths[0]) return null
      targetPath = result.filePaths[0]
    }
    return GitModule.initRepo(targetPath)
  })

  // ── Log / refs ────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.LOG_GET, async (_, repoPath: string, opts?: LogOptions) => {
    return getModule(repoPath).getRevisions(opts)
  })

  ipcMain.handle(CHANNELS.REFS_GET, async (_, repoPath: string) => {
    return getModule(repoPath).getRefs()
  })

  ipcMain.handle(CHANNELS.STATUS_GET, async (_, repoPath: string) => {
    return getModule(repoPath).getStatus()
  })

  ipcMain.handle(CHANNELS.REPO_LIST_FILES, async (_, repoPath: string) => {
    return getModule(repoPath).listFiles()
  })

  // ── Diff ──────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.DIFF_COMMIT, async (_, repoPath: string, commitHash: string) => {
    return getModule(repoPath).getDiff(commitHash)
  })

  ipcMain.handle(CHANNELS.DIFF_FILE, async (_, repoPath: string, commitHash: string, filePath: string) => {
    return getModule(repoPath).getDiff(commitHash, filePath)
  })

  ipcMain.handle(CHANNELS.DIFF_WORKING, async (_, repoPath: string, filePath?: string) => {
    return getModule(repoPath).getWorkingDiff(filePath)
  })

  ipcMain.handle(CHANNELS.DIFF_STAGED, async (_, repoPath: string, filePath?: string) => {
    return getModule(repoPath).getStagedDiff(filePath)
  })

  // ── Branch ────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.BRANCH_CHECKOUT, async (_, repoPath: string, branchName: string) => {
    await getModule(repoPath).checkoutBranch(branchName)
  })

  ipcMain.handle(CHANNELS.BRANCH_CREATE, async (_, repoPath: string, name: string, from?: string) => {
    await getModule(repoPath).createBranch(name, from)
  })

  ipcMain.handle(CHANNELS.BRANCH_DELETE, async (_, repoPath: string, name: string, force?: boolean) => {
    await getModule(repoPath).deleteBranch(name, force)
  })

  ipcMain.handle(CHANNELS.BRANCH_RENAME, async (_, repoPath: string, oldName: string, newName: string) => {
    await getModule(repoPath).renameBranch(oldName, newName)
  })

  ipcMain.handle(CHANNELS.BRANCH_MERGE, async (_, repoPath: string, branch: string, strategy?: string) => {
    await getModule(repoPath).mergeBranch(branch, strategy as any)
  })

  // ── Remote ────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REMOTE_FETCH, async (_, repoPath: string, remote?: string) => {
    await getModule(repoPath).fetch(remote)
  })

  ipcMain.handle(CHANNELS.REMOTE_PULL, async (_, repoPath: string, remote: string, branch: string) => {
    await getModule(repoPath).pull(remote, branch)
  })

  ipcMain.handle(CHANNELS.REMOTE_PUSH, async (_, repoPath: string, remote: string, branch: string, force?: boolean) => {
    await getModule(repoPath).push(remote, branch, force)
  })

  // ── Commit / staging ──────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.COMMIT_STAGE, async (_, repoPath: string, filePath: string) => {
    await getModule(repoPath).stageFile(filePath)
  })

  ipcMain.handle(CHANNELS.COMMIT_UNSTAGE, async (_, repoPath: string, filePath: string) => {
    await getModule(repoPath).unstageFile(filePath)
  })

  ipcMain.handle(CHANNELS.COMMIT_DISCARD, async (_, repoPath: string, filePath: string) => {
    await getModule(repoPath).discardFile(filePath)
  })

  ipcMain.handle(CHANNELS.COMMIT_CREATE, async (_, repoPath: string, message: string) => {
    await getModule(repoPath).createCommit(message)
  })

  ipcMain.handle(CHANNELS.COMMIT_AMEND, async (_, repoPath: string, message?: string) => {
    await getModule(repoPath).amendCommit(message)
  })

  ipcMain.handle(CHANNELS.COMMIT_REVERT, async (_, repoPath: string, hash: string) => {
    await getModule(repoPath).revertCommit(hash)
  })

  ipcMain.handle(CHANNELS.COMMIT_RESET, async (_, repoPath: string, hash: string, mode: string) => {
    await getModule(repoPath).resetToCommit(hash, mode as any)
  })

  ipcMain.handle(CHANNELS.COMMIT_CHERRY_PICK, async (_, repoPath: string, hash: string) => {
    await getModule(repoPath).cherryPick(hash)
  })

  ipcMain.handle(CHANNELS.TAG_CREATE, async (_, repoPath: string, name: string, hash?: string, message?: string) => {
    await getModule(repoPath).createTag(name, hash, message)
  })

  ipcMain.handle(CHANNELS.TAG_DELETE, async (_, repoPath: string, name: string) => {
    await getModule(repoPath).deleteTag(name)
  })

  ipcMain.handle(CHANNELS.TAG_PUSH, async (_, repoPath: string, remote: string, name: string) => {
    await getModule(repoPath).pushTag(remote, name)
  })

  // ── Stash ─────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.STASH_SAVE, async (_, repoPath: string, message?: string) => {
    await getModule(repoPath).stashSave(message)
  })

  ipcMain.handle(CHANNELS.STASH_APPLY, async (_, repoPath: string, ref: string) => {
    await getModule(repoPath).stashApply(ref)
  })

  ipcMain.handle(CHANNELS.STASH_DROP, async (_, repoPath: string, ref: string) => {
    await getModule(repoPath).stashDrop(ref)
  })

  // ── File History ──────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.LOG_FILE, async (_, repoPath: string, filePath: string, opts?: LogOptions) => {
    return getModule(repoPath).getFileHistory(filePath, opts)
  })

  // ── Reflog ────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.LOG_REFLOG, async (_, repoPath: string) => {
    return getModule(repoPath).getReflog()
  })

  // ── Blame ─────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.DIFF_BLAME, async (_, repoPath: string, filePath: string, commitHash?: string) => {
    return getModule(repoPath).getBlame(filePath, commitHash)
  })

  // ── Remotes CRUD ──────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REMOTE_LIST, async (_, repoPath: string) => {
    return getModule(repoPath).getRemotes()
  })

  ipcMain.handle(CHANNELS.REMOTE_ADD, async (_, repoPath: string, name: string, url: string) => {
    await getModule(repoPath).addRemote(name, url)
  })

  ipcMain.handle(CHANNELS.REMOTE_REMOVE, async (_, repoPath: string, name: string) => {
    await getModule(repoPath).removeRemote(name)
  })

  ipcMain.handle(CHANNELS.REMOTE_RENAME, async (_, repoPath: string, oldName: string, newName: string) => {
    await getModule(repoPath).renameRemote(oldName, newName)
  })

  ipcMain.handle(CHANNELS.REMOTE_PRUNE, async (_, repoPath: string, name: string) => {
    await getModule(repoPath).pruneRemote(name)
  })

  // ── Rebase ────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.BRANCH_REBASE, async (_, repoPath: string, onto: string) => {
    await getModule(repoPath).rebase(onto)
  })

  ipcMain.handle(CHANNELS.BRANCH_REBASE_ABORT, async (_, repoPath: string) => {
    await getModule(repoPath).abortRebase()
  })

  // ── Conflicts ────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.CONFLICT_LIST, async (_, repoPath: string) => {
    return getModule(repoPath).getConflicts()
  })

  ipcMain.handle(CHANNELS.CONFLICT_RESOLVE, async (_, repoPath: string, filePath: string, strategy: 'ours' | 'theirs') => {
    await getModule(repoPath).resolveConflict(filePath, strategy)
  })

  // ── Partial staging ───────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.STAGE_HUNK, async (_, repoPath: string, patch: string) => {
    await getModule(repoPath).stageHunk(patch)
  })

  ipcMain.handle(CHANNELS.UNSTAGE_HUNK, async (_, repoPath: string, patch: string) => {
    await getModule(repoPath).unstageHunk(patch)
  })

  // ── Stash improvements ────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.STASH_POP, async (_, repoPath: string, ref?: string) => {
    await getModule(repoPath).stashPop(ref)
  })

  ipcMain.handle(CHANNELS.STASH_SAVE_FLAGS, async (_, repoPath: string, message?: string, includeUntracked?: boolean, all?: boolean) => {
    await getModule(repoPath).stashSaveFlags(message, includeUntracked, all)
  })

  ipcMain.handle(CHANNELS.STASH_LIST, async (_, repoPath: string) => {
    return getModule(repoPath).listStashes()
  })

  ipcMain.handle(CHANNELS.STASH_DIFF, async (_, repoPath: string, ref: string) => {
    return getModule(repoPath).getStashDiff(ref)
  })

  // ── Compare ───────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.DIFF_COMPARE, async (_, repoPath: string, ref1: string, ref2: string, filePath?: string) => {
    return getModule(repoPath).compareDiff(ref1, ref2, filePath)
  })

  // ── Branch extras ─────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.BRANCH_SET_UPSTREAM, async (_, repoPath: string, branch: string, upstream: string) => {
    await getModule(repoPath).setUpstream(branch, upstream)
  })

  ipcMain.handle(CHANNELS.BRANCH_CHECKOUT_REMOTE, async (_, repoPath: string, remoteBranch: string, localName?: string) => {
    await getModule(repoPath).checkoutRemoteBranch(remoteBranch, localName)
  })

  ipcMain.handle(CHANNELS.BRANCH_CHECKOUT_HASH, async (_, repoPath: string, hash: string) => {
    await getModule(repoPath).checkoutRevision(hash)
  })

  // ── Interactive rebase ────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.LOG_REBASE_COMMITS, async (_, repoPath: string, base: string) => {
    return getModule(repoPath).getRebaseCommits(base)
  })

  ipcMain.handle(CHANNELS.REBASE_INTERACTIVE, async (_, repoPath: string, base: string, commits: RebaseCommit[]) => {
    await getModule(repoPath).interactiveRebase(base, commits)
  })

  // ── Patch ─────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.PATCH_FORMAT, async (_, repoPath: string, base: string, outputDir: string) => {
    return getModule(repoPath).formatPatch(base, outputDir)
  })

  ipcMain.handle(CHANNELS.PATCH_APPLY, async (_, repoPath: string, patchPath: string, useAm?: boolean) => {
    await getModule(repoPath).applyPatch(patchPath, useAm)
  })

  ipcMain.handle(CHANNELS.DIALOG_OPEN_DIR, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(CHANNELS.DIALOG_OPEN_FILE, async (_, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Submodules ────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.SUBMODULE_LIST, async (_, repoPath: string) => {
    return getModule(repoPath).listSubmodules()
  })

  ipcMain.handle(CHANNELS.SUBMODULE_ADD, async (_, repoPath: string, url: string, path: string) => {
    await getModule(repoPath).addSubmodule(url, path)
  })

  ipcMain.handle(CHANNELS.SUBMODULE_UPDATE, async (_, repoPath: string) => {
    await getModule(repoPath).updateSubmodules()
  })

  ipcMain.handle(CHANNELS.SUBMODULE_REMOVE, async (_, repoPath: string, path: string) => {
    await getModule(repoPath).removeSubmodule(path)
  })

  // ── Clean ─────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_CLEAN_DRY, async (_, repoPath: string) => {
    return getModule(repoPath).cleanDryRun()
  })

  ipcMain.handle(CHANNELS.REPO_CLEAN, async (_, repoPath: string) => {
    await getModule(repoPath).clean()
  })

  // ── .gitignore / .gitattributes ───────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_READ_GITIGNORE, async (_, repoPath: string) => {
    return getModule(repoPath).readGitignore()
  })

  ipcMain.handle(CHANNELS.REPO_WRITE_GITIGNORE, async (_, repoPath: string, content: string) => {
    await getModule(repoPath).writeGitignore(content)
  })

  ipcMain.handle(CHANNELS.REPO_ADD_GITIGNORE, async (_, repoPath: string, pattern: string) => {
    await getModule(repoPath).addToGitignore(pattern)
  })

  ipcMain.handle(CHANNELS.REPO_READ_GITATTRIBUTES, async (_, repoPath: string) => {
    return getModule(repoPath).readGitattributes()
  })

  ipcMain.handle(CHANNELS.REPO_WRITE_GITATTRIBUTES, async (_, repoPath: string, content: string) => {
    await getModule(repoPath).writeGitattributes(content)
  })

  // ── Theme ─────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.THEME_GET, () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    themeSource: nativeTheme.themeSource,
  }))

  ipcMain.handle(CHANNELS.THEME_SET, (_, source: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = source
  })

  // ── Worktrees ─────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.WORKTREE_LIST, async (_, repoPath: string) => {
    return getModule(repoPath).listWorktrees()
  })
  ipcMain.handle(CHANNELS.WORKTREE_ADD, async (_, repoPath: string, path: string, ref: string, newBranch?: string) => {
    await getModule(repoPath).addWorktree(path, ref, newBranch)
  })
  ipcMain.handle(CHANNELS.WORKTREE_REMOVE, async (_, repoPath: string, path: string, force?: boolean) => {
    await getModule(repoPath).removeWorktree(path, force)
  })
  ipcMain.handle(CHANNELS.WORKTREE_PRUNE, async (_, repoPath: string) => {
    await getModule(repoPath).pruneWorktrees()
  })

  // ── Archive ───────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_ARCHIVE, async (_, repoPath: string, ref: string, format: 'zip' | 'tar.gz', outputPath: string) => {
    await getModule(repoPath).archive(ref, format, outputPath)
  })

  // ── fsck ──────────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_FSCK, async (_, repoPath: string) => {
    return getModule(repoPath).fsck()
  })

  // ── GPG signing ───────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.COMMIT_SIGNATURE, async (_, repoPath: string, hash: string) => {
    return getModule(repoPath).getCommitSignature(hash)
  })
  ipcMain.handle(CHANNELS.COMMIT_SIGN, async (_, repoPath: string, message: string) => {
    await getModule(repoPath).createSignedCommit(message)
  })

  // ── Mailmap ───────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.REPO_READ_MAILMAP, async (_, repoPath: string) => {
    return getModule(repoPath).readMailmap()
  })
  ipcMain.handle(CHANNELS.REPO_WRITE_MAILMAP, async (_, repoPath: string, content: string) => {
    await getModule(repoPath).writeMailmap(content)
  })

  // ── Sparse checkout ───────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.SPARSE_GET, async (_, repoPath: string) => {
    return getModule(repoPath).getSparseCheckout()
  })
  ipcMain.handle(CHANNELS.SPARSE_SET, async (_, repoPath: string, patterns: string[], cone: boolean) => {
    await getModule(repoPath).setSparseCheckout(patterns, cone)
  })

  // ── Git config ────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.CONFIG_LIST, async (_, repoPath: string, scope: 'local' | 'global') => {
    return getModule(repoPath).listConfig(scope)
  })
  ipcMain.handle(CHANNELS.CONFIG_GET, async (_, repoPath: string, key: string, scope: 'local' | 'global') => {
    return getModule(repoPath).getConfig(key, scope)
  })
  ipcMain.handle(CHANNELS.CONFIG_SET, async (_, repoPath: string, key: string, value: string, scope: 'local' | 'global') => {
    await getModule(repoPath).setConfig(key, value, scope)
  })
  ipcMain.handle(CHANNELS.CONFIG_UNSET, async (_, repoPath: string, key: string, scope: 'local' | 'global') => {
    await getModule(repoPath).unsetConfig(key, scope)
  })

  // ── Save-file dialog ──────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.DIALOG_SAVE_FILE, async (_, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showSaveDialog({ defaultPath, filters })
    return result.canceled ? null : result.filePath ?? null
  })

  // ── Commit template ──────────────────────────────────────────────────────
  // Reads/writes the file at `path` (or ~/.gitmessage by default).

  ipcMain.handle(CHANNELS.TEMPLATE_READ, async (_, path?: string) => {
    const file = path && path.trim() ? expandHome(path) : join(homedir(), '.gitmessage')
    return { path: file, content: existsSync(file) ? readFileSync(file, 'utf8') : '' }
  })
  ipcMain.handle(CHANNELS.TEMPLATE_WRITE, async (_, path: string | undefined, content: string) => {
    const file = path && path.trim() ? expandHome(path) : join(homedir(), '.gitmessage')
    writeFileSync(file, content, 'utf8')
    return file
  })

  // ── SSH keys ─────────────────────────────────────────────────────────────

  ipcMain.handle(CHANNELS.SSH_LIST, async () => {
    const dir = join(homedir(), '.ssh')
    if (!existsSync(dir)) return [] as { name: string; path: string; publicKey: string }[]
    return readdirSync(dir)
      .filter((f) => f.endsWith('.pub'))
      .map((f) => {
        const path = join(dir, f)
        try {
          const publicKey = readFileSync(path, 'utf8').trim()
          return { name: f.replace(/\.pub$/, ''), path, publicKey }
        } catch {
          return null
        }
      })
      .filter((x): x is { name: string; path: string; publicKey: string } => x !== null)
  })
  ipcMain.handle(
    CHANNELS.SSH_GENERATE,
    async (_, args: { name: string; type: 'ed25519' | 'rsa'; comment: string; passphrase: string }) => {
      const safeName = args.name.replace(/[^a-zA-Z0-9_-]/g, '')
      if (!safeName) throw new Error('Invalid key name')
      const dir = join(homedir(), '.ssh')
      const target = join(dir, safeName)
      if (existsSync(target) || existsSync(target + '.pub')) {
        throw new Error(`Key "${safeName}" already exists`)
      }
      const cmdArgs = ['-t', args.type === 'rsa' ? 'rsa' : 'ed25519']
      if (args.type === 'rsa') cmdArgs.push('-b', '4096')
      cmdArgs.push('-f', target, '-C', args.comment || '', '-N', args.passphrase || '')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('ssh-keygen', cmdArgs, { stdio: 'pipe' })
        let stderr = ''
        proc.stderr.on('data', (d) => { stderr += d.toString() })
        proc.on('error', reject)
        proc.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(stderr.trim() || `ssh-keygen exited ${code}`))
        })
      })
      const pub = readFileSync(target + '.pub', 'utf8').trim()
      return { name: safeName, path: target, publicKey: pub }
    },
  )

  ipcMain.handle(CHANNELS.WINDOW_TOGGLE_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(CHANNELS.OPEN_EXTERNAL, async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) return
    await shell.openExternal(url)
  })

  ipcMain.handle(CHANNELS.OPEN_PATH, async (_event, fullPath: string) => {
    // Opens a local file/folder in the OS default application. Returns the
    // error string shell.openPath produces ('' on success) so the renderer can surface it.
    return shell.openPath(fullPath)
  })
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  if (p === '~') return homedir()
  return p
}
