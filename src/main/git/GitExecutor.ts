import { spawn } from 'child_process'
import { join } from 'node:path'
import { findExecutable } from '../findExecutable'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Resolve the `git` binary. PATH comes first so the user's chosen git (Scoop,
 * portable, newer version) wins. On Windows, PATH is occasionally not configured
 * (e.g. Git installed but "add to PATH" unchecked), so fall back to the
 * standard Git for Windows install locations before giving up.
 */
let cachedGitPath: string | null = null
function resolveGitBinary(): string {
  if (cachedGitPath) return cachedGitPath
  const isWin = process.platform === 'win32'
  cachedGitPath = findExecutable(
    'git',
    isWin
      ? [
          process.env.ProgramFiles && join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe'),
          process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)']!, 'Git', 'cmd', 'git.exe'),
          process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe'),
        ]
      : [],
  )
  // If nothing was found this is the bare 'git' and spawn emits ENOENT (handled below).
  return cachedGitPath
}

export class GitExecutor {
  constructor(private readonly workingDir: string) {}

  run(args: string[], envOverrides?: Record<string, string>): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const gitBinary = resolveGitBinary()
      const proc = spawn(gitBinary, args, {
        cwd: this.workingDir,
        // Without this, Windows opens a console window for every git call.
        windowsHide: true,
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
