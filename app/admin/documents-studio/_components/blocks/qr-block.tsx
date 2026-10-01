'use client'

import * as React from 'react'
import QRCode from 'qrcode'

import { num, styleDefaults } from '../../_lib/style'
import { BlockFrame, Placeholder } from './block-frame'

export type QrBlockProps = Record<string, unknown> & {
  value?: string
  size?: number
}

export function QrBlock(props: QrBlockProps) {
  const value = (props.value as string) ?? ''
  const size = num(props.size, 120)

  const [dataUrl, setDataUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    if (!value) {
      // Clearing outside the effect body avoids a cascading render.
      queueMicrotask(() => {
        if (!cancelled) setDataUrl(null)
      })
      return
    }

    QRCode.toDataURL(value, {
      width: size * 3,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => {
        console.error('QR generation failed:', err)
        if (!cancelled) setDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <BlockFrame label="QR" props={props}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="QR code"
          style={{
            display: 'block',
            width: size,
            height: size,
            imageRendering: 'pixelated',
          }}
        />
      ) : (
        <Placeholder width={size} height={size} label="QR" />
      )}
    </BlockFrame>
  )
}

QrBlock.craft = {
  displayName: 'QR Code',
  props: styleDefaults({
    value: 'https://internbird.sqrock.cloud',
    size: 120,
    align: 'center',
    marginTop: 6,
    marginBottom: 6,
  }),
}
