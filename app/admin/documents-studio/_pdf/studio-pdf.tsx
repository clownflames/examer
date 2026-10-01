'use client'

/*
 * This module renders react-pdf primitives, not DOM elements. react-pdf's
 * <Image> has no `alt` prop because it is a PDF XObject, not an <img> tag.
 */
/* eslint-disable jsx-a11y/alt-text */

import * as React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

import {
  resolvePageSize,
  type CraftJson,
  type CraftNode,
  type PageSetup,
} from '../constants'
import { getRootNodeId, readPageSetup, resolvedName } from '../_lib/craft'
import {
  arr,
  applyTextTransform,
  num,
  pdfBorderStyle,
  pdfBox,
  pdfContentWidth,
  pdfText,
  readStyle,
  str,
  type BlockStyleProps,
} from '../_lib/style'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PT = 0.75

function childrenOf(json: CraftJson, id: string): string[] {
  return json[id]?.nodes ?? []
}

function linkedOf(json: CraftJson, id: string, key: string): string {
  return json[id]?.linkedNodes?.[key] ?? ''
}

/** `left` → flex-start, `center` → center, `right` → flex-end. */
type PdfAlign = 'flex-start' | 'center' | 'flex-end'

function alignItems(align: string): PdfAlign {
  return align === 'center'
    ? 'center'
    : align === 'right'
      ? 'flex-end'
      : 'flex-start'
}

