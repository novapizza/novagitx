import { useSyncExternalStore } from 'react'

// Tracks whether the app window currently has OS focus. Used to pause the live
// polling queries (status, diffs, conflicts, stashes) while NovaGitX is sitting
// unfocused behind another window — otherwise we keep spawning `git` subprocesses
// every few seconds all day for a view nobody is looking at.
//
// React Query already pauses interval polling when the window is *minimized*
// (document.visibilityState === 'hidden'), but a window that is merely unfocused
// stays "visible", so its timers keep firing. Chromium fires window focus/blur
// events on OS-level focus changes in Electron, which covers that gap.

let focused = typeof document !== 'undefined' ? document.hasFocus() : true
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (next === focused) return
  focused = next
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => set(true))
  window.addEventListener('blur', () => set(false))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWindowFocus(): boolean {
  return useSyncExternalStore(subscribe, () => focused, () => focused)
}
