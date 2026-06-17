import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, chmodSync } from 'fs'
import { join, basename, dirname } from 'path'
import { GitExecutor } from './GitExecutor.js'
import { RevisionReader } from './RevisionReader.js'
import { RefResolver } from './RefResolver.js'
import { buildGraphLanes } from './GraphBuilder.js'
import { StatusParser } from './StatusParser.js'
import { DiffParser } from './DiffParser.js'
import { tmpdir } from 'os'
import type { GitRevision, GitItemStatus, DiffFile, LogOptions, RepoInfo, RefGroups, BlameLine, ReflogEntry, Remote, ConflictFile, StashEntry, Submodule, CleanEntry, RebaseCommit, Worktree, FsckResult, CommitSignature, SparseCheckoutInfo, GitConfigEntry, BisectStatus, LfsStatus, LfsFile } from './types.js'

export class GitModule {
  private readonly executor: GitExecutor
  private readonly revisionReader: RevisionReader
  private readonly refResolver: RefResolver
  private readonly statusParser: StatusParser
  private readonly diffParser: DiffParser

  constructor(public readonly repoPath: string) {
    this.executor = new GitExecutor(repoPath)
    this.revisionReader = new RevisionReader(this.executor)
    this.refResolver = new RefResolver()
    this.statusParser = new StatusParser()
    this.diffParser = new DiffParser()
  }

  // ── Static repo creation ops ──────────────────────────────────────────────

