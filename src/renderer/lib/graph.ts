import type { GitRevision } from '@/types/git'

// Mirror of src/main/git/GraphBuilder.ts. Lanes must be computed over the full
// loaded revision list at once — when the log is paginated, the renderer rebuilds
// lanes across the concatenated pages so they connect cleanly across page seams
// (a per-page build would restart lanes at 0 on every page).
export function buildGraphLanes(revisions: GitRevision[]): void {
  const activeLanes: (string | null)[] = []

  for (const rev of revisions) {
    let myLane = activeLanes.indexOf(rev.objectId)

    if (myLane === -1) {
      const emptySlot = activeLanes.indexOf(null)
      myLane = emptySlot !== -1 ? emptySlot : activeLanes.length
      if (emptySlot !== -1) {
        activeLanes[emptySlot] = rev.objectId
      } else {
        activeLanes.push(rev.objectId)
      }
    }

    rev.branchLane = myLane
    rev.lanes = activeLanes
      .map((id, i) => (id !== null ? i : -1))
      .filter((i) => i !== -1)

    activeLanes[myLane] = null

    for (let i = 0; i < rev.parentIds.length; i++) {
      const parentId = rev.parentIds[i]
      if (activeLanes.includes(parentId)) continue

      if (i === 0) {
        activeLanes[myLane] = parentId
      } else {
        const slot = activeLanes.indexOf(null)
        if (slot !== -1) {
          activeLanes[slot] = parentId
        } else {
          activeLanes.push(parentId)
        }
      }
    }
  }
}
