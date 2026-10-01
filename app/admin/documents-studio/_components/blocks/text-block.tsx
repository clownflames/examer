'use client'

import * as React from 'react'
import { useNode } from '@craftjs/core'

import { styleDefaults } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type TextBlockProps = Record<string, unknown> & {
  text?: string
}

export function TextBlock(props: TextBlockProps) {
  const { actions } = useNode()

  const text = (props.text as string) ?? ''

  return (
    <BlockFrame
      label="Text"
      props={props}
      fill
      editable
      tokenInsert      onEdit={(value) =>
        actions.setProp((p: TextBlockProps) => {
          p.text = value
        })
      }
    >
      <TemplatedText text={text} />
    </BlockFrame>
  )
}

TextBlock.craft = {
  displayName: 'Text',
  props: styleDefaults({
    text: 'Write something here…',
    lineHeight: 1.6,
  }),
}
