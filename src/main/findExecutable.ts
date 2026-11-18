import { existsSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Search PATH for `name` (honouring PATHEXT on Windows). Returns the full path or null. */
export function findOnPath(name: string): string | null {
  const dirs = (process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter(Boolean)
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir.replace(/^"|"$/g, ''), name + ext)
      if (isFile(candidate)) return candidate
    }
  }
  return null
}

/**
 * Resolve an executable: PATH first (respects the user's chosen install), then
 * the given fallback locations (Windows installs that weren't added to PATH).
 * Returns the bare name if nothing is found, so spawn emits ENOENT as usual.
 */
export function findExecutable(name: string, fallbacks: Array<string | undefined | false>): string {
  const onPath = findOnPath(name)
  if (onPath) return onPath
  for (const candidate of fallbacks) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return name
}
