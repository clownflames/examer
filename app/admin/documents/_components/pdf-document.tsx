'use client'

import * as React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import QRCode from 'qrcode'

import {
  ratioToFractions,
  replaceVariables,
  type DocumentContent,
  type DocumentBlock,
} from '../constants'

/* -------------------------------------------------------------------------- */
/*  HTML → segments                                                            */
/* -------------------------------------------------------------------------- */

type TextSegment = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  link?: string
}

function parseInlineHtml(html: string): TextSegment[] {
  const segments: TextSegment[] = []

  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const tokenRe = /<(\/?)(\w+)([^>]*)>|([^<]+)/g
  let match: RegExpExecArray | null

  const stack: { tag: string; attrs: string }[] = []

  function flags() {
    let bold = false
    let italic = false
    let underline = false
    for (const s of stack) {
      const t = s.tag.toLowerCase()
      if (t === 'b' || t === 'strong') bold = true
      if (t === 'i' || t === 'em') italic = true
      if (t === 'u') underline = true
    }
    return { bold, italic, underline }
  }

  function currentLink(): string | undefined {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag.toLowerCase() === 'a') {
        const m = stack[i].attrs.match(/href\s*=\s*["']([^"']+)["']/i)
        if (m) return m[1]
      }
    }
    return undefined
  }

  while ((match = tokenRe.exec(normalized)) !== null) {
    const [, closing, tag, attrs, text] = match

    if (tag) {
      if (closing) {
        const idx = [...stack]
          .map((s) => s.tag.toLowerCase())
          .lastIndexOf(tag.toLowerCase())
        if (idx >= 0) stack.splice(idx, 1)
      } else if (
        ['b', 'strong', 'i', 'em', 'u', 'a'].includes(tag.toLowerCase())
      ) {
        stack.push({ tag, attrs })
      }
      continue
    }

    if (text) {
      const f = flags()
      segments.push({ text, ...f, link: currentLink() })
    }
  }

  if (segments.length === 0 && html.trim()) {
    segments.push({ text: html })
  }

  return segments
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function PdfDocument({
  content,
  title,
  variableValues = {},
}: {
  content: DocumentContent
  title?: string
  variableValues?: Record<string, string>
}) {
  const { theme, blocks } = content

  /** Shortcut for variable replacement. */
  const rv = React.useCallback(
    (s: string | undefined): string => {
      if (!s) return ''
      return replaceVariables(s, variableValues)
    },
    [variableValues]
  )

  const [qrCache, setQrCache] = React.useState<Record<string, string>>({})

  const qrValues = blocks
    .filter(
      (b): b is Extract<DocumentBlock, { type: 'qrcode' }> =>
        b.type === 'qrcode'
    )
    .map((b) => rv(b.value))

  React.useEffect(() => {
    let cancelled = false

    async function generateAll() {
      const next: Record<string, string> = {}
      for (const value of qrValues) {
        if (qrCache[value]) {
          next[value] = qrCache[value]
          continue
        }
        if (!value) continue
        try {
          const dataUrl = await QRCode.toDataURL(value, {
            width: 300,
            margin: 1,
            errorCorrectionLevel: 'M',
          })
          next[value] = dataUrl
        } catch (err) {
          console.error('QR generation failed:', err)
        }
      }
      if (!cancelled) setQrCache((prev) => ({ ...prev, ...next }))
    }

    void generateAll()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrValues.join('|')])

  const styles = StyleSheet.create({
    page: {
      paddingTop: theme.marginTop,
      paddingBottom: theme.marginBottom,
      paddingLeft: theme.marginLeft,
      paddingRight: theme.marginRight,
      fontFamily: theme.fontFamily,
      fontSize: theme.baseFontSize,
      color: theme.baseColor,
      lineHeight: 1.5,
    },
    heading1: {
      fontSize: theme.baseFontSize * 2.2,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    heading2: {
      fontSize: theme.baseFontSize * 1.6,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    heading3: {
      fontSize: theme.baseFontSize * 1.3,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    paragraph: {
      fontSize: theme.baseFontSize,
      marginBottom: 8,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: '#d4d4d8',
      marginVertical: 12,
    },
    listItem: { flexDirection: 'row', marginBottom: 4 },
    listBullet: { width: 16 },
    listText: { flex: 1 },
    signatureBox: { marginTop: 8 },
    signatureLine: {
      borderTopWidth: 1,
      borderTopColor: '#71717a',
      width: 200,
      marginBottom: 4,
    },
    signatureImage: {
      width: 140,
      height: 50,
      objectFit: 'contain',
      marginBottom: 4,
    },
    table: { width: '100%', marginBottom: 10 },
    tableRow: { flexDirection: 'row' },
    tableHeaderCell: {
      padding: 6,
      borderWidth: 1,
      borderColor: '#d4d4d8',
      backgroundColor: '#f4f4f5',
      fontWeight: 'bold',
      fontSize: theme.baseFontSize - 1,
    },
    tableCell: {
      padding: 6,
      borderWidth: 1,
      borderColor: '#d4d4d8',
      fontSize: theme.baseFontSize - 1,
    },
    columnsRow: { flexDirection: 'row', marginBottom: 10 },
  })

  function renderInline(html: string, key: string) {
    const segments = parseInlineHtml(html)
    return (
      <Text key={key}>
        {segments.map((seg, i) => (
          <Text
            key={i}
            style={{
              fontWeight: seg.bold ? 'bold' : 'normal',
              fontStyle: seg.italic ? 'italic' : 'normal',
              textDecoration:
                seg.underline || seg.link ? 'underline' : 'none',
              color: seg.link ? '#2563eb' : undefined,
            }}
          >
            {seg.text}
          </Text>
        ))}
      </Text>
    )
  }

  const renderBlock = (block: DocumentBlock) => {
    switch (block.type) {
      case 'heading': {
        const style =
          block.level === 1
            ? styles.heading1
            : block.level === 2
            ? styles.heading2
            : styles.heading3
        return (
          <Text
            key={block.id}
            style={[
              style,
              {
                textAlign: block.align,
                color: block.color ?? theme.baseColor,
              },
            ]}
          >
            {rv(block.text)}
          </Text>
        )
      }

      case 'paragraph':
        return (
          <View
            key={block.id}
            style={[
              styles.paragraph,
              {
                textAlign: block.align,
                fontSize: block.fontSize ?? theme.baseFontSize,
                color: block.color ?? theme.baseColor,
              },
            ]}
          >
            {renderInline(rv(block.html), `${block.id}-inline`)}
          </View>
        )

      case 'image':
        if (!block.url) {
          return (
            <Text
              key={block.id}
              style={[
                styles.paragraph,
                { textAlign: 'center', color: '#a1a1aa' },
              ]}
            >
              [Empty image block]
            </Text>
          )
        }
        return (
          <View
            key={block.id}
            style={{
              alignItems:
                block.align === 'center'
                  ? 'center'
                  : block.align === 'right'
                  ? 'flex-end'
                  : 'flex-start',
              marginBottom: 10,
            }}
          >
            <Image
              src={block.url}
              style={{ width: block.width ?? 300, objectFit: 'contain' }}
            />
          </View>
        )

      case 'divider':
        return (
          <View
            key={block.id}
            style={[
              styles.divider,
              block.color ? { borderBottomColor: block.color } : {},
            ]}
          />
        )

      case 'spacer':
        return <View key={block.id} style={{ height: block.height }} />

      case 'list':
        return (
          <View key={block.id} style={{ marginBottom: 8 }}>
            {block.items.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listBullet}>
                  {block.ordered ? `${i + 1}.` : '•'}
                </Text>
                <Text style={styles.listText}>{rv(item)}</Text>
              </View>
            ))}
          </View>
        )

      case 'pageBreak':
        return <View key={block.id} break />

      case 'signature':
        return (
          <View
            key={block.id}
            style={[
              styles.signatureBox,
              {
                alignItems:
                  block.align === 'center'
                    ? 'center'
                    : block.align === 'right'
                    ? 'flex-end'
                    : 'flex-start',
              },
            ]}
          >
            {block.imageUrl && (
              <Image src={block.imageUrl} style={styles.signatureImage} />
            )}
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: theme.baseFontSize, fontWeight: 'bold' }}>
              {rv(block.name)}
            </Text>
            {block.role && (
              <Text
                style={{
                  fontSize: theme.baseFontSize - 1,
                  color: '#71717a',
                }}
              >
                {rv(block.role)}
              </Text>
            )}
            {block.date && (
              <Text
                style={{
                  fontSize: theme.baseFontSize - 2,
                  color: '#a1a1aa',
                  marginTop: 2,
                }}
              >
                {rv(block.date)}
              </Text>
            )}
          </View>
        )

      case 'qrcode': {
        const key = rv(block.value)
        const src = qrCache[key]
        if (!src) {
          return (
            <Text
              key={block.id}
              style={[
                styles.paragraph,
                { textAlign: 'center', color: '#a1a1aa' },
              ]}
            >
              [Generating QR…]
            </Text>
          )
        }
        return (
          <View
            key={block.id}
            style={{
              alignItems:
                block.align === 'center'
                  ? 'center'
                  : block.align === 'right'
                  ? 'flex-end'
                  : 'flex-start',
              marginBottom: 10,
            }}
          >
            <Image
              src={src}
              style={{ width: block.size, height: block.size }}
            />
          </View>
        )
      }

      case 'table': {
        const colCount = block.headers.length || 1
        const widths =
          block.columnWidths ?? Array(colCount).fill(100 / colCount)

        return (
          <View key={block.id} style={styles.table}>
            {block.hasHeader && (
              <View style={styles.tableRow}>
                {block.headers.map((h, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.tableHeaderCell,
                      { width: `${widths[i] ?? 100 / colCount}%` },
                    ]}
                  >
                    {rv(h)}
                  </Text>
                ))}
              </View>
            )}
            {block.rows.map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                {row.map((cell, ci) => (
                  <Text
                    key={ci}
                    style={[
                      styles.tableCell,
                      { width: `${widths[ci] ?? 100 / colCount}%` },
                    ]}
                  >
                    {rv(cell)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )
      }

      case 'columns': {
        const [lw, rw] = ratioToFractions(block.ratio)
        return (
          <View key={block.id} style={[styles.columnsRow, { gap: block.gap }]}>
            <View style={{ flex: lw }}>
              {renderInline(rv(block.left), `${block.id}-left`)}
            </View>
            <View style={{ flex: rw }}>
              {renderInline(rv(block.right), `${block.id}-right`)}
            </View>
          </View>
        )
      }
    }
  }

  return (
    <Document
      title={title ?? 'Document'}
      author="InternBird"
      creator="InternBird Document Builder"
    >
      <Page
        size={theme.pageSize}
        orientation={theme.orientation}
        style={styles.page}
        wrap
      >
        {blocks.map((b) => renderBlock(b))}
      </Page>
    </Document>
  )
}