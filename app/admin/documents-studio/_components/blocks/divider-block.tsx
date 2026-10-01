'use client'

import * as React from 'react'

import { num, styleDefaults, str } from '../../_lib/style'
import { BlockFrame } from './block-frame'

export type DividerBlockProps = Record<string, unknown> & {
  /** Line weight in px. */
  thickness?: number
  /** Line colour — independent of the box border colour. */
  lineColor?: string
  /** Length of the line as a percentage of the block width. */
  length?: number
  dash?: string
}

export function DividerBlock(props: DividerBlockProps) {
  const thickness = Math.max(1, num(props.thickness, 1))
  const lineColor = str(props.lineColor, '#d4d4d8')
  const length = Math.min(100, Math.max(5, num(props.length, 100)))
  const dash = str(props.dash, 'none')

  return (
    <BlockFrame
      label="Divider"
      props={props}
      innerStyle={{ padding: 0, width: '100%' }}
    >
      <hr
        style={{
          border: 'none',
          borderTop: `${thickness}px ${dash} ${lineColor}`,
          width: `${length}%`,
          margin: 0,
          display: 'block',
        }}
      />
    </BlockFrame>
  )
}

DividerBlock.craft = {
  displayName: 'Divider',
  props: styleDefaults({
    thickness: 1,
    lineColor: '#d4d4d8',
    length: 100,
    dash: 'none',
    marginTop: 8,
    marginBottom: 8,
  }),
}
