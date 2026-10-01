'use client'

import * as React from 'react'

import { num, styleDefaults, str } from '../../_lib/style'
import { BlockFrame } from './block-frame'

export type BoxBlockProps = Record<string, unknown> & {
  shape?: 'rect' | 'rounded' | 'pill' | 'circle' | 'bar'
  height?: number
  /** Only used when `height` is 0 — the box grows with its content. */
  minHeight?: number
  /** Text rendered inside the panel. */
  text?: string
  textColor?: string
  textSize?: number
  textAlign?: 'left' | 'center' | 'right'
  textPadding?: number
}

export function BoxBlock(props: BoxBlockProps) {
  const shape = (props.shape as BoxBlockProps['shape']) ?? 'rect'
  const height = num(props.height, 0)
  const minHeight = num(props.minHeight, 40)
  const width = num(props.width)
  const text = (props.text as string) ?? ''
  const textColor = str(props.textColor, '#18181b')
  const textSize = num(props.textSize, 14)
  const textPadding = num(props.textPadding, 12)
  const textAlign = (props.textAlign as BoxBlockProps['textAlign']) ?? 'center'

  const radius =
    shape === 'circle'
      ? '50%'
      : shape === 'pill'
        ? 999
        : shape === 'bar'
          ? Math.max(0, (height || 8) / 2)
          : num(props.borderRadius)

  const isCircle = shape === 'circle'

  return (
    <BlockFrame
      label="Box"
      props={props}
      innerStyle={{
        width: isCircle
          ? height || minHeight
          : width > 0
            ? width
            : '100%',
        height: isCircle ? height || minHeight : height || undefined,
        minHeight: isCircle ? undefined : height || minHeight,
        aspectRatio: isCircle ? '1 / 1' : undefined,
        borderRadius: radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          textAlign === 'left'
            ? 'flex-start'
            : textAlign === 'right'
              ? 'flex-end'
              : 'center',
        padding: text ? textPadding : 0,
        boxSizing: 'border-box',
      }}
    >
      {text ? (
        <span
          style={{
            color: textColor,
            fontSize: textSize,
            lineHeight: 1.4,
            textAlign,
            width: '100%',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </span>
      ) : null}
    </BlockFrame>
  )
}

BoxBlock.craft = {
  displayName: 'Box',
  props: styleDefaults({
    shape: 'rect',
    height: 0,
    minHeight: 80,
    text: '',
    textColor: '#18181b',
    textSize: 14,
    textAlign: 'center',
    textPadding: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    borderWidth: 0,
    marginTop: 6,
    marginBottom: 6,
  }),
}
