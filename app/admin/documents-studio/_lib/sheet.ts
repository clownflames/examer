/**
 * Spreadsheet helpers for bulk generation.
 *
 * The bulk dialog works on plain text (CSV/TSV), so every accepted file format
 * is normalised to text first. That keeps the parse → map → generate pipeline
 * identical no matter where the data came from.
 */

/* -------------------------------------------------------------------------- */
/*  Sample template                                                            */
/* -------------------------------------------------------------------------- */

import type { DocumentVariable } from './variables'

function escapeCsv(value: string, delimiter = ','): string {
  if (value.includes(delimiter) || /["\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Build a ready-to-fill template: one header column per variable, plus two
 * example rows built from the default values.
 */
export function buildSampleSheet(
  variables: DocumentVariable[],
  { rows = 2, delimiter = ',' }: { rows?: number; delimiter?: string } = {}
): string {
  // Headers use the label when present (matchHeaders resolves labels too), so
  // the file stays readable for whoever fills it in.
  const headers = variables.map((v) => v.label.trim() || v.key)
  if (headers.length === 0) return ''

  const lines = [headers.map((h) => escapeCsv(h, delimiter)).join(delimiter)]

  for (let i = 0; i < rows; i += 1) {
    const cells = variables.map((v, index) => {
      const base = v.defaultValue ?? ''
      // Vary the example rows a little so they read as separate records.
      const value = base || `sample ${index + 1}.${i + 1}`
      return escapeCsv(value, delimiter)
    })
    lines.push(cells.join(delimiter))
  }

  return lines.join('\n')
}

export function sampleFileName(documentTitle: string): string {
  const slug =
    documentTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'document'
  return `${slug}-template.csv`
}

/* -------------------------------------------------------------------------- */
/*  File reading                                                               */
/* -------------------------------------------------------------------------- */

export const ACCEPTED_FILE_TYPES = [
  '.csv',
  '.tsv',
  '.txt',
  '.xlsx',
  '.xlsm',
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
].join(',')

export type ReadResult =
  | { ok: true; text: string; name: string; rowCount: number }
  | { ok: false; error: string }

/** Read a user-supplied spreadsheet and normalise it to delimited text. */
export async function readSpreadsheetFile(
  file: File
): Promise<ReadResult> {
  try {
    const name = file.name.toLowerCase()

    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
      const buffer = await file.arrayBuffer()
      const grid = await readXlsx(buffer)
      if (grid.length === 0) {
        return { ok: false, error: 'That workbook has no readable cells' }
      }
      // TSV keeps quoted/comma-containing cells intact through parseDelimited.
      return {
        ok: true,
        text: grid.map((row) => row.join('\t')).join('\n'),
        name: file.name,
        rowCount: Math.max(0, grid.length - 1),
      }
    }

    const text = await file.text()
    if (!text.trim()) {
      return { ok: false, error: 'That file is empty' }
    }
    return {
      ok: true,
      text,
      name: file.name,
      rowCount: countDataRows(text),
    }
  } catch (err) {
    console.error('[studio] could not read the file:', err)
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Could not read that file',
    }
  }
}

function countDataRows(text: string): number {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  return Math.max(0, lines.filter((l) => l.trim() !== '').length - 1)
}

/* -------------------------------------------------------------------------- */
/*  XLSX reading (no extra dependency — xlsx is a zip of XML)                 */
/* -------------------------------------------------------------------------- */

/** Excel column letters ("A", "AB") → zero-based index. */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0] ?? 'A'
  let index = 0
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return index - 1
}

function textOf(node: Element | null): string {
  if (!node) return ''
  // A <si>/<is> can hold several runs split by formatting.
  return Array.from(node.getElementsByTagName('t'))
    .map((t) => t.textContent ?? '')
    .join('')
}

async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const raw = unzipSync(new Uint8Array(buffer))

  // Some producers write Windows-style separators inside the archive; the OPC
  // spec requires forward slashes, so normalise to be safe.
  const files: Record<string, Uint8Array> = {}
  for (const [name, entry] of Object.entries(raw)) {
    files[name.replace(/\\/g, '/').replace(/^\.\//, '')] = entry
  }

  const readXml = (path: string): string | null => {
    const entry = files[path]
    if (!entry) return null
    return strFromU8(entry)
  }

  // 1. Shared strings
  const sharedStrings: string[] = []
  const sharedXml = readXml('xl/sharedStrings.xml')
  if (sharedXml) {
    const doc = new DOMParser().parseFromString(sharedXml, 'application/xml')
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      sharedStrings.push(textOf(si))
    }
  }

  // 2. First worksheet
  const sheetPath = findFirstSheetPath(files, readXml)
  const sheetXml = readXml(sheetPath)
  if (!sheetXml) {
    throw new Error('Could not find a worksheet inside that workbook')
  }

  const sheet = new DOMParser().parseFromString(sheetXml, 'application/xml')
  const grid: string[][] = []

  for (const rowNode of Array.from(sheet.getElementsByTagName('row'))) {
    const rowIndex = Number(rowNode.getAttribute('r') ?? '0') - 1
    if (Number.isNaN(rowIndex) || rowIndex < 0) continue

    const cells: string[] = []
    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const ref = cell.getAttribute('r') ?? ''
      const target = ref ? columnIndex(ref) : cells.length
      const type = cell.getAttribute('t')

      let value = ''
      if (type === 's') {
        const index = Number(cell.getElementsByTagName('v')[0]?.textContent)
        value = Number.isFinite(index) ? (sharedStrings[index] ?? '') : ''
      } else if (type === 'inlineStr') {
        value = textOf(cell.getElementsByTagName('is')[0] ?? null)
      } else {
        value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
      }

      // Pad so sparse rows keep their column alignment.
      while (cells.length < target) cells.push('')
      cells[target] = value
    }

    grid[rowIndex] = cells
  }

  // Drop leading/trailing empty rows and trailing empty cells.
  while (grid.length > 0 && grid[grid.length - 1].every((c) => !c.trim())) {
    grid.pop()
  }
  for (const row of grid) {
    while (row.length > 0 && row[row.length - 1] === '') row.pop()
  }

  return grid
}

/** Resolve the first sheet's part name, falling back to sheet1.xml. */
function findFirstSheetPath(
  files: Record<string, Uint8Array>,
  readXml: (path: string) => string | null
): string {
  const workbookXml = readXml('xl/workbook.xml')
  const relsXml = readXml('xl/_rels/workbook.xml.rels')

  if (workbookXml && relsXml) {
    const workbook = new DOMParser().parseFromString(
      workbookXml,
      'application/xml'
    )
    const firstSheet = workbook.getElementsByTagName('sheet')[0]
    const relId = firstSheet?.getAttribute('r:id')

    if (relId) {
      const rels = new DOMParser().parseFromString(relsXml, 'application/xml')
      for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
        if (rel.getAttribute('Id') !== relId) continue
        const target = rel.getAttribute('Target') ?? ''
        const path = target.startsWith('/')
          ? target.slice(1)
          : target.startsWith('xl/')
            ? target
            : `xl/${target.replace(/^\.\//, '')}`
        if (files[path]) return path
      }
    }
  }

  const numbered = Object.keys(files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort()

  return numbered[0] ?? 'xl/worksheets/sheet1.xml'
}

/* -------------------------------------------------------------------------- */
/*  Drag helpers                                                               */
/* -------------------------------------------------------------------------- */

export function isSpreadsheetFile(file: File): boolean {
  return /\.(csv|tsv|txt|xlsx|xlsm)$/i.test(file.name)
}
