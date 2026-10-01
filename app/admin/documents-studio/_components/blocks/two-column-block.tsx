'use client'

import * as React from 'react'
import { Element, useEditor, useNode } from '@craftjs/core'

import { num, readStyle, styleDefaults } from '../../_lib/style'
import { SELECT_COLOR, HOVER_COLOR } from './block-frame'

export type TwoColumnBlockProps = Record<string, unknown> & {
  /** Number of columns, 1–4. */
  count?: number
  /** Per-column width percentages. Falls back to equal widths. */
  widths?: number[]
  gap?: number
  minHeight?: number
  /** Show the dashed column guides while editing. */
  showGuides?: boolean
}

const MAX_COLUMNS = 4

export function TwoColumnBlock(props: TwoColumnBlockProps) {
  const { connectors, isSelected, isHovered } = useNode((node) => ({
    isSelected: node.events.selected,
    isHovered: node.events.hovered,
  }))

  const { enabled } = useEditor((s) => ({ enabled: s.options.enabled }))

  const count = Math.min(
    MAX_COLUMNS,
    Math.max(1, Math.round(num(props.count, 2)))
  )
  const gap = Math.max(0, num(props.gap, 20))
  const minHeight = Math.max(20, num(props.minHeight, 90))
  const showGuides = props.showGuides !== false && enabled

  const custom = Array.isArray(props.widths) ? (props.widths as number[]) : []
  const widths = Array.from({ length: count }, (_, i) => {
    const w = Number(custom[i])
    return w > 0 ? w : 100 / count
  })

  const s = readStyle(props)

  const outline = isSelected
    ? `2px solid ${SELECT_COLOR}`
    : isHovered
      ? `1.5px dashed ${HOVER_COLOR}`
      : 'none'

  return (
    <div
      ref={(ref) => {
        if (ref) connectors.connect(ref)
      }}
      style={{
        position: 'relative',
        display: 'flex',
        gap,
        boxSizing: 'border-box',
        minHeight,
        outline,
        outlineOffset: 1,
        marginTop: num(s.marginTop),
        marginRight: num(s.marginRight),
        marginBottom: num(s.marginBottom),
        marginLeft: num(s.marginLeft),
        backgroundColor:
          s.backgroundColor === 'transparent' ? undefined : s.backgroundColor,
        borderWidth: num(s.borderWidth),
        borderStyle: num(s.borderWidth) > 0 ? s.borderStyle : 'none',
        borderColor: s.borderColor,
        borderRadius: num(s.borderRadius),
        opacity: num(s.opacity, 100) / 100,
      }}
    >
      {enabled && isSelected && (
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
          }}
        >
          Columns
        </span>
      )}

      {widths.map((w, i) => (
        <div
          key={i}
          style={{
            flex: `${w} 1 0`,
            minWidth: 0,
            minHeight,
            boxSizing: 'border-box',
            backgroundColor: showGuides ? 'rgba(99,102,241,0.03)' : undefined,
            border: showGuides ? '1px dashed #c7d2fe' : undefined,
            borderRadius: 4,
          }}
        >
          <Element
            is="div"
            canvas
            id={`col-${i}`}
            style={{
              minHeight: Math.max(20, minHeight - 8),
              padding: 4,
            }}
          />
        </div>
      ))}
    </div>
  )
}

TwoColumnBlock.craft = {
  displayName: 'Columns',
  props: styleDefaults({
    count: 2,
    widths: [],
    gap: 20,
    minHeight: 90,
    showGuides: true,
    marginTop: 6,
    marginBottom: 6,
  }),
  rules: {
    canDrag: () => true,
  },
}
