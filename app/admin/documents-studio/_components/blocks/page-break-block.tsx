'use client'

import * as React from 'react'
import { useEditor } from '@craftjs/core'

import { BlockFrame } from './block-frame'

export type PageBreakBlockProps = Record<string, unknown> & {
  /** Visible label on the canvas guide. */
  label?: string
}

export function PageBreakBlock(props: PageBreakBlockProps) {
  const { enabled } = useEditor((s) => ({ enabled: s.options.enabled }))
  const label = (props.label as string) ?? 'Page break'

  return (
    <BlockFrame
      label="Page break"
      props={props}
      innerStyle={{ width: '100%', padding: 0 }}
    >
      {enabled ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              flex: 1,
              borderTop: '2px dashed #a5b4fc',
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6366f1',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          <span style={{ flex: 1, borderTop: '2px dashed #a5b4fc' }} />
        </div>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </BlockFrame>
  )
}

PageBreakBlock.craft = {
  displayName: 'Page break',
  props: {
    label: 'Page break',
    marginTop: 6,
    marginBottom: 6,
  },
}
