'use client'

import * as React from 'react'

import { arr, num, styleDefaults, str } from '../../_lib/style'
import { BlockFrame } from './block-frame'
import { TemplatedText } from './templated-text'

export type TableBlockProps = Record<string, unknown> & {
  headers?: string[]
  rows?: string[][]
  hasHeader?: boolean
  /** Zebra-stripe the body rows. */
  striped?: boolean
  headerBg?: string
  headerColor?: string
  cellColor?: string
  borderColor?: string
  borderWidth?: number
  cellPadding?: number
  /** Per-column widths as percentages, e.g. [30, 40, 30]. */
  columnWidths?: number[]
}

export function TableBlock(props: TableBlockProps) {
  const headers = arr<string>(props.headers)
  const rows = arr<string[]>(props.rows)
  const hasHeader = props.hasHeader !== false
  const striped = props.striped === true

  const headerBg = str(props.headerBg, '#f4f4f5')
  const headerColor = str(props.headerColor, '#18181b')
  const cellColor = str(props.cellColor, '#18181b')
  const borderColor = str(props.borderColor, '#d4d4d8')
  const borderWidth = Math.max(1, num(props.borderWidth, 1))
  const cellPadding = num(props.cellPadding, 8)

  const colCount = headers.length || 1
  const widths = arr<number>(props.columnWidths)
  const widthAt = (i: number) =>
    Number(widths[i]) > 0 ? Number(widths[i]) : 100 / colCount

  const cellBase: React.CSSProperties = {
    border: `${borderWidth}px solid ${borderColor}`,
    padding: cellPadding,
    fontSize: 'inherit',
    fontWeight: 'inherit',
    color: cellColor,
    textAlign: 'inherit',
    lineHeight: 1.45,
    verticalAlign: 'top',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  }

  return (
    <BlockFrame
      label="Table"
      props={props}
      innerStyle={{ width: num(props.width) > 0 ? num(props.width) : '100%' }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        {hasHeader && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    ...cellBase,
                    width: `${widthAt(i)}%`,
                    backgroundColor: headerBg,
                    color: headerColor,
                    fontWeight: '700',
                    textAlign: 'left',
                  }}
                >
                  <TemplatedText text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {(row.length ? row : new Array(colCount).fill('')).map(
                (cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      ...cellBase,
                      width: `${widthAt(ci)}%`,
                      backgroundColor:
                        striped && ri % 2 === 1 ? '#fafafa' : 'transparent',
                    }}
                  >
                    <TemplatedText text={cell} />
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </BlockFrame>
  )
}

TableBlock.craft = {
  displayName: 'Table',
  props: styleDefaults({
    headers: ['Column 1', 'Column 2', 'Column 3'],
    rows: [
      ['Row 1, Col 1', 'Row 1, Col 2', 'Row 1, Col 3'],
      ['Row 2, Col 1', 'Row 2, Col 2', 'Row 2, Col 3'],
    ],
    hasHeader: true,
    striped: false,
    headerBg: '#f4f4f5',
    headerColor: '#18181b',
    cellColor: '#18181b',
    borderColor: '#d4d4d8',
    borderWidth: 1,
    cellPadding: 8,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 6,
  }),
}