/** Mirrors the CSS `justify-content` values used inside boxes. */
function justifyContent(align: string): PdfAlign {
  return alignItems(align)
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function StudioPdfDocument({
  json,
  title,
  qrCodes = {},
  filename,
}: {
  json: CraftJson
  title: string
  /** value -> data-url, pre-generated on the client. */
  qrCodes?: Record<string, string>
  filename?: string
}) {
  const setup: PageSetup = readPageSetup(json)
  const size = resolvePageSize(setup)
  const rootId = getRootNodeId(json)

  const styles = StyleSheet.create({
    page: {
      paddingTop: num(setup.marginTop) * PT,
      paddingRight: num(setup.marginRight) * PT,
      paddingBottom: num(setup.marginBottom) * PT,
      paddingLeft: num(setup.marginLeft) * PT,
      backgroundColor: str(setup.backgroundColor, '#ffffff') || '#ffffff',
      fontSize: 10.5,
      color: '#18181b',
      lineHeight: 1.5,
    },
    footer: {
      position: 'absolute',
      bottom: Math.max(10, num(setup.marginBottom) * 0.35),
      left: 0,
      right: 0,
      textAlign: 'center',
      fontSize: 8,
      color: '#a1a1aa',
    },
  })

  function renderNode(
    id: string,
    keyPrefix: string
  ): React.ReactNode {
    const node: CraftNode | undefined = json[id]
    if (!node || node.hidden) return null

    const name = resolvedName(node)
    if (!name) return null

    const key = `${keyPrefix}-${id}`
    const props = (node.props ?? {}) as Record<string, unknown>
    const s: BlockStyleProps = readStyle(props)

    /* ---------- container / column wrappers are transparent ---------- */
    if (node.isCanvas && name === 'div') {
      return (
        <View key={key}>{childrenOf(json, id).map((c) => renderNode(c, key))}</View>
      )
    }

    /* ---------- spacer ---------- */
    if (name === 'SpacerBlock') {
      return (
        <View
          key={key}
          style={{
            ...pdfBox({
              ...s,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
            }),
            height: Math.max(1, num(props.height, 32)) * PT,
          }}
        />
      )
    }

    /* ---------- page break ---------- */
    if (name === 'PageBreakBlock') {
      return <View key={key} break />
    }

    /* ---------- divider ---------- */
    if (name === 'DividerBlock') {
      return (
        <View
          key={key}
          style={{
            ...pdfBox(s),
            alignItems: alignItems(str(props.align, 'left')),
          }}
        >
          <View
            style={{
              borderTopWidth: Math.max(0.5, num(props.thickness, 1)) * PT,
              borderTopStyle: (str(props.dash, 'none') === 'none'
                ? 'solid'
                : (str(props.dash) as 'solid' | 'dashed' | 'dotted')),
              borderTopColor: str(props.lineColor, '#d4d4d8'),
              width: `${Math.min(100, Math.max(5, num(props.length, 100)))}%`,
            }}
          />
        </View>
      )
    }

    /* ---------- image ---------- */
    if (name === 'ImageBlock') {
      const src = str(props.src)
      const width = num(props.width) || 240
      const height = num(props.height, 180)
      return (
        <View key={key} style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'center')) }}>
          {src ? (
            <Image
              src={src}
              style={{
                width: width * PT,
                ...(str(props.objectFit, 'contain') === 'contain'
                  ? {}
                  : { height: height * PT }),
                borderRadius: num(props.borderRadius) * PT,
                objectFit: (str(props.objectFit, 'contain') as
                  | 'contain'
                  | 'cover'
                  | 'fill'
                  | 'none') ?? 'contain',
              }}
            />
          ) : null}
        </View>
      )
    }

    /* ---------- qr ---------- */
    if (name === 'QrBlock') {
      const value = str(props.value)
      const dataUrl = qrCodes[value]
      const qrSize = Math.max(24, num(props.size, 120))
      return (
        <View key={key} style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'center')) }}>
          {dataUrl ? (
            <Image
              src={dataUrl}
              style={{ width: qrSize * PT, height: qrSize * PT }}
            />
          ) : null}
        </View>
      )
    }

    /* ---------- table ---------- */
    if (name === 'TableBlock') {
      return <PdfTable key={key} style={s} props={props} />
    }

    /* ---------- columns ---------- */
    if (name === 'TwoColumnBlock') {
      const count = Math.max(1, Math.min(4, Math.round(num(props.count, 2))))
      const custom = arr<number>(props.widths)
      const widths = Array.from({ length: count }, (_, i) => {
        const w = Number(custom[i])
        return w > 0 ? w : 100 / count
      })
      return (
        <View key={key} style={{ ...pdfBox(s) }}>
          <View style={{ flexDirection: 'row', gap: num(props.gap, 20) * PT }}>
            {widths.map((w, i) => (
              <View
                key={i}
                style={{ width: `${w}%`, minHeight: num(props.minHeight, 60) * PT }}
              >
                {childrenOf(json, linkedOf(json, id, `col-${i}`)).map((c) =>
                  renderNode(c, `${key}-c${i}`)
                )}
              </View>
            ))}
          </View>
        </View>
      )
    }

    /* ---------- signature ---------- */
    if (name === 'SignatureBlock') {
      const lineWidth = Math.min(num(props.lineWidth, 200) * PT, 300)
      const detail = (
        <View style={{ width: lineWidth, paddingTop: 4 }}>
          <View
            style={{
              borderBottomWidth: 0.75,
              borderBottomColor: str(props.lineColor, '#71717a'),
              marginBottom: 5,
            }}
          />
          <Text style={{ fontSize: 10.5, fontWeight: 'bold' }}>
            {str(props.name, 'Authorised signatory')}
          </Text>
          {str(props.role) ? (
            <Text style={{ fontSize: 9, color: '#71717a', marginTop: 1 }}>
              {str(props.role)}
            </Text>
          ) : null}
          {str(props.date) ? (
            <Text style={{ fontSize: 8, color: '#a1a1aa', marginTop: 1 }}>
              {str(props.date)}
            </Text>
          ) : null}
        </View>
      )

      return (
        <View
          key={key}
          style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'left')) }}
        >
          <View>
            {str(props.imageUrl) ? (
              <Image
                src={str(props.imageUrl)}
                style={{
                  width: 110,
                  height: 38,
                  objectFit: 'contain',
                  marginBottom: 3,
                }}
              />
            ) : null}
            {str(props.layout, 'below') === 'above' ? detail : null}
          </View>
          {str(props.layout, 'below') === 'below' ? (
            <View>{detail}</View>
          ) : null}
        </View>
      )
    }

    /* ---------- box ---------- */
    if (name === 'BoxBlock') {
      const shape = str(props.shape, 'rect')
      const height = num(props.height)
      const minHeight = num(props.minHeight, 40)
      const isCircle = shape === 'circle'
      const side = isCircle ? (height || minHeight) * PT : undefined
      const radius =
        shape === 'circle'
          ? Math.round(side ?? 0)
          : shape === 'pill'
            ? 999
            : shape === 'bar'
              ? Math.max(0, ((height || 8) / 2) * PT)
              : num(props.borderRadius) * PT

      const text = str(props.text)

      return (
        <View key={key} style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'left')) }}>
          <View
            style={{
              width: side ?? pdfContentWidth(s, false),
              height: side ?? (height ? height * PT : undefined),
              minHeight: isCircle
                ? undefined
                : height
                  ? undefined
                  : minHeight * PT,
              backgroundColor:
                str(s.backgroundColor) === 'transparent'
                  ? '#eef2ff'
                  : s.backgroundColor,
              borderRadius: radius,
              borderWidth: num(s.borderWidth) * PT,
              borderStyle: pdfBorderStyle(s.borderStyle),
              borderColor: s.borderColor,
              padding: text ? num(props.textPadding, 12) * PT : 0,
              display: 'flex',
              justifyContent: justifyContent(str(props.textAlign, 'center')),
            }}
          >
            {text ? (
              <Text
                style={{
                  fontSize: num(props.textSize, 14) * PT,
                  color: str(props.textColor, '#18181b'),
                  textAlign: str(props.textAlign, 'center') as
                    | 'left'
                    | 'center'
                    | 'right',
                }}
              >
                {text}
              </Text>
            ) : null}
          </View>
        </View>
      )
    }

    /* ---------- button ---------- */
    if (name === 'ButtonBlock') {
      const variant = str(props.variant, 'solid')
      return (
        <View key={key} style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'left')) }}>
          <View
            style={{
              backgroundColor:
                variant === 'solid'
                  ? str(s.backgroundColor) === 'transparent'
                    ? '#4f46e5'
                    : s.backgroundColor
                  : 'transparent',
              borderRadius: num(s.borderRadius) * PT,
              borderWidth: variant === 'outline' ? Math.max(0.5, num(s.borderWidth, 1) * PT) : 0,
              borderStyle: 'solid',
              borderColor: str(props.borderColor, '#4f46e5'),
              paddingTop: num(props.padY, 10) * PT,
              paddingBottom: num(props.padY, 10) * PT,
              paddingLeft: num(props.padX, 18) * PT,
              paddingRight: num(props.padX, 18) * PT,
            }}
          >
            <Text
              style={pdfText(s, {
                color: variant === 'solid' ? '#ffffff' : s.color,
                textAlign: 'center',
              })}
            >
              {applyTextTransform(str(props.text, 'Click me'), s.textTransform)}
            </Text>
          </View>
          {str(props.href) && str(props.href) !== '#' ? (
            <Text style={{ fontSize: 7.5, color: '#a1a1aa', marginTop: 2 }}>
              {str(props.href)}
            </Text>
          ) : null}
        </View>
      )
    }

    /* ---------- heading / text / list share the same shell ---------- */
    const fill = name === 'TextBlock' || name === 'HeadingBlock' || name === 'ListBlock'

    let content: React.ReactNode = null

    if (name === 'HeadingBlock') {
      const level = Number(props.level ?? 1)
      const presetSize = { 1: 32, 2: 25, 3: 20, 4: 17 }[level] ?? 32
      content = (
        <Text
          style={pdfText(
            { ...s, fontSize: num(s.fontSize, presetSize) },
            { fontWeight: num(s.fontWeight, 400) >= 600 ? s.fontWeight : 'bold' }
          )}
        >
          {applyTextTransform(str(props.text, 'Heading'), s.textTransform)}
        </Text>
      )
    } else if (name === 'TextBlock') {
      content = (
        <Text style={pdfText(s)}>
          {applyTextTransform(str(props.text), s.textTransform)}
        </Text>
      )
    } else if (name === 'ListBlock') {
      const items = arr<string>(props.items)
      const ordered = props.ordered === true
      content = (
        <View style={{ gap: num(props.itemGap, 4) * PT }}>
          {items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              <Text
                style={pdfText(s, {
                  width: num(props.indent, 24) * PT,
                  color: s.color,
                })}
              >
                {ordered ? `${i + 1}.` : '•'}
              </Text>
              <Text style={{ ...pdfText(s), flex: 1 }}>
                {applyTextTransform(item, s.textTransform)}
              </Text>
            </View>
          ))}
        </View>
      )
    } else {
      // Unknown block: still lay it out as a styled container.
      content = null
    }

    return (
      <View
        key={key}
        style={{ ...pdfBox(s), alignItems: alignItems(str(props.align, 'left')) }}
      >
        <View style={{ width: pdfContentWidth(s, fill) }}>{content}</View>
      </View>
    )
  }

  const rootChildren = childrenOf(json, rootId)

  return (
    <Document
      title={title}
      author="InternBird"
      creator="InternBird Document Studio"
      producer="InternBird Document Studio"
      keywords={filename ? filename.replace(/\.pdf$/i, '') : undefined}
    >
      <Page size={[size.widthPt, size.heightPt]} style={styles.page} wrap>
        {rootChildren.map((id) => renderNode(id, 'root'))}
        {setup.pageNumbers ? (
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        ) : null}
      </Page>
    </Document>
  )
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                      */
/* -------------------------------------------------------------------------- */

