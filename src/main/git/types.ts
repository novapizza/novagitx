export interface GitRevision {
  objectId: string
  parentIds: string[]
  author: string
  authorEmail: string
  authorUnixTime: number
  committer: string
  committerEmail: string
  commitUnixTime: number
  subject: string
  body: string | null
  refs: GitRef[]
  branchLane: number
  lanes: number[]
}

export interface GitRef {
  objectId: string
  /** The commit this ref points to. Same as objectId, except for annotated
   * tags where objectId is the tag object and commitId is the peeled commit. */
  commitId: string
  completeName: string
  name: string
  type: 'head' | 'remote' | 'tag' | 'stash'
  remote: string
  isHead: boolean
  ahead?: number
  behind?: number
}

export interface GitItemStatus {
  name: string
  oldName: string | null
  isNew: boolean
  isDeleted: boolean
  isChanged: boolean
  isRenamed: boolean
  isUnmerged: boolean
  isStaged: boolean
  renameSimilarity: number | null
}

export interface DiffLine {
  type: 'ctx' | 'add' | 'del' | 'hunk'
  oldLineNum: number | null
  newLineNum: number | null
  text: string
}

export interface DiffFile {
  path: string
  oldPath: string | null
  status: 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?'
  addedLines: number
  removedLines: number
  lines: DiffLine[]
}

export interface BlameLine {
  hash: string
  author: string
  authorTime: number
  lineNum: number
  text: string
}

export interface ReflogEntry {
  hash: string
  selector: string
  action: string
  date: string
}

export interface Remote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface ConflictFile {
  path: string
}

export interface StashEntry {
  index: number
  ref: string
  message: string
  hash: string
}

export interface Submodule {
  path: string
  url: string
  branch: string | null
  hash: string | null
  status: 'clean' | 'modified' | 'uninitialized'
}

export interface CleanEntry {
  path: string
  isDir: boolean
}

export interface RebaseCommit {
  action: 'pick' | 'squash' | 'fixup' | 'drop' | 'reword' | 'edit'
  hash: string
  subject: string
}

export interface LogOptions {
  maxCount?: number
  skip?: number
  onlyCurrentBranch?: boolean
  author?: string
  grep?: string
  since?: string
  until?: string
  pickaxe?: string          // -S "added/removed text"
  pickaxeRegex?: string     // -G regex against diff
  pathFilter?: string       // -- <path>
}

export interface Worktree {
  path: string
  hash: string
  branch: string | null
  isLocked: boolean
  isPrunable: boolean
  isDetached: boolean
  isMain: boolean
}

export interface FsckResult {
  output: string
  hasIssues: boolean
}

export interface CommitSignature {
  status: 'good' | 'bad' | 'unknown' | 'expired' | 'unsigned'
  signer: string | null
  key: string | null
}

export interface SparseCheckoutInfo {
  enabled: boolean
  patterns: string[]
  cone: boolean
}

export interface GitConfigEntry {
  key: string
  value: string
  scope: 'local' | 'global' | 'system'
}

export interface BisectStatus {
  active: boolean
  currentRev: string | null
  currentSubject: string | null
  log: string
  badCommit: string | null
  remainingSteps: number | null
}

export interface LfsFile {
  path: string
  oid: string
  size: string | null
}

export interface LfsStatus {
  installed: boolean      // git-lfs binary is available on this machine
  patterns: string[]      // glob patterns tracked via .gitattributes (filter=lfs)
  files: LfsFile[]        // objects currently managed by LFS (git lfs ls-files)
}

export interface RepoInfo {
  path: string
  name: string
  currentBranch: string | null
  isDetachedHead: boolean
}

export interface RefGroups {
  branches: GitRef[]
  remotes: GitRef[]
  tags: GitRef[]
  stashes: GitRef[]
  head: string | null
}
