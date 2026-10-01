'use client'

import * as React from 'react'

import { splitPlaceholders } from '../../_lib/variables'

/**
 * Renders text with `{{key}}` placeholders highlighted, so it is obvious which
 * parts of a block will be substituted when the PDF is generated.
 *
 * The surrounding block (`BlockFrame`) handles the click-to-insert, so this
 * component is presentational only.
 */
export function TemplatedText({
  text,
  muted,
}: {
  text: string
  muted?: boolean
}) {
  const segments = React.useMemo(() => splitPlaceholders(text), [text])

  if (segments.length === 1 && !segments[0].token) {
    return <>{text}</>
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (!segment.token) {
          return <React.Fragment key={index}>{segment.text}</React.Fragment>
        }

        return (
          <span
            key={index}
            data-token={segment.token}
            title={`Variable: ${segment.token}`}
            style={{
              background: muted
                ? 'rgba(99,102,241,0.08)'
                : 'rgba(99,102,241,0.16)',
              color: muted ? 'inherit' : '#3730a3',
              borderRadius: 3,
              padding: '0 2px',
              boxShadow: 'inset 0 -1px 0 rgba(99,102,241,0.5)',
              cursor: 'help',
              whiteSpace: 'pre-wrap',
            }}
          >
            {segment.text}
          </span>
        )
      })}
    </>
  )
}

/**
 * Insert `{{key}}` into the caret position of the block being edited.
 *
 * Returns true when the insertion happened, so callers can keep the editor
 * open instead of committing an empty edit.
 */
export function insertTokenAtCaret(
  container: HTMLElement | null,
  key: string
): boolean {
  if (!container) return false

  const token = `{{${key}}}`
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) {
    // Caret is outside this block — append instead of doing nothing.
    container.textContent = `${container.textContent ?? ''}${token}`
    return true
  }

  range.deleteContents()
  const node = document.createTextNode(token)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}
