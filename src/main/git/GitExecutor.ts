import { spawn } from 'child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Resolve the `git` binary. The common case is that `git` is on PATH, which
 * works on every platform. On Windows, PATH is occasionally not configured
 * (e.g. Git installed but "add to PATH" unchecked), so fall back to the
 * standard Git for Windows install locations before giving up.
 */
let cachedGitPath: string | null = null
function resolveGitBinary(): string {
  if (cachedGitPath) return cachedGitPath
  if (process.platform === 'win32') {
    const candidates = [
      process.env.ProgramFiles && join(process.env.ProgramFiles, 'Git', 'bin', 'git.exe'),
      process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)']!, 'Git', 'bin', 'git.exe'),
      process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'git.exe'),
    ].filter((p): p is string => Boolean(p))
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        cachedGitPath = candidate
        return candidate
      }
    }
  }
  // Rely on PATH resolution; if that fails, spawn emits ENOENT (handled below).
  cachedGitPath = 'git'
  return cachedGitPath
}

export class GitExecutor {
  constructor(private readonly workingDir: string) {}

  run(args: string[], envOverrides?: Record<string, string>): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const gitBinary = resolveGitBinary()
      const proc = spawn(gitBinary, args, {
        cwd: this.workingDir,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LANG: 'en_US.UTF-8', ...envOverrides },
      })

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
      proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

      proc.on('close', (code) => {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          exitCode: code ?? 1,
        })
      })

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              process.platform === 'win32'
                ? 'Git was not found. Install Git for Windows (https://git-scm.com/download/win) and make sure it is on your PATH.'
                : 'Git was not found. Install Git and make sure it is on your PATH.',
            ),
          )
          return
        }
        reject(err)
      })
    })
  }
}
