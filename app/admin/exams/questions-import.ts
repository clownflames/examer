/**
 * Bulk question import: spreadsheet shape, sample template, and row parsing.
 *
 * Everything here is pure and runs on the client. The server action re-validates
 * each row with the same `questionFormSchema`, so this module is a UX layer
 * (early feedback, precise row numbers) rather than the security boundary.
 */

import { toCsv } from '@/lib/csv'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  questionFormSchema,
  type QuestionInput,
  type QuestionType,
} from './questions-constants'

/** Hard ceiling on one import run. Keeps the transaction and payload sane. */
export const MAX_IMPORT_ROWS = 500

/** MCQ option columns in the template: Option A … Option F. */
export const MAX_TEMPLATE_OPTIONS = 6

/* -------------------------------------------------------------------------- */
/*  Column definition                                                          */
/* -------------------------------------------------------------------------- */

export type ImportColumnKey =
  | 'name'
  | 'type'
  | 'marks'
  | 'details'
  | 'defaultText'
  | `option${string}`
  | 'correct'

export type ImportColumn = {
  key: ImportColumnKey
  /** Header text written into the downloaded template. */
  label: string
  /** Normalised spellings a user might rename the column to. */
  aliases: string[]
  required?: boolean
  /** Shown in the in-dialog format hint. */
  hint?: string
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'name',
    label: 'Question',
    required: true,
    aliases: [
      'question',
      'questiontext',
      'questionname',
      'name',
      'title',
      'text',
      'prompt',
    ],
  },
  {
    key: 'type',
    label: 'Type',
    hint: `mcq | text | code | voice — leave blank to auto-detect`,
    aliases: ['type', 'questiontype', 'kind', 'category'],
  },
  {
    key: 'marks',
    label: 'Marks',
    hint: 'Defaults to 1',
    aliases: ['marks', 'mark', 'points', 'score', 'weight'],
  },
  {
    key: 'details',
    label: 'Details',
    hint: 'Optional instructions shown under the question',
    aliases: ['details', 'detail', 'description', 'instructions', 'instruction', 'hint', 'note', 'notes'],
  },
  {
    key: 'defaultText',
    label: 'Default Answer',
    hint: 'Sample answer (text) or starter code (code)',
    aliases: [
      'defaultanswer',
      'defaulttext',
      'answer',
      'sampleanswer',
      'modelanswer',
      'startercode',
      'code',
      'solution',
    ],
  },
  ...OPTION_LABELS.map<ImportColumn>((letter) => ({
    key: `option${letter}` as ImportColumnKey,
    label: `Option ${letter}`,
    hint: letter === 'A' ? 'Leave blank if the question is not an MCQ' : undefined,
    aliases: [
      `option${letter.toLowerCase()}`,
      `opt${letter.toLowerCase()}`,
      `choice${letter.toLowerCase()}`,
      `option${letter.toLowerCase()}text`,
    ],
  })),
  {
    key: 'correct',
    label: 'Correct Answer',
    hint: 'A, B … or A,C — or the exact option text',
    aliases: [
      'correctanswer',
      'correct',
      'answerkey',
      'key',
      'rightanswer',
      'correctoption',
      'isright',
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  Sample template                                                            */
/* -------------------------------------------------------------------------- */

const SAMPLE_ROWS: string[][] = [
  [
    'Which keyword declares a block-scoped variable in JavaScript?',
    'mcq',
    '2',
    'Pick the one option.',
    '',
    'let',
    'var',
    'const',
    'let and var',
    '',
    '',
    'A',
  ],
  [
    'Explain the difference between let, var and const.',
    'text',
    '5',
    '',
    'A sample model answer is provided to help grading.',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
]

export function buildQuestionSampleCsv(): string {
  return toCsv(
    IMPORT_COLUMNS.map((c) => c.label),
    SAMPLE_ROWS
  )
}

export function questionTemplateFileName(examName: string): string {
  const slug =
    examName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'exam'
  return `${slug}-questions-template.csv`
}

/* -------------------------------------------------------------------------- */
/*  Header mapping                                                             */
/* -------------------------------------------------------------------------- */

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Map spreadsheet headers onto column keys.
 *
 * Order matters: the first header that resolves to a given column wins, so a
 * file with both `Question` and `Question Text` keeps the earlier one.
 */
export function mapImportHeaders(headers: string[]): Record<number, ImportColumnKey> {
  const mapping: Record<number, ImportColumnKey> = {}
  const taken = new Set<ImportColumnKey>()

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (!normalized) return

    // "Option A" / "Option A (text)" / "opt a"
    const optionLetter = /^opt(?:ion|choice)?([a-f])$/.exec(normalized)
    if (optionLetter) {
      const key = `option${optionLetter[1].toUpperCase()}` as ImportColumnKey
      if (!taken.has(key)) {
        taken.add(key)
        mapping[index] = key
      }
      return
    }

    for (const column of IMPORT_COLUMNS) {
      if (taken.has(column.key)) continue
      if (column.aliases.includes(normalized)) {
        taken.add(column.key)
        mapping[index] = column.key
        return
      }
    }
  })

  return mapping
}

/* -------------------------------------------------------------------------- */
/*  Cell coercion                                                              */
/* -------------------------------------------------------------------------- */

const TYPE_ALIASES: Record<string, QuestionType> = {
  mcq: 'mcq',
  multiplechoice: 'mcq',
  multi: 'mcq',
  objective: 'mcq',
  choice: 'mcq',
  text: 'text',
  textanswer: 'text',
  written: 'text',
  shortanswer: 'text',
  longanswer: 'text',
  descriptive: 'text',
  theory: 'text',
  subject: 'text',
  code: 'code',
  coding: 'code',
  programming: 'code',
  snippet: 'code',
  voice: 'voice',
  audio: 'voice',
  viva: 'voice',
  oral: 'voice',
}

export function parseQuestionType(value: string): QuestionType | null {
  const normalized = normalizeHeader(value)
  if (!normalized) return null
  return TYPE_ALIASES[normalized] ?? null
}

function parseMarks(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

/**
 * Resolve the "Correct Answer" cell into zero-based option indexes.
 *
 * Accepts letters (`B`), numbers (`2`), and lists of either (`A, C` / `a|c`).
 * When nothing matches positionally it falls back to matching the option text
 * itself, so `Correct Answer = Delhi` works too.
 */
export function parseCorrectIndexes(
  value: string,
  optionTexts: string[]
): number[] | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const tokens = trimmed
    .split(/[,;|/&\n]+|\s+and\s+/i)
    .map((t) => t.trim())
    .filter(Boolean)

  if (tokens.length === 0) return null

  const indexes = new Set<number>()

  for (const token of tokens) {
    const letter = /^[a-f]$/i.exec(token)
    if (letter) {
      indexes.add(letter[0].toUpperCase().charCodeAt(0) - 65)
      continue
    }
    const numeric = /^\d+$/.test(token) ? Number(token) : null
    if (numeric !== null && numeric >= 1 && numeric <= optionTexts.length) {
      indexes.add(numeric - 1)
      continue
    }
    // Fall back to an exact (case-insensitive) option-text match.
    const byText = optionTexts.findIndex(
      (text) => text.trim().toLowerCase() === token.toLowerCase()
    )
    if (byText !== -1) indexes.add(byText)
  }

  const usable = [...indexes].filter((i) => i >= 0 && i < optionTexts.length)
  return usable.length > 0 ? usable : null
}

/* -------------------------------------------------------------------------- */
/*  Row parsing                                                                */
/* -------------------------------------------------------------------------- */

export type ImportPreview = {
  name: string
  type: QuestionType
  marks: number
  options: { labelText: string; isCorrect: boolean }[]
  /** Non-fatal notes, e.g. "Options ignored for a text question". */
  warnings: string[]
}

export type ParsedImportRow = {
  /** 1-based spreadsheet row number, header included. Shown in error toasts. */
  line: number
  /** `null` when the row failed validation and must not be sent to the server. */
  input: QuestionInput | null
  preview: ImportPreview
  error?: string
}

export type ParseResult = {
  rows: ParsedImportRow[]
  validCount: number
  invalidCount: number
  /** True when the file is missing the one column we cannot do without. */
  missingRequiredColumn: boolean
}

/**
 * Turn a parsed spreadsheet into validated `QuestionInput`s.
 *
 * Invalid rows are reported rather than dropped so the admin can fix the file
 * and re-upload; the import itself is expected to run with `validCount` rows.
 */
export function parseQuestionRows(
  headers: string[],
  dataRows: string[][]
): ParseResult {
  const mapping = mapImportHeaders(headers)
  const hasName = Object.values(mapping).includes('name')

  const cell = (row: string[], key: ImportColumnKey): string => {
    const index = Object.entries(mapping).find(([, value]) => value === key)?.[0]
    if (index === undefined) return ''
    return (row[Number(index)] ?? '').trim()
  }

  const rows: ParsedImportRow[] = []

  for (let i = 0; i < dataRows.length; i += 1) {
    const line = i + 2 // header occupies row 1
    const source = dataRows[i]

    const warnings: string[] = []

    const name = cell(source, 'name')
    const rawType = cell(source, 'type')
    const rawMarks = cell(source, 'marks')

    const optionTexts = OPTION_LABELS.map((letter) =>
      cell(source, `option${letter}`)
    ).filter((text) => text !== '')

    // Type: explicit value wins, otherwise infer from the presence of options.
    let type: QuestionType
    if (rawType) {
      const parsedType = parseQuestionType(rawType)
      if (!parsedType) {
        rows.push({
          line,
          input: null,
          error: `"${rawType}" is not a valid type. Use ${QUESTION_TYPES.join(', ')}.`,
          preview: {
            name,
            type: 'text',
            marks: 1,
            options: [],
            warnings,
          },
        })
        continue
      }
      type = parsedType
    } else {
      type = optionTexts.length > 0 ? 'mcq' : 'text'
    }

    let marks = 1
    if (rawMarks) {
      const parsedMarks = parseMarks(rawMarks)
      if (parsedMarks === null || parsedMarks <= 0) {
        rows.push({
          line,
          input: null,
          error: `"${rawMarks}" is not a valid marks value. Use a whole number above 0.`,
          preview: { name, type, marks: 1, options: [], warnings },
        })
        continue
      }
      marks = parsedMarks
    }

    // Build options with the correct-answer cell resolved against them.
    let options: { labelText: string; isCorrect: boolean }[] = []
    const rawCorrect = cell(source, 'correct')

    if (type === 'mcq') {
      // Preserve column order (A, B, C …) even when an earlier one is blank.
      const ordered = OPTION_LABELS.map((letter) =>
        cell(source, `option${letter}`).trim()
      ).filter((text) => text !== '')

      const correctIndexes = rawCorrect
        ? parseCorrectIndexes(rawCorrect, ordered)
        : null

      if (rawCorrect && correctIndexes === null) {
        rows.push({
          line,
          input: null,
          error: `"${rawCorrect}" does not match any option. Use A-F, 1-6, or the exact option text.`,
          preview: { name, type, marks, options: [], warnings },
        })
        continue
      }

      options = ordered.map((labelText, index) => ({
        labelText,
        isCorrect: correctIndexes?.includes(index) ?? false,
      }))

      if (ordered.length === 0) {
        warnings.push('No options filled in')
      }
    } else if (rawCorrect) {
      warnings.push('Correct Answer ignored — the question is not an MCQ')
    } else if (OPTION_LABELS.some((letter) => cell(source, `option${letter}`))) {
      warnings.push(`Options ignored — the question is not an MCQ`)
    }

    const input: QuestionInput = {
      name,
      type,
      marks,
      details: cell(source, 'details') || null,
      defaultText: cell(source, 'defaultText') || null,
      options: type === 'mcq' ? options : undefined,
    }

    const parsed = questionFormSchema.safeParse(input)
    if (!parsed.success) {
      rows.push({
        line,
        input: null,
        error: parsed.error.issues[0]?.message ?? 'Invalid question.',
        preview: { name, type, marks, options, warnings },
      })
      continue
    }

    rows.push({
      line,
      input: parsed.data,
      preview: { name, type, marks, options, warnings },
    })
  }

  return {
    rows,
    validCount: rows.filter((r) => !r.error).length,
    invalidCount: rows.filter((r) => r.error).length,
    missingRequiredColumn: !hasName,
  }
}

/** Rows ready to be sent to the server action. */
export function collectValidInputs(rows: ParsedImportRow[]): QuestionInput[] {
  return rows
    .map((row) => row.input)
    .filter((input): input is QuestionInput => input !== null)
}

export { QUESTION_TYPE_LABELS }