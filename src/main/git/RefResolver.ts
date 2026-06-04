import type { GitExecutor } from './GitExecutor.js'
import type { GitRef, GitRevision, RefGroups } from './types.js'

const FORMAT = '%(objectname)%00%(refname)%00%(symref)%00%(upstream:track)%00%(*objectname)'

export class RefResolver {
  async getRefs(executor: GitExecutor): Promise<RefGroups> {
    const [refsResult, headResult] = await Promise.all([
      executor.run(['for-each-ref', `--format=${FORMAT}`, '--sort=-version:refname']),
      executor.run(['rev-parse', '--abbrev-ref', 'HEAD']),
    ])

    const refs: GitRef[] = refsResult.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => this.parseLine(line))
      .filter((r): r is GitRef => r !== null)

    const head = headResult.stdout.trim() || null

    const branches = refs.filter((r) => r.type === 'head')
    const remotes = refs.filter((r) => r.type === 'remote')
    const tags = refs.filter((r) => r.type === 'tag')
    const stashes = refs.filter((r) => r.type === 'stash')

    return { branches, remotes, tags, stashes, head }
  }

  private parseLine(line: string): GitRef | null {
    const parts = line.split('\0')
    const objectId = parts[0]?.trim()
    const completeName = parts[1]?.trim()
    if (!objectId || !completeName) return null
    const track = parts[3]?.trim() ?? ''
    // For annotated tags, `*objectname` is the peeled (dereferenced) commit.
    // Empty for lightweight tags and all other refs, so fall back to objectId.
    const commitId = parts[4]?.trim() || objectId
    const aheadMatch = track.match(/ahead (\d+)/)
    const behindMatch = track.match(/behind (\d+)/)
    const ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : undefined
    const behind = behindMatch ? parseInt(behindMatch[1], 10) : undefined

    let type: GitRef['type']
    let name: string
    let remote = ''

    if (completeName.startsWith('refs/heads/')) {
      type = 'head'
      name = completeName.slice('refs/heads/'.length)
    } else if (completeName.startsWith('refs/remotes/')) {
      type = 'remote'
      const rest = completeName.slice('refs/remotes/'.length)
      const slash = rest.indexOf('/')
      remote = slash !== -1 ? rest.slice(0, slash) : rest
      name = slash !== -1 ? rest.slice(slash + 1) : rest
    } else if (completeName === 'refs/stash' || completeName.startsWith('refs/stash@')) {
      type = 'stash'
      name = completeName.slice('refs/'.length)
    } else if (completeName.startsWith('refs/tags/')) {
      type = 'tag'
      name = completeName.slice('refs/tags/'.length)
    } else {
      return null
    }

    return { objectId, commitId, completeName, name, type, remote, isHead: false, ahead, behind }
  }

  attachToRevisions(revisions: GitRevision[], groups: RefGroups): void {
    const byId = new Map<string, GitRef[]>()

    const allRefs = [...groups.branches, ...groups.remotes, ...groups.tags, ...groups.stashes]
    for (const ref of allRefs) {
      const arr = byId.get(ref.commitId) ?? []
      arr.push(ref)
      byId.set(ref.commitId, arr)
    }

    for (const rev of revisions) {
      const refs = byId.get(rev.objectId) ?? []
      // Mark the HEAD branch
      if (groups.head) {
        for (const r of refs) {
          if (r.type === 'head' && r.name === groups.head) r.isHead = true
        }
      }
      rev.refs = refs
    }
  }
}
