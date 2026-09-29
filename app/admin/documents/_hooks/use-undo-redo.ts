'use client'

import { useCallback, useRef, useState } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UseUndoRedoReturn<T> = {
  state: T
  /** Replace state without adding to history — use for typing/rapid updates. */
  set: (next: T | ((prev: T) => T)) => void
  /**
   * Replace state AND push a history entry.
   * Use when a discrete action happens (add block, delete, reorder).
   */
  commit: (next: T | ((prev: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Clear history (e.g. after save). */
  reset: (next?: T) => void
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

const MAX_HISTORY = 50

export function useUndoRedo<T>(initial: T): UseUndoRedoReturn<T> {
  const [state, setState] = useState<T>(initial)
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])

  // Force rerender when past/future change so canUndo/canRedo update
  const [, forceUpdate] = useState(0)
  const rerender = useCallback(() => forceUpdate((n) => n + 1), [])

  /**
   * `commit` = push current state to past, then update.
   * We DON'T push if the new value is identical (shallow compare via JSON).
   */
  const commit = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((current) => {
        const resolved =
          typeof next === 'function'
            ? (next as (p: T) => T)(current)
            : next

        try {
          if (JSON.stringify(current) === JSON.stringify(resolved)) {
            return current
          }
        } catch {
          // ignore — circular refs won't happen here
        }

        past.current.push(current)
        if (past.current.length > MAX_HISTORY) {
          past.current.shift()
        }
        future.current = []
        rerender()
        return resolved
      })
    },
    [rerender]
  )

  /** `set` = update without history entry. */
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((current) =>
        typeof next === 'function'
          ? (next as (p: T) => T)(current)
          : next
      )
    },
    []
  )

  const undo = useCallback(() => {
    setState((current) => {
      const prev = past.current.pop()
      if (prev === undefined) return current
      future.current.push(current)
      rerender()
      return prev
    })
  }, [rerender])

  const redo = useCallback(() => {
    setState((current) => {
      const next = future.current.pop()
      if (next === undefined) return current
      past.current.push(current)
      rerender()
      return next
    })
  }, [rerender])

  const reset = useCallback(
    (next?: T) => {
      past.current = []
      future.current = []
      setState((current) => next ?? current)
      rerender()
    },
    [rerender]
  )

  return {
    state,
    set,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    reset,
  }
}