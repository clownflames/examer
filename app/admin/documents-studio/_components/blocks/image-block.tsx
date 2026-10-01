'use client'

import * as React from 'react'
import Image from 'next/image'

import { num, styleDefaults } from '../../_lib/style'
import { BlockFrame, Placeholder } from './block-frame'

export type ImageBlockProps = Record<string, unknown> & {
  src?: string
  alt?: string
  /** Rendered height in px. Ignored when objectFit is "contain". */
  height?: number
  objectFit?: 'contain' | 'cover' | 'fill' | 'none'
  /** Tint / placeholder shown while no image is picked. */
  placeholderBg?: string
}

export function ImageBlock(props: ImageBlockProps) {
  const src = (props.src as string) ?? ''
  const alt = (props.alt as string) ?? 'Image'
  const objectFit = (props.objectFit as ImageBlockProps['objectFit']) ?? 'contain'
  const height = num(props.height, 180)
  const placeholderBg = (props.placeholderBg as string) ?? '#f4f4f5'
  const borderRadius = num(props.borderRadius)

  const width = num(props.width)

  return (
    <BlockFrame label="Image" props={props}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={Math.max(1, width || 400)}
          height={Math.max(1, height)}
          unoptimized
          style={{
            display: 'block',
            width: width > 0 ? width : '100%',
            maxWidth: '100%',
            height: objectFit === 'contain' ? 'auto' : height,
            borderRadius,
            objectFit,
          }}
        />
      ) : (
        <Placeholder
          width={width > 0 ? width : '100%'}
          height={height}
          radius={borderRadius}
          label={'No image selected\nPick one in the right panel'}
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              background: placeholderBg,
              borderRadius,
            }}
          />
        </Placeholder>
      )}
    </BlockFrame>
  )
}

ImageBlock.craft = {
  displayName: 'Image',
  props: styleDefaults({
    src: '',
    alt: 'Image',
    width: 320,
    height: 180,
    objectFit: 'contain',
    placeholderBg: '#f4f4f5',
    borderRadius: 4,
    align: 'center',
    marginTop: 6,
    marginBottom: 6,
  }),
}
