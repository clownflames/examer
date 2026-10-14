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
/*                                                                             */
/*  The parser itself moved to `lib/csv` so other admin surfaces (exam        */
/*  question import) can reuse it without importing documents-studio.          */
/*  Re-exported here to keep this module's public API unchanged.               */
/* -------------------------------------------------------------------------- */

import { parseDelimited } from '@/lib/csv'

export type { ParsedTable } from '@/lib/csv'
export { parseDelimited }

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
