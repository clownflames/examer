'use client'

import * as React from 'react'
import { useEditor } from '@craftjs/core'

import { readStyle, styleDefaults } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type ButtonBlockProps = Record<string, unknown> & {
  text?: string
  href?: string
  /** Extra inner padding, on top of the shared box padding. */
  padX?: number
  padY?: number
  borderWidth?: number
  borderColor?: string
  /** Draw an outline-style button. */
  variant?: 'solid' | 'outline'
}

export function ButtonBlock(props: ButtonBlockProps) {
  const { enabled } = useEditor((s) => ({ enabled: s.options.enabled }))

  const text = (props.text as string) ?? 'Click me'
  const href = (props.href as string) ?? '#'
  const variant = (props.variant as 'solid' | 'outline') ?? 'solid'

  const s = readStyle(props)
  const padX = Number(props.padX ?? 18)
  const padY = Number(props.padY ?? 10)

  const solidBg = s.backgroundColor === 'transparent' ? '#4f46e5' : s.backgroundColor
  const solidFg = variant === 'solid' ? '#ffffff' : s.color

  return (
    <BlockFrame
      label="Button"
      props={props}
      innerStyle={{ padding: 0 }}
    >
      <a
        href={enabled ? undefined : href}
        onClick={(e) => {
          if (enabled) e.preventDefault()
        }}
        style={{
          display: 'inline-block',
          padding: `${padY}px ${padX}px`,
          borderRadius: s.borderRadius,
          backgroundColor: variant === 'solid' ? solidBg : 'transparent',
          color: variant === 'solid' ? solidFg : s.color,
          borderWidth: variant === 'outline' ? Math.max(1, s.borderWidth) : 0,
          borderStyle: 'solid',
          borderColor: variant === 'outline' ? s.borderColor : 'transparent',
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          fontStyle: s.fontStyle,
          fontFamily: s.fontFamily,
          lineHeight: 1.2,
          letterSpacing: s.letterSpacing,
          textTransform: s.textTransform,
          textDecoration: 'none',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          cursor: enabled ? 'move' : 'pointer',
        }}
      >
        <TemplatedText text={text} />
      </a>
    </BlockFrame>
  )
}

ButtonBlock.craft = {
  displayName: 'Button',
  props: styleDefaults({
    text: 'Click me',
    href: '#',
    variant: 'solid',
    padX: 18,
    padY: 10,
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 0,
    borderColor: '#4f46e5',
    marginTop: 6,
    marginBottom: 6,
  }),
}
