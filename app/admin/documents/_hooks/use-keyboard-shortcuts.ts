'use client'

import { useEffect } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ShortcutHandlers = {
  onSave?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onEscape?: () => void
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Global keyboard shortcuts for the document builder.
 *
 * - Ctrl/Cmd + S          → save
 * - Ctrl/Cmd + Z          → undo
 * - Ctrl/Cmd + Shift + Z  → redo
 * - Ctrl/Cmd + Y          → redo
 * - Delete / Backspace    → delete selected block (only when focus is not in an input)
 * - Ctrl/Cmd + D          → duplicate selected block
 * - Escape                → deselect
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }

    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey
      const typing = isTypingTarget(e.target)

      // ---- Save (works even while typing) ----
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handlers.onSave?.()
        return
      }

      // ---- Undo (works even while typing) ----
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handlers.onUndo?.()
        return
      }

      // ---- Redo: Ctrl+Shift+Z or Ctrl+Y ----
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handlers.onRedo?.()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handlers.onRedo?.()
        return
      }

      // ---- Duplicate (only when NOT typing) ----
      if (mod && e.key.toLowerCase() === 'd' && !typing) {
        e.preventDefault()
        handlers.onDuplicate?.()
        return
      }

      // ---- Delete / Backspace (only when NOT typing) ----
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        e.preventDefault()
        handlers.onDelete?.()
        return
      }

      // ---- Escape ----
      if (e.key === 'Escape') {
        handlers.onEscape?.()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}