function PdfTable({
  style,
  props,
}: {
  style: BlockStyleProps
  props: Record<string, unknown>
}) {
  const headers = arr<string>(props.headers)
  const rows = arr<string[]>(props.rows)
  const hasHeader = props.hasHeader !== false
  const striped = props.striped === true
  const colCount = headers.length || 1
  const custom = arr<number>(props.columnWidths)
  const widthAt = (i: number) =>
    Number(custom[i]) > 0 ? Number(custom[i]) : 100 / colCount

  const borderWidth = Math.max(0.5, num(props.borderWidth, 1) * PT)
  const borderColor = str(props.borderColor, '#d4d4d8')
  const pad = num(props.cellPadding, 8) * PT

  const cellBase = {
    borderWidth,
    borderColor,
    borderStyle: 'solid' as const,
    padding: pad,
    fontSize: num(style.fontSize, 13) * PT,
    lineHeight: 1.45,
  }

  return (
    <View style={{ ...pdfBox(style), alignItems: alignItems(str(props.align, 'left')) }}>
      <View style={{ width: pdfContentWidth(style, true) }}>
        {hasHeader ? (
          <View style={{ flexDirection: 'row' }}>
            {headers.map((h, i) => (
              <Text
                key={i}
                style={{
                  ...cellBase,
                  width: `${widthAt(i)}%`,
                  backgroundColor: str(props.headerBg, '#f4f4f5'),
                  color: str(props.headerColor, '#18181b'),
                  fontWeight: 'bold',
                }}
              >
                {h}
              </Text>
            ))}
          </View>
        ) : null}

        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {(row.length ? row : new Array(colCount).fill('')).map((cell, ci) => (
              <Text
                key={ci}
                style={{
                  ...cellBase,
                  width: `${widthAt(ci)}%`,
                  color: str(props.cellColor, '#18181b'),
                  backgroundColor: striped && ri % 2 === 1 ? '#fafafa' : undefined,
                }}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}
