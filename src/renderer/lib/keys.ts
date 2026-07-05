export type Combo = string

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const MOD_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt', 'OS', 'Hyper', 'Super'])

export function eventToCombo(e: KeyboardEvent): Combo | null {
  if (MOD_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let k = e.key
  if (k === ' ') k = 'Space'
  else if (k.length === 1) k = k.toUpperCase()
  parts.push(k)
  return parts.join('+')
}

export function formatCombo(c: Combo): string {
  if (!c) return ''
  if (isMac()) {
    return c
      .replaceAll('Mod', '⌘')
      .replaceAll('Shift', '⇧')
      .replaceAll('Alt', '⌥')
      .replaceAll('Enter', '↵')
      .replaceAll('+', '')
  }
  return c.replaceAll('Mod', 'Ctrl').replaceAll('+', ' + ')
}

export function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}
