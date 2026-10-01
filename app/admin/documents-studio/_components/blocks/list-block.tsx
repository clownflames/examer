'use client'

import * as React from 'react'
import { useNode } from '@craftjs/core'

import { arr, styleDefaults } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type ListBlockProps = Record<string, unknown> & {
  items?: string[]
  ordered?: boolean
  /** Gap between items, in px. */
  itemGap?: number
  indent?: number
}

export function ListBlock(props: ListBlockProps) {
  const { actions } = useNode()

  const items = arr<string>(props.items)
  const ordered = props.ordered === true
  const itemGap = Number(props.itemGap ?? 4)
  const indent = Number(props.indent ?? 24)

  function updateItem(index: number, value: string) {
    actions.setProp((p: ListBlockProps) => {
      const next = [...arr<string>(p.items)]
      next[index] = value
      p.items = next
    })
  }

  return (
    <BlockFrame label="List" props={props} fill>
      <ul
        style={{
          listStyleType: ordered ? 'decimal' : 'disc',
          paddingLeft: indent,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: itemGap,
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ display: 'list-item' }}>
            <ListItemEditor
              value={item}
              onCommit={(value) => updateItem(i, value)}
            />
          </li>
        ))}
      </ul>
    </BlockFrame>
  )
}

/**
 * A single list item that can be edited in place. While not focused it renders
 * the plain (token-highlighted) text; on focus it becomes a bare
 * contentEditable so React never fights the user's typing.
 */
function ListItemEditor({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const ref = React.useRef<HTMLSpanElement>(null)

  // Keep the draft in step with external changes, but never mid-edit.
  // Deferred so it does not cascade a render inside the effect body.
  React.useEffect(() => {
    if (editing) return
    queueMicrotask(() => setDraft(value))
  }, [value, editing])

  React.useEffect(() => {
    const el = ref.current
    if (el && editing && el.textContent !== draft) {
      el.textContent = draft
    }
  }, [editing, draft])

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ outline: 'none', cursor: 'text' }}
      >
        <TemplatedText text={value} muted />
      </span>
    )
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      style={{ outline: 'none', whiteSpace: 'pre-wrap' }}
      onInput={(e) => setDraft(e.currentTarget.textContent ?? '')}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? '').replace(/\n+$/, '')
        setEditing(false)
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}

ListBlock.craft = {
  displayName: 'List',
  props: styleDefaults({
    items: ['First item', 'Second item', 'Third item'],
    ordered: false,
    itemGap: 4,
    indent: 24,
    lineHeight: 1.6,
  }),
}
