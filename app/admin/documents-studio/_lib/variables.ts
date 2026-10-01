import {
  resolvePageSize,
  type CraftJson,
  type CraftNode,
  type GeneratedFile,
  type PageSetup,
} from '../constants'
import { getRootNodeId, resolvedName } from './craft'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type VariableType = 'text' | 'number' | 'date' | 'image'

export type DocumentVariable = {
  /** Identifier used inside `{{key}}` placeholders. */
  key: string
  /** Human-friendly label shown in the panels. */
  label: string
  type: VariableType
  defaultValue?: string
  description?: string
}

export type { GeneratedFile }

export const EMPTY_VARIABLES: DocumentVariable[] = []

/* -------------------------------------------------------------------------- */
/*  Placeholder syntax                                                         */
/* -------------------------------------------------------------------------- */

/** Matches `{{ key }}` with optional padding. */
export const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>()
  if (!text) return []

  VARIABLE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VARIABLE_RE.exec(text)) !== null) {
    keys.add(match[1])
  }
  return [...keys]
}

/** Every distinct placeholder key used anywhere in the document. */
export function collectUsedVariableKeys(json: CraftJson): string[] {
  const keys = new Set<string>()

  const scan = (text: unknown) => {
    if (typeof text !== 'string') return
    for (const key of extractVariableKeys(text)) keys.add(key)
  }

  for (const node of Object.values(json)) {
    if (!node || !node.props) continue
    for (const value of Object.values(node.props)) {
      if (typeof value === 'string') scan(value)
      else if (Array.isArray(value)) value.forEach(scan)
    }
  }

  return [...keys]
}

/**
 * Replace `{{key}}` with values. Unknown keys keep their placeholder so the
 * gap is obvious on the generated PDF instead of silently printing nothing.
 */
export function replaceVariables(
  text: string,
  values: Record<string, string>
): string {
  if (!text) return ''
  return text.replace(VARIABLE_RE, (match, key: string) => {
    const value = values[key]
    return value === undefined || value === null || value === ''
      ? match
      : value
  })
}

/** True when the text still contains at least one unresolved placeholder. */
export function hasUnresolved(text: string): boolean {
  VARIABLE_RE.lastIndex = 0
  return VARIABLE_RE.test(text)
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function slugifyVariableKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export function isValidVariableKey(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
}

/* -------------------------------------------------------------------------- */
/*  Storage — variables live on the root node's props alongside the page setup  */
/* -------------------------------------------------------------------------- */

export function readVariables(json: CraftJson): DocumentVariable[] {
  const root: CraftNode | undefined = json[getRootNodeId(json)]
  const raw = root?.props?.variables
  return Array.isArray(raw) ? (raw as DocumentVariable[]) : EMPTY_VARIABLES
}

/** Default value map, used when generating without explicit values. */
export function variableDefaults(
  variables: DocumentVariable[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of variables) out[v.key] = v.defaultValue ?? ''
  return out
}

/* -------------------------------------------------------------------------- */
/*  Highlighting                                                               */
/* -------------------------------------------------------------------------- */

export type TextSegment = {
  text: string
  /** The placeholder key when this segment is a `{{token}}`. */
  token?: string
}

export function splitPlaceholders(text: string): TextSegment[] {
  if (!text) return []
  if (!text.includes('{{')) return [{ text }]

  const out: TextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  VARIABLE_RE.lastIndex = 0
  while ((match = VARIABLE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push({ text: text.slice(lastIndex, match.index) })
    }
    out.push({ text: match[0], token: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    out.push({ text: text.slice(lastIndex) })
  }

  return out
}

/* -------------------------------------------------------------------------- */
/*  CSV / TSV parsing for bulk runs                                            */
/* -------------------------------------------------------------------------- */

export type ParsedTable = {
  headers: string[]
  rows: string[][]
}

/**
 * Parse pasted CSV or TSV. Sniffs the delimiter from the header line so a
 * straight Excel / Google Sheets copy-paste works without configuration.
 */
export function parseDelimited(input: string): ParsedTable {
  const text = input.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!text.trim()) return { headers: [], rows: [] }

  const firstLine = text.split('\n')[0]
  const delimiter = detectDelimiter(firstLine)

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  record.push(field)
  records.push(record)

  const [headers = [], ...rows] = records
  const width = headers.length

  return {
    headers: headers.map((h) => h.trim()),
    // Drop rows that are entirely empty (a trailing blank line).
    rows: rows
      .filter((r) => r.some((cell) => cell.trim() !== ''))
      .map((r) => {
        const copy = [...r]
        while (copy.length < width) copy.push('')
        return copy.slice(0, width)
      }),
  }
}

function detectDelimiter(line: string): string {
  const candidates = ['\t', ',', ';', '|']
  let best = ','
  let bestCount = 0

  for (const candidate of candidates) {
    const count = countOutsideQuotes(line, candidate)
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return bestCount > 0 ? best : ','
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') i += 1
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      count += 1
    }
  }
  return count
}

/**
 * Map pasted headers onto variable keys.
 *
 * A header matches when it equals the variable key (case/format-insensitive)
 * or the variable label. Unmatched columns are still offered, so users can wire
 * them up manually.
 */
export function matchHeaders(
  headers: string[],
  variables: DocumentVariable[]
): Record<number, string> {
  const mapping: Record<number, string> = {}

  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase()
    if (!normalized) return

    const byKey = variables.find(
      (v) => v.key.toLowerCase() === normalized || slugifyVariableKey(v.key) === normalized
    )
    if (byKey) {
      mapping[index] = byKey.key
      return
    }

    const byLabel = variables.find(
      (v) => v.label.trim().toLowerCase() === normalized
    )
    if (byLabel) {
      mapping[index] = byLabel.key
      return
    }

    // Auto-create a key for unknown columns so the run still works.
    const key = slugifyVariableKey(header)
    if (isValidVariableKey(key)) mapping[index] = key
  })

  return mapping
}

/** Build the value map for one spreadsheet row. */
export function rowToValues(
  row: string[],
  mapping: Record<number, string>
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [index, key] of Object.entries(mapping)) {
    values[key] = row[Number(index)] ?? ''
  }
  return values
}

/**
 * Filename for one generated record. Uses `{{key}}` tokens in the template,
 * falling back to the document title.
 *
 * An empty result (no template, or every token left unresolved) still yields a
 * usable, position-unique name so nothing is lost in a batch.
 */
export function buildFileName(
  template: string,
  values: Record<string, string>,
  index: number,
  fallback: string
): string {
  const raw = template.trim() || fallback
  const replaced = replaceVariables(raw, values).trim()

  const slug =
    replaced
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `document-${index + 1}`

  return `${slug}.pdf`
}

/**
 * True when the template resolves to nothing distinct for a record — i.e. the
 * user has not set a usable file name pattern.
 */
export function isTemplateUnresolved(
  template: string,
  values: Record<string, string>
): boolean {
  const replaced = replaceVariables(template.trim(), values).trim()
  return replaced === '' || replaced === template.trim()
}

/* -------------------------------------------------------------------------- */
/*  Page metadata helper                                                       */
/* -------------------------------------------------------------------------- */

export function pageDimensions(setup: PageSetup) {
  return resolvePageSize(setup)
}

export { resolvedName }
