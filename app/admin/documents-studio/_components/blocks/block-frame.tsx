'use client'

import * as React from 'react'
import { useEditor, useNode } from '@craftjs/core'

import {
  ALIGN_TO_FLEX,
  boxCss,
  contentCss,
  num,
  readStyle,
  textCss,
  type BlockStyleProps,
} from '../../_lib/style'
import { insertTokenAtCaret } from './templated-text'

export const SELECT_COLOR = '#6366f1'
export const HOVER_COLOR = '#a5b4fc'

/* -------------------------------------------------------------------------- */
/*  Frame                                                                      */
/* -------------------------------------------------------------------------- */

type FrameProps = {
  children: React.ReactNode
  /** Node props — merged over the shared style defaults. */
  props: Record<string, unknown>
  /** When true the inner content stretches to the full available width. */
  fill?: boolean
  /** Allow double-click / click-to-edit inline text editing. */
  editable?: boolean
  /** Receives the edited text when inline editing finishes. */
  onEdit?: (text: string) => void
  /** Override the label shown in the corner badge. */
  label?: string
  /**
   * Allow clicking a `{{placeholder}}` in the content to insert it at the
   * caret instead of entering edit mode.
   */
  tokenInsert?: boolean
  style?: React.CSSProperties
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  innerStyle?: React.CSSProperties
  className?: string
}

/**
 * Shared wrapper for every block: selection / hover outline, the corner badge,
 * the flex alignment row, and inline contentEditable text editing.
 */
