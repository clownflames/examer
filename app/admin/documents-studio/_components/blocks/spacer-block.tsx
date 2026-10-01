'use client'

import * as React from 'react'
import { useEditor } from '@craftjs/core'

import { num } from '../../_lib/style'
import { BlockFrame } from './block-frame'

export type SpacerBlockProps = Record<string, unknown> & {
  height?: number
}

export function SpacerBlock(props: SpacerBlockProps) {
  const height = Math.max(1, num(props.height, 32))
  const { enabled } = useEditor((s) => ({ enabled: s.options.enabled }))

  return (
    <BlockFrame
      label="Spacer"
      props={props}
      innerStyle={{
        height,
        padding: 0,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          enabled && height > 12
            ? 'repeating-linear-gradient(45deg, rgba(99,102,241,0.07) 0 6px, transparent 6px 12px)'
            : undefined,
      }}
    >
      {enabled && height > 12 ? (
        <span
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#8b8b95',
            userSelect: 'none',
          }}
        >
          {height}px
        </span>
      ) : null}
    </BlockFrame>
  )
}

SpacerBlock.craft = {
  displayName: 'Spacer',
  props: { height: 32 },
}
