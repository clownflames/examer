'use client'

import * as React from 'react'
import { useNode } from '@craftjs/core'

import { styleDefaults } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type HeadingBlockProps = Record<string, unknown> & {
  text?: string
  level?: 1 | 2 | 3 | 4
  /**
   * Set when the user edits the font size in the settings panel. Until then the
   * size follows the heading level, so switching H1 -> H2 actually resizes.
   */
  customSize?: boolean
}

export const HEADING_LEVEL_SIZE: Record<number, number> = {
  1: 32,
  2: 25,
  3: 20,
  4: 17,
}

const LEVEL_WEIGHT: Record<number, string> = {
  1: '800',
  2: '700',
  3: '600',
  4: '600',
}

const LEVEL_TRACKING: Record<number, number> = { 1: -0.6, 2: -0.3, 3: 0, 4: 0 }

export function HeadingBlock(props: HeadingBlockProps) {
  const { actions } = useNode()

  const text = (props.text as string) ?? ''
  const level = ((props.level as 1 | 2 | 3 | 4) ?? 1) as 1 | 2 | 3 | 4

  // Follow the level preset unless the user overrode the size explicitly.
  const levelStyle =
    props.customSize === true
      ? {}
      : {
          fontSize: HEADING_LEVEL_SIZE[level],
          fontWeight: LEVEL_WEIGHT[level],
          letterSpacing: LEVEL_TRACKING[level],
        }

  return (
    <BlockFrame
      label={`H${level}`}
      props={props}
      fill
      editable
      tokenInsert
      innerStyle={{ ...levelStyle, lineHeight: 1.25 }}
      onEdit={(value) =>
        actions.setProp((p: HeadingBlockProps) => {
          p.text = value
        })
      }
    >
      <TemplatedText text={text} />
    </BlockFrame>
  )
}

HeadingBlock.craft = {
  displayName: 'Heading',
  props: styleDefaults({
    text: 'Heading',
    level: 1,
    fontSize: HEADING_LEVEL_SIZE[1],
    fontWeight: LEVEL_WEIGHT[1],
    lineHeight: 1.25,
    letterSpacing: LEVEL_TRACKING[1],
    marginTop: 4,
  }),
}