  static async clone(url: string, destination: string, depth?: number): Promise<RepoInfo> {
    const parentDir = dirname(destination)
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true })
    const args = ['clone', '--progress']
    if (depth && depth > 0) args.push('--depth', String(depth))
    args.push(url, destination)
    const executor = new GitExecutor(parentDir)
    const result = await executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    return new GitModule(destination).getRepoInfo()
  }

  static async initRepo(path: string): Promise<RepoInfo> {
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
    const executor = new GitExecutor(path)
    const result = await executor.run(['init'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    return new GitModule(path).getRepoInfo()
  }

  // ── Repo info ─────────────────────────────────────────────────────────────

  async isValidRepo(): Promise<boolean> {
    const result = await this.executor.run(['rev-parse', '--git-dir'])
    return result.exitCode === 0
  }

  async getRepoInfo(): Promise<RepoInfo> {
    const [headResult, branchResult] = await Promise.all([
      this.executor.run(['rev-parse', '--abbrev-ref', 'HEAD']),
      this.executor.run(['branch', '--show-current']),
    ])
    const headRef = headResult.stdout.trim()
    const currentBranch = branchResult.stdout.trim() || null
    return {
      path: this.repoPath,
      name: basename(this.repoPath),
      currentBranch,
      isDetachedHead: headRef === 'HEAD',
    }
  }

  // ── Log / graph ───────────────────────────────────────────────────────────

  async getRevisions(opts?: LogOptions): Promise<GitRevision[]> {
    const [groups, revisions] = await Promise.all([
      this.refResolver.getRefs(this.executor),
      this.revisionReader.getRevisions(opts),
    ])
    this.refResolver.attachToRevisions(revisions, groups)
    buildGraphLanes(revisions)
    return revisions
  }

  async getRefs(): Promise<RefGroups> {
    return this.refResolver.getRefs(this.executor)
  }

  async getStatus(): Promise<GitItemStatus[]> {
    return this.statusParser.getStatus(this.executor)
  }

  /** Repo-relative paths of all tracked files (NUL-delimited so paths with
   * spaces/newlines stay intact). Used by the command palette's file search. */
  async listFiles(): Promise<string[]> {
    const result = await this.executor.run(['ls-files', '-z'])
    if (result.exitCode !== 0) return []
    return result.stdout.split('\0').filter(Boolean)
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  async getDiff(commitHash: string, filePath?: string): Promise<DiffFile[]> {
    if (filePath) {
      const file = await this.diffParser.getFileDiff(this.executor, commitHash, filePath)
      return file ? [file] : []
    }
    return this.diffParser.getCommitDiff(this.executor, commitHash)
  }

  async getWorkingDiff(filePath?: string): Promise<DiffFile[]> {
    // Unstaged: working tree vs index
    const args = ['diff', '--unified=3', '--no-color']
    if (filePath) args.push('--', filePath)
    const result = await this.executor.run(args)
    return this.diffParser.parseDiff(result.stdout)
  }

  async getStagedDiff(filePath?: string): Promise<DiffFile[]> {
    // Staged: index vs HEAD
    const args = ['diff', '--cached', '--unified=3', '--no-color']
    if (filePath) args.push('--', filePath)
    const result = await this.executor.run(args)
    return this.diffParser.parseDiff(result.stdout)
  }

  // ── Branch ────────────────────────────────────────────────────────────────

  async checkoutBranch(branchName: string): Promise<void> {
    const result = await this.executor.run(['checkout', branchName])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async createBranch(name: string, from?: string): Promise<void> {
    const args = from ? ['checkout', '-b', name, from] : ['checkout', '-b', name]
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async deleteBranch(name: string, force = false): Promise<void> {
    const result = await this.executor.run(['branch', force ? '-D' : '-d', name])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async renameBranch(oldName: string, newName: string): Promise<void> {
    const result = await this.executor.run(['branch', '-m', oldName, newName])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async mergeBranch(branch: string, strategy: 'merge' | 'no-ff' | 'squash' = 'merge'): Promise<void> {
    const args = strategy === 'squash'
      ? ['merge', '--squash', branch]
      : strategy === 'no-ff'
      ? ['merge', '--no-ff', branch]
      : ['merge', branch]
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Remote ────────────────────────────────────────────────────────────────

  async fetch(remote?: string): Promise<void> {
    const args = remote ? ['fetch', remote] : ['fetch', '--all']
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async pull(remote: string, branch: string): Promise<void> {
    const result = await this.executor.run(['pull', remote, branch])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async push(remote: string, branch: string, force = false): Promise<void> {
    const args = force
      ? ['push', '--force-with-lease', remote, branch]
      : ['push', remote, branch]
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Staging & commit ──────────────────────────────────────────────────────

  async stageFile(path: string): Promise<void> {
    const result = await this.executor.run(['add', '--', path])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async unstageFile(path: string): Promise<void> {
    const result = await this.executor.run(['reset', 'HEAD', '--', path])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async discardFile(path: string): Promise<void> {
    // git restore replaces both tracked modifications and staged changes
    const result = await this.executor.run(['restore', '--', path])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async createCommit(message: string): Promise<void> {
    const result = await this.executor.run(['commit', '-m', message])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async revertCommit(hash: string): Promise<void> {
    // Creates a revert commit automatically
    const result = await this.executor.run(['revert', '--no-edit', hash])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async resetToCommit(hash: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
    const result = await this.executor.run(['reset', `--${mode}`, hash])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async cherryPick(hash: string): Promise<void> {
    const result = await this.executor.run(['cherry-pick', hash])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async amendCommit(message?: string): Promise<void> {
    const args = message
      ? ['commit', '--amend', '-m', message]
      : ['commit', '--amend', '--no-edit']
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Stash ─────────────────────────────────────────────────────────────────

  // ── Tags ──────────────────────────────────────────────────────────────────

  async createTag(name: string, hash?: string, message?: string): Promise<void> {
    const args = message
      ? ['tag', '-a', name, '-m', message, ...(hash ? [hash] : [])]
      : ['tag', name, ...(hash ? [hash] : [])]
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async deleteTag(name: string): Promise<void> {
    const result = await this.executor.run(['tag', '-d', name])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async pushTag(remote: string, name: string): Promise<void> {
    const result = await this.executor.run(['push', remote, `refs/tags/${name}`])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Stash ─────────────────────────────────────────────────────────────────

  async stashSave(message?: string): Promise<void> {
    const args = message ? ['stash', 'push', '-m', message] : ['stash', 'push']
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async stashApply(ref: string): Promise<void> {
    const result = await this.executor.run(['stash', 'apply', ref])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async stashDrop(ref: string): Promise<void> {
    const result = await this.executor.run(['stash', 'drop', ref])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── File History ──────────────────────────────────────────────────────────

  async getFileHistory(filePath: string, opts: LogOptions = {}): Promise<GitRevision[]> {
    const [groups, revisions] = await Promise.all([
      this.refResolver.getRefs(this.executor),
      this.revisionReader.getFileHistory(filePath, opts),
    ])
    this.refResolver.attachToRevisions(revisions, groups)
    buildGraphLanes(revisions)
    return revisions
  }

  // ── Blame ─────────────────────────────────────────────────────────────────

  async getBlame(filePath: string, commitHash?: string): Promise<BlameLine[]> {
    const run = (rev?: string) => {
      const args = ['blame', '--porcelain']
      if (rev) args.push(rev)
      args.push('--', filePath)
      return this.executor.run(args)
    }

    let result = await run(commitHash)
    // When the file was deleted in `commitHash` (status D) it isn't present in that
    // commit's tree, so `git blame <hash> -- <path>` fails with "no such path … in <hash>".
    // The blameable content lives in the parent commit, so fall back to it.
    if (result.exitCode !== 0 && commitHash && /no such path/i.test(result.stderr)) {
      const parent = await run(`${commitHash}^`)
      if (parent.exitCode === 0) result = parent
    }
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    return this.parseBlame(result.stdout)
  }

  private parseBlame(raw: string): BlameLine[] {
    const lines = raw.split('\n')
    const result: BlameLine[] = []
    const authorMap = new Map<string, string>()
    const timeMap = new Map<string, number>()
    let currentHash = ''
    let currentLine = 0

    for (const line of lines) {
      const hashLine = line.match(/^([0-9a-f]{40}) \d+ (\d+)/)
      if (hashLine) {
        currentHash = hashLine[1]
        currentLine = parseInt(hashLine[2], 10)
        continue
      }
      if (line.startsWith('author ') && !line.startsWith('author-')) {
        authorMap.set(currentHash, line.slice(7))
        continue
      }
      if (line.startsWith('author-time ')) {
        timeMap.set(currentHash, parseInt(line.slice(12), 10))
        continue
      }
      if (line.startsWith('\t')) {
        result.push({
          hash: currentHash,
          author: authorMap.get(currentHash) ?? '',
          authorTime: timeMap.get(currentHash) ?? 0,
          lineNum: currentLine,
          text: line.slice(1),
        })
      }
    }
    return result
  }

  // ── Reflog ────────────────────────────────────────────────────────────────

  async getReflog(): Promise<ReflogEntry[]> {
    const result = await this.executor.run([
      'reflog',
      '--format=%H%x00%gd%x00%gs%x00%ci',
      '-z',
    ])
    if (result.exitCode !== 0) return []
    return result.stdout
      .split('\0')
      .filter(Boolean)
      .map((rec) => {
        const [hash, selector, action, date] = rec.trim().split('\0')
        return { hash: hash ?? '', selector: selector ?? '', action: action ?? '', date: date ?? '' }
      })
  }

  // ── Remotes CRUD ──────────────────────────────────────────────────────────

  async getRemotes(): Promise<Remote[]> {
    const result = await this.executor.run(['remote', '-v'])
    if (result.exitCode !== 0) return []
    const map = new Map<string, Remote>()
    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
      if (!m) continue
      const [, name, url, kind] = m
      const entry = map.get(name) ?? { name, fetchUrl: '', pushUrl: '' }
      if (kind === 'fetch') entry.fetchUrl = url
      else entry.pushUrl = url
      map.set(name, entry)
    }
    return Array.from(map.values())
  }

  async addRemote(name: string, url: string): Promise<void> {
    const result = await this.executor.run(['remote', 'add', name, url])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async removeRemote(name: string): Promise<void> {
    const result = await this.executor.run(['remote', 'remove', name])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async renameRemote(oldName: string, newName: string): Promise<void> {
    const result = await this.executor.run(['remote', 'rename', oldName, newName])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async pruneRemote(name: string): Promise<void> {
    const result = await this.executor.run(['remote', 'prune', name])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Rebase ────────────────────────────────────────────────────────────────

  async rebase(onto: string): Promise<void> {
    const result = await this.executor.run(['rebase', onto])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async abortRebase(): Promise<void> {
    const result = await this.executor.run(['rebase', '--abort'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Conflicts ────────────────────────────────────────────────────────────

  async getConflicts(): Promise<ConflictFile[]> {
    const status = await this.statusParser.getStatus(this.executor)
    return status
      .filter((f) => f.isUnmerged)
      .map((f) => ({ path: f.name }))
  }

  async resolveConflict(filePath: string, strategy: 'ours' | 'theirs'): Promise<void> {
    const ref = strategy === 'ours' ? 'HEAD' : 'MERGE_HEAD'
    const result = await this.executor.run(['checkout', `--${strategy === 'ours' ? 'ours' : 'theirs'}`, '--', filePath])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    await this.stageFile(filePath)
    void ref
  }

  // ── Partial staging ───────────────────────────────────────────────────────

  async stageHunk(patch: string): Promise<void> {
    const tmp = join(tmpdir(), `novagitx-hunk-${Date.now()}.patch`)
    try {
      writeFileSync(tmp, patch, 'utf8')
      const result = await this.executor.run(['apply', '--cached', '--whitespace=nowarn', tmp])
      if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    } finally {
      try { unlinkSync(tmp) } catch {}
    }
  }

  async unstageHunk(patch: string): Promise<void> {
    const tmp = join(tmpdir(), `novagitx-hunk-${Date.now()}.patch`)
    try {
      writeFileSync(tmp, patch, 'utf8')
      const result = await this.executor.run(['apply', '--cached', '--reverse', '--whitespace=nowarn', tmp])
      if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    } finally {
      try { unlinkSync(tmp) } catch {}
    }
  }

  // ── Stash improvements ────────────────────────────────────────────────────

  async stashPop(ref?: string): Promise<void> {
    const args = ref ? ['stash', 'pop', ref] : ['stash', 'pop']
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async stashSaveFlags(message?: string, includeUntracked = false, all = false): Promise<void> {
    const args = ['stash', 'push']
    if (all) args.push('--all')
    else if (includeUntracked) args.push('--include-untracked')
    if (message) args.push('-m', message)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async listStashes(): Promise<StashEntry[]> {
    const result = await this.executor.run(['stash', 'list', '--format=%gd%x00%H%x00%gs', '-z'])
    if (result.exitCode !== 0) return []
    return result.stdout
      .split('\0')
      .filter(Boolean)
      .map((rec, i) => {
        const [ref, hash, message] = rec.trim().split('\0')
        const idxMatch = (ref ?? '').match(/stash@\{(\d+)\}/)
        return {
          index: idxMatch ? parseInt(idxMatch[1], 10) : i,
          ref: ref ?? `stash@{${i}}`,
          hash: hash ?? '',
          message: message ?? '',
        }
      })
  }

  async getStashDiff(ref: string): Promise<DiffFile[]> {
    const result = await this.executor.run(['stash', 'show', '-p', '--unified=3', '--no-color', ref])
    if (result.exitCode !== 0) return []
    return this.diffParser.parseDiff(result.stdout)
  }

  // ── Compare refs ─────────────────────────────────────────────────────────

  async compareDiff(ref1: string, ref2: string, filePath?: string): Promise<DiffFile[]> {
    const args = ['diff', '--unified=3', '--no-color', `${ref1}...${ref2}`]
    if (filePath) args.push('--', filePath)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0 && !result.stdout) return []
    return this.diffParser.parseDiff(result.stdout)
  }

  // ── Branch: upstream / remote checkout / checkout hash ───────────────────

  async setUpstream(branch: string, upstream: string): Promise<void> {
    const result = await this.executor.run(['branch', '--set-upstream-to', upstream, branch])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async checkoutRemoteBranch(remoteBranch: string, localName?: string): Promise<void> {
    const local = localName ?? remoteBranch.replace(/^[^/]+\//, '')
    const result = await this.executor.run(['checkout', '-b', local, '--track', remoteBranch])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async checkoutRevision(hash: string): Promise<void> {
    const result = await this.executor.run(['checkout', hash])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Interactive rebase ────────────────────────────────────────────────────

  async getRebaseCommits(base: string): Promise<RebaseCommit[]> {
    const result = await this.executor.run([
      'log', '--reverse', '--format=%H%x00%s', '-z', `${base}..HEAD`,
    ])
    if (result.exitCode !== 0 || !result.stdout.trim()) return []
    return result.stdout
      .split('\0')
      .filter(Boolean)
      .map((rec) => {
        const nul = rec.indexOf('\0')
        const hash = nul === -1 ? rec.slice(0, 40) : rec.slice(0, nul)
        const subject = nul === -1 ? rec.slice(40).trim() : rec.slice(nul + 1).trim()
        return { action: 'pick' as const, hash, subject }
      })
  }

  async interactiveRebase(base: string, commits: RebaseCommit[]): Promise<void> {
    const todoLines = commits
      .map((c) => `${c.action} ${c.hash.slice(0, 12)} ${c.subject}`)
      .join('\n')
    const todoPath = join(tmpdir(), `novagitx-todo-${Date.now()}.txt`)
    const editorPath = join(tmpdir(), `novagitx-editor-${Date.now()}.sh`)
    try {
      writeFileSync(todoPath, todoLines + '\n', 'utf8')
      writeFileSync(editorPath, `#!/bin/sh\ncp "${todoPath}" "$1"\n`, 'utf8')
      chmodSync(editorPath, '755')
      const result = await this.executor.run(['rebase', '-i', base], {
        GIT_SEQUENCE_EDITOR: editorPath,
      })
      if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    } finally {
      try { unlinkSync(todoPath) } catch {}
      try { unlinkSync(editorPath) } catch {}
    }
  }

  // ── Format / Apply patch ──────────────────────────────────────────────────

  async formatPatch(base: string, outputDir: string): Promise<string[]> {
    const result = await this.executor.run(['format-patch', base, '-o', outputDir])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
    return result.stdout.trim().split('\n').filter(Boolean)
  }

  async applyPatch(patchPath: string, useAm = true): Promise<void> {
    const args = useAm
      ? ['am', '--signoff', patchPath]
      : ['apply', patchPath]
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Submodules ────────────────────────────────────────────────────────────

  async listSubmodules(): Promise<Submodule[]> {
    const result = await this.executor.run(['submodule', 'status', '--recursive'])
    if (result.exitCode !== 0) return []
    const subs: Submodule[] = []
    for (const line of result.stdout.split('\n').filter(Boolean)) {
      const m = line.match(/^([ +\-U])([0-9a-f]{40}) (.+?)(?:\s+\((.+)\))?$/)
      if (!m) continue
      const [, statusChar, hash, path, branch] = m
      subs.push({
        path,
        url: '',
        branch: branch ?? null,
        hash,
        status: statusChar === '-' ? 'uninitialized' : statusChar === '+' ? 'modified' : 'clean',
      })
    }
    // Fill urls from .gitmodules
    const urlResult = await this.executor.run(['config', '--file', '.gitmodules', '--get-regexp', 'submodule\\..+\\.url'])
    if (urlResult.exitCode === 0) {
      for (const line of urlResult.stdout.split('\n').filter(Boolean)) {
        const m = line.match(/submodule\.(.+)\.url\s+(.+)/)
        if (!m) continue
        const [, , url] = m
        const sub = subs.find((s) => s.path.endsWith(m[1]))
        if (sub) sub.url = url
      }
    }
    return subs
  }

  async updateSubmodules(): Promise<void> {
    const result = await this.executor.run(['submodule', 'update', '--init', '--recursive'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async addSubmodule(url: string, path: string): Promise<void> {
    const result = await this.executor.run(['submodule', 'add', url, path])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async removeSubmodule(path: string): Promise<void> {
    await this.executor.run(['submodule', 'deinit', '-f', path])
    await this.executor.run(['rm', '-f', path])
    await this.executor.run(['config', '--remove-section', `submodule.${path}`])
  }

  // ── Clean ─────────────────────────────────────────────────────────────────

  async cleanDryRun(): Promise<CleanEntry[]> {
    const result = await this.executor.run(['clean', '-nfd'])
    if (result.exitCode !== 0) return []
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const path = line.replace(/^Would (remove|remove directory) /, '').trim()
        return { path, isDir: line.includes('directory') }
      })
  }

  async clean(): Promise<void> {
    const result = await this.executor.run(['clean', '-fd'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── .gitignore / .gitattributes ───────────────────────────────────────────

  async readGitignore(): Promise<string> {
    const p = join(this.repoPath, '.gitignore')
    return existsSync(p) ? readFileSync(p, 'utf8') : ''
  }

  async writeGitignore(content: string): Promise<void> {
    writeFileSync(join(this.repoPath, '.gitignore'), content, 'utf8')
  }

  async addToGitignore(pattern: string): Promise<void> {
    const p = join(this.repoPath, '.gitignore')
    const existing = existsSync(p) ? readFileSync(p, 'utf8') : ''
    const lines = existing.split('\n')
    if (!lines.includes(pattern)) {
      writeFileSync(p, (existing.endsWith('\n') || existing === '' ? existing : existing + '\n') + pattern + '\n', 'utf8')
    }
  }

  async readGitattributes(): Promise<string> {
    const p = join(this.repoPath, '.gitattributes')
    return existsSync(p) ? readFileSync(p, 'utf8') : ''
  }

  async writeGitattributes(content: string): Promise<void> {
    writeFileSync(join(this.repoPath, '.gitattributes'), content, 'utf8')
  }

  // ── Worktrees ─────────────────────────────────────────────────────────────

  async listWorktrees(): Promise<Worktree[]> {
    const result = await this.executor.run(['worktree', 'list', '--porcelain'])
    if (result.exitCode !== 0) return []
    const trees: Worktree[] = []
    let cur: Partial<Worktree> = {}
    for (const line of result.stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (cur.path) trees.push(this.finalizeWorktree(cur, trees.length === 0))
        cur = { path: line.slice(9), isLocked: false, isPrunable: false, isDetached: false, isMain: false, hash: '', branch: null }
      } else if (line.startsWith('HEAD ')) cur.hash = line.slice(5)
      else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '')
      else if (line === 'detached') cur.isDetached = true
      else if (line.startsWith('locked')) cur.isLocked = true
      else if (line.startsWith('prunable')) cur.isPrunable = true
    }
    if (cur.path) trees.push(this.finalizeWorktree(cur, trees.length === 0))
    return trees
  }

  private finalizeWorktree(p: Partial<Worktree>, isMain: boolean): Worktree {
    return {
      path: p.path!,
      hash: p.hash ?? '',
      branch: p.branch ?? null,
      isLocked: !!p.isLocked,
      isPrunable: !!p.isPrunable,
      isDetached: !!p.isDetached,
      isMain,
    }
  }

  async addWorktree(path: string, ref: string, newBranch?: string): Promise<void> {
    const args = ['worktree', 'add']
    if (newBranch) args.push('-b', newBranch)
    args.push(path, ref)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async removeWorktree(path: string, force: boolean = false): Promise<void> {
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(path)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async pruneWorktrees(): Promise<void> {
    await this.executor.run(['worktree', 'prune'])
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  async archive(ref: string, format: 'zip' | 'tar.gz', outputPath: string): Promise<void> {
    const fmt = format === 'tar.gz' ? 'tar.gz' : 'zip'
    const result = await this.executor.run(['archive', `--format=${fmt}`, `--output=${outputPath}`, ref])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── fsck ──────────────────────────────────────────────────────────────────

  async fsck(): Promise<FsckResult> {
    const result = await this.executor.run(['fsck', '--full', '--strict'])
    const output = (result.stdout + result.stderr).trim()
    return { output: output || 'No issues found.', hasIssues: result.exitCode !== 0 }
  }

  // ── GPG signing ───────────────────────────────────────────────────────────

  async getCommitSignature(hash: string): Promise<CommitSignature> {
    // %G?  G=good, B=bad, U=untrusted/good, X=expired, Y=expired key, R=revoked key, E=missing key, N=no signature
    const result = await this.executor.run(['log', '-1', '--pretty=format:%G?%n%GS%n%GK', hash])
    if (result.exitCode !== 0) return { status: 'unknown', signer: null, key: null }
    const [code = 'N', signer = '', key = ''] = result.stdout.split('\n')
    const status =
      code === 'G' || code === 'U' ? 'good'
      : code === 'B' ? 'bad'
      : code === 'X' || code === 'Y' ? 'expired'
      : code === 'N' ? 'unsigned'
      : 'unknown'
    return { status, signer: signer || null, key: key || null }
  }

  async createSignedCommit(message: string): Promise<void> {
    const result = await this.executor.run(['commit', '-S', '-m', message])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Mailmap ───────────────────────────────────────────────────────────────

  async readMailmap(): Promise<string> {
    const p = join(this.repoPath, '.mailmap')
    return existsSync(p) ? readFileSync(p, 'utf8') : ''
  }

  async writeMailmap(content: string): Promise<void> {
    writeFileSync(join(this.repoPath, '.mailmap'), content, 'utf8')
  }

  // ── Sparse checkout ───────────────────────────────────────────────────────

  async getSparseCheckout(): Promise<SparseCheckoutInfo> {
    const enabledResult = await this.executor.run(['config', '--get', 'core.sparseCheckout'])
    const enabled = enabledResult.stdout.trim() === 'true'
    const coneResult = await this.executor.run(['config', '--get', 'core.sparseCheckoutCone'])
    const cone = coneResult.stdout.trim() === 'true'
    const sparseFile = join(this.repoPath, '.git', 'info', 'sparse-checkout')
    const patterns = existsSync(sparseFile)
      ? readFileSync(sparseFile, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
      : []
    return { enabled, patterns, cone }
  }

  async setSparseCheckout(patterns: string[], cone: boolean): Promise<void> {
    if (patterns.length === 0) {
      await this.executor.run(['sparse-checkout', 'disable'])
      return
    }
    const initArgs = ['sparse-checkout', 'init']
    if (cone) initArgs.push('--cone')
    else initArgs.push('--no-cone')
    await this.executor.run(initArgs)
    const result = await this.executor.run(['sparse-checkout', 'set', ...patterns])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  // ── Git config ────────────────────────────────────────────────────────────

  async listConfig(scope: 'local' | 'global'): Promise<GitConfigEntry[]> {
    const result = await this.executor.run(['config', `--${scope}`, '--list'])
    if (result.exitCode !== 0) return []
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const eq = line.indexOf('=')
        if (eq === -1) return null
        return { key: line.slice(0, eq), value: line.slice(eq + 1), scope } as GitConfigEntry
      })
      .filter((e): e is GitConfigEntry => e !== null)
  }

  async getConfig(key: string, scope: 'local' | 'global' = 'local'): Promise<string | null> {
    const result = await this.executor.run(['config', `--${scope}`, '--get', key])
    if (result.exitCode !== 0) return null
    return result.stdout.trim() || null
  }

  async setConfig(key: string, value: string, scope: 'local' | 'global' = 'local'): Promise<void> {
    const result = await this.executor.run(['config', `--${scope}`, key, value])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  }

  async unsetConfig(key: string, scope: 'local' | 'global' = 'local'): Promise<void> {
    await this.executor.run(['config', `--${scope}`, '--unset', key])
  }

  // ── Bisect ────────────────────────────────────────────────────────────────

  // Reads the live bisect session state. `lastOutput` lets callers fold in the
  // stdout/stderr of the action they just ran (e.g. "… is the first bad commit",
  // "roughly N steps") which is the only place git reports those.
  private async readBisectStatus(lastOutput = ''): Promise<BisectStatus> {
    const active = existsSync(join(this.repoPath, '.git', 'BISECT_START'))
    if (!active) {
      return { active: false, currentRev: null, currentSubject: null, log: '', badCommit: null, remainingSteps: null }
    }
    const head = await this.executor.run(['log', '-1', '--format=%H%x00%s'])
    const [currentRev = null, currentSubject = null] = head.stdout.trim().split('\0')
    const logRes = await this.executor.run(['bisect', 'log'])
    const log = logRes.exitCode === 0 ? logRes.stdout : ''
    const badMatch =
      lastOutput.match(/([0-9a-f]{7,40}) is the first bad commit/) ||
      log.match(/# first bad commit:\s*\[([0-9a-f]{7,40})\]/)
    const stepsMatch = lastOutput.match(/roughly (\d+) steps?/)
    return {
      active: true,
      currentRev: currentRev || null,
      currentSubject: currentSubject || null,
      log,
      badCommit: badMatch ? badMatch[1] : null,
      remainingSteps: stepsMatch ? Number(stepsMatch[1]) : null,
    }
  }

  async getBisectStatus(): Promise<BisectStatus> {
    return this.readBisectStatus()
  }

  async bisectStart(bad?: string, good?: string): Promise<BisectStatus> {
    const args = ['bisect', 'start']
    if (bad) args.push(bad)
    if (good) args.push(good)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
    return this.readBisectStatus(`${result.stdout}\n${result.stderr}`)
  }

  async bisectMark(term: 'good' | 'bad', rev?: string): Promise<BisectStatus> {
    const args = ['bisect', term]
    if (rev) args.push(rev)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
    return this.readBisectStatus(`${result.stdout}\n${result.stderr}`)
  }

  async bisectSkip(rev?: string): Promise<BisectStatus> {
    const args = ['bisect', 'skip']
    if (rev) args.push(rev)
    const result = await this.executor.run(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
    return this.readBisectStatus(`${result.stdout}\n${result.stderr}`)
  }

  async bisectReset(): Promise<BisectStatus> {
    const result = await this.executor.run(['bisect', 'reset'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
    return this.readBisectStatus()
  }

  // ── Git LFS ─────────────────────────────────────────────────────────────────

  async lfsStatus(): Promise<LfsStatus> {
    const ver = await this.executor.run(['lfs', 'version'])
    const installed = ver.exitCode === 0
    if (!installed) return { installed: false, patterns: [], files: [] }

    // `git lfs track` lists the patterns currently recorded in .gitattributes:
    //   Listing tracked patterns
    //       *.psd (.gitattributes)
    const trackRes = await this.executor.run(['lfs', 'track'])
    const patterns = trackRes.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^Listing tracked/i.test(l))
      .map((l) => l.replace(/\s*\([^)]*\)\s*$/, '').trim())
      .filter(Boolean)

    // `git lfs ls-files --long --size`:  <oid> <* | -> <path> (size)
    const lsRes = await this.executor.run(['lfs', 'ls-files', '--long', '--size'])
    const files: LfsFile[] = lsRes.exitCode !== 0
      ? []
      : lsRes.stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const m = line.match(/^(\S+)\s+[*-]\s+(.+?)(?:\s+\(([^)]+)\))?$/)
            if (!m) return null
            return { oid: m[1], path: m[2].trim(), size: m[3] ?? null } as LfsFile
          })
          .filter((f): f is LfsFile => f !== null)

    return { installed, patterns, files }
  }

  async lfsInstall(): Promise<void> {
    const result = await this.executor.run(['lfs', 'install', '--local'])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
  }

  async lfsTrack(pattern: string): Promise<void> {
    const result = await this.executor.run(['lfs', 'track', pattern])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
  }

  async lfsUntrack(pattern: string): Promise<void> {
    const result = await this.executor.run(['lfs', 'untrack', pattern])
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || result.stdout.trim())
  }
}
