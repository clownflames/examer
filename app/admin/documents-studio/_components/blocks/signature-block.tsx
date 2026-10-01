'use client'

import * as React from 'react'
import Image from 'next/image'

import { num, str } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type SignatureBlockProps = Record<string, unknown> & {
  name?: string
  role?: string
  date?: string
  imageUrl?: string
  lineWidth?: number
  lineColor?: string
  /** Where the printed name/role/date sits relative to the line. */
  layout?: 'above' | 'below'
}

export function SignatureBlock(props: SignatureBlockProps) {
  const name = (props.name as string) ?? 'Authorised signatory'
  const role = (props.role as string) ?? ''
  const date = (props.date as string) ?? ''
  const imageUrl = (props.imageUrl as string) ?? ''
  const lineWidth = num(props.lineWidth, 200)
  const lineColor = str(props.lineColor, '#71717a')
  const layout = (props.layout as SignatureBlockProps['layout']) ?? 'below'

  const ink = (
    <div style={{ width: '100%' }}>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={name || 'Signature'}
          width={160}
          height={56}
          unoptimized
          style={{ display: 'block', width: 160, height: 56, objectFit: 'contain' }}
        />
      )}
      <div
        style={{
          width: lineWidth,
          maxWidth: '100%',
          borderBottom: `1.5px solid ${lineColor}`,
          marginTop: 4,
          marginBottom: 6,
        }}
      />
      <div style={{ width: lineWidth, maxWidth: '100%' }}>
        <div style={{ fontWeight: '600' }}>
          <TemplatedText text={name} />
        </div>
        {role ? (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>
            <TemplatedText text={role} />
          </div>
        ) : null}
        {date ? (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>
            <TemplatedText text={date} />
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <BlockFrame
      label="Signature"
      props={props}
      innerStyle={{
        width: Math.min(lineWidth, 100),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {layout === 'below' ? ink : null}
      {layout === 'below' ? null : (
        <div style={{ order: 2, width: '100%' }}>{ink}</div>
      )}
    </BlockFrame>
  )
}

SignatureBlock.craft = {
  displayName: 'Signature',
  props: {
    name: 'Authorised signatory',
    role: '',
    date: '',
    imageUrl: '',
    lineWidth: 200,
    lineColor: '#71717a',
    layout: 'below',
    fontSize: 13,
    color: '#18181b',
    marginTop: 18,
    marginBottom: 6,
  },
}