export function BlockFrame({
  children,
  props,
  fill = false,
  editable = false,
  onEdit,
  tokenInsert = false,
  label,
  style,
  onDoubleClick,
  innerStyle,
  className,
}: FrameProps) {
  const {
    id: nodeId,
    connectors: { connect, drag },
    isSelected,
    isHovered,
  } = useNode((node) => ({
    isSelected: node.events.selected,
    isHovered: node.events.hovered,
  }))

  const { actions: editorActions, enabled } = useEditor((state) => ({
    enabled: state.options.enabled,
  }))

  const selectNode = React.useCallback(
    (id: string) => editorActions.selectNode(id),
    [editorActions]
  )

  const [editing, setEditing] = React.useState(false)

  const frameRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  /** Text captured at the moment editing starts. */
  const seedRef = React.useRef('')
  /** A `{{key}}` queued for insertion once the editor is mounted. */
  const pendingTokenRef = React.useRef<string | null>(null)

  const s: BlockStyleProps = readStyle(props)

  const outline = editing
    ? 'none'
    : isSelected
      ? `2px solid ${SELECT_COLOR}`
      : isHovered
        ? `1.5px dashed ${HOVER_COLOR}`
        : 'none'

  /* ---------------------------------------------------------------------- */
  /*  Connectors                                                            */
  /* ---------------------------------------------------------------------- */

  // While editing we connect *without* drag, so the element is not marked as
  // draggable and text selection behaves normally.
  React.useEffect(() => {
    const el = frameRef.current
    if (!el || !enabled) return
    if (editing) {
      connect(el)
    } else {
      connect(drag(el))
    }
  }, [connect, drag, editing, enabled, isSelected])

  /* ---------------------------------------------------------------------- */
  /*  Editing                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Craft.js binds mousedown/click in the *capture* phase on the node's own
   * element, so a React onMouseDown on a descendant is always too late to stop
   * it. Blocking it here (a capture listener registered after Craft's own, on
   * the same element) keeps the node selected and the caret stable while the
   * user types.
   */
  React.useEffect(() => {
    const el = frameRef.current
    if (!el || !editing) return

    const swallow = (event: Event) => {
      event.stopImmediatePropagation()
    }

    el.addEventListener('mousedown', swallow, true)
    el.addEventListener('click', swallow, true)
    el.addEventListener('dragstart', swallow, true)

    return () => {
      el.removeEventListener('mousedown', swallow, true)
      el.removeEventListener('click', swallow, true)
      el.removeEventListener('dragstart', swallow, true)
    }
  }, [editing])

  /**
   * Seed the freshly mounted contentEditable.
   *
   * The editing branch deliberately renders **no React children** — if React
   * owned the text it would restore the stored value on every re-render (for
   * example when the selection changes) and wipe out what the user just typed.
   */
  React.useEffect(() => {
    if (!editing) return
    const el = contentRef.current
    if (!el) return

    el.textContent = seedRef.current

    // Put the caret at the end of the existing text, then append a token if one
    // was queued by a click on a `{{placeholder}}`.
    const pending = pendingTokenRef.current
    pendingTokenRef.current = null

    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)

    if (pending) {
      const node = document.createTextNode(`{{${pending}}}`)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [editing])

  function startEditing() {
    if (!enabled || !editable || editing) return
    seedRef.current = contentRef.current?.textContent ?? ''
    setEditing(true)
  }

  function stopEditing() {
    if (!editing) return

    // Read the edited region only — the frame also contains the corner badge
    // and any editor-only labels, which must never end up in the text.
    const raw = contentRef.current?.innerText ?? ''
    const value = raw.replace(/\n+$/, '')

    setEditing(false)

    // Keep the block selected so the right panel still shows its settings.
    selectNode(nodeId)
    onEdit?.(value)
  }

  function cancelEditing() {
    if (!editing) return
    setEditing(false)
    // Discard whatever was typed — the next render restores the stored text.
  }

  /** Insert `{{key}}` at the caret (or append) and drop into edit mode. */
  function insertToken(key: string): boolean {
    if (!enabled || !editable) return false
    if (editing) {
      return insertTokenAtCaret(contentRef.current, key)
    }

    // Not editing yet: seed the caret at the end of the current text, then let
    // the effect below put it in edit mode.
    seedRef.current = contentRef.current?.textContent ?? ''
    pendingTokenRef.current = key
    setEditing(true)
    return true
  }

  const contentStyle: React.CSSProperties = {
    ...contentCss(s, fill),
    ...textCss(s),
    ...innerStyle,
  }

  return (
    <div
      ref={frameRef}
      data-studio-block={label}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: ALIGN_TO_FLEX[s.align],
        alignItems: 'stretch',
        boxSizing: 'border-box',
        outline,
        outlineOffset: 1,
        cursor: editing ? 'text' : enabled ? 'move' : 'default',
        ...boxCss(s),
        ...style,
      }}
    >
      {enabled && (isSelected || editing) && (
        <span
          style={{
            position: 'absolute',
            top: -17,
            left: 0,
            zIndex: 5,
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 9,
            lineHeight: '14px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            background: SELECT_COLOR,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}

      {editing ? (
        <div
          /* Remount so the seeded DOM is never reconciled by React. */
          key="editing"
          ref={contentRef}
          style={{
            ...contentStyle,
            outline: 'none',
            cursor: 'text',
            minHeight: 20,
          }}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onBlur={stopEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelEditing()
              frameRef.current?.focus?.()
            }
            // Enter inserts a line break rather than a paragraph element, so
            // the text stays a plain string that round-trips through storage.
            if (e.key === 'Enter') e.preventDefault()
          }}
        />
      ) : (
        <div
          ref={contentRef}
          style={{
            ...contentStyle,
            cursor: editable ? 'text' : undefined,
          }}
          onClick={
            editable
              ? (e) => {
                  // Clicking a `{{token}}` inserts it at the caret instead of
                  // dropping into edit mode.
                  const token = tokenInsert
                    ? (e.target as HTMLElement).closest('[data-token]')
                    : null

                  if (token) {
                    e.preventDefault()
                    e.stopPropagation()
                    insertToken(token.getAttribute('data-token') as string)
                    return
                  }
                  startEditing()
                }
              : onDoubleClick
          }
          onDoubleClick={onDoubleClick}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Editor-only helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Small hint shown inside empty placeholders (never rendered in the PDF). */
export function Placeholder({
  width,
  height,
  radius = 4,
  label,
  children,
}: {
  width: number | string
  height: number
  radius?: number
  label?: string
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        borderRadius: radius,
        border: '1.5px dashed #c4c4cc',
        background: '#f6f6f8',
        color: '#8b8b95',
        fontSize: 11,
        lineHeight: 1.3,
        textAlign: 'center',
        padding: 4,
        whiteSpace: 'pre-line',
      }}
    >
      {children ?? label}
    </div>
  )
}

/** Snap a value to the grid when grid snapping is enabled. */
export function snap(value: number, gridSize: number): number {
  if (!gridSize || gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

export { num }
