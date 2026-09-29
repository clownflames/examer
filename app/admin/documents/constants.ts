export const PAGE_SIZE = 20

/* -------------------------------------------------------------------------- */
/*  Block types                                                                */
/* -------------------------------------------------------------------------- */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'divider'
  | 'spacer'
  | 'list'
  | 'pageBreak'
  | 'signature'
  | 'qrcode'
  | 'table'
  | 'columns'

export type Align = 'left' | 'center' | 'right'

/* -------------------- Heading -------------------- */

export type HeadingBlock = {
  id: string
  type: 'heading'
  text: string
  level: 1 | 2 | 3
  align: Align
  color?: string
}

/* -------------------- Paragraph (rich text) -------------------- */

export type ParagraphBlock = {
  id: string
  type: 'paragraph'
  /** HTML string with <b>, <i>, <u>, <a href="..."> etc. */
  html: string
  align: Align
  fontSize?: number
  color?: string
}

/* -------------------- Image -------------------- */

export type ImageBlock = {
  id: string
  type: 'image'
  url: string
  alt?: string
  width?: number
  align: Align
}

/* -------------------- Divider -------------------- */

export type DividerBlock = {
  id: string
  type: 'divider'
  color?: string
}

/* -------------------- Spacer -------------------- */

export type SpacerBlock = {
  id: string
  type: 'spacer'
  height: number
}

/* -------------------- List -------------------- */

export type ListBlock = {
  id: string
  type: 'list'
  items: string[]
  ordered: boolean
  fontSize?: number
}

/* -------------------- Page break -------------------- */

export type PageBreakBlock = {
  id: string
  type: 'pageBreak'
}

/* -------------------- Signature -------------------- */

export type SignatureBlock = {
  id: string
  type: 'signature'
  name: string
  role?: string
  imageUrl?: string
  date?: string
  align: Align
}

/* -------------------- QR code -------------------- */

export type QrCodeBlock = {
  id: string
  type: 'qrcode'
  value: string
  size: number
  align: Align
}

/* -------------------- Table -------------------- */

export type TableBlock = {
  id: string
  type: 'table'
  headers: string[]
  rows: string[][]
  /** Optional widths per column (e.g. [30, 40, 30] percentages). Falls back to equal. */
  columnWidths?: number[]
  hasHeader: boolean
  fontSize?: number
}

/* -------------------- Two-column -------------------- */

export type ColumnsBlock = {
  id: string
  type: 'columns'
  left: string
  right: string
  gap: number
  ratio: '50-50' | '60-40' | '40-60' | '70-30' | '30-70'
}

/* -------------------- Union -------------------- */

export type DocumentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | ListBlock
  | PageBreakBlock
  | SignatureBlock
  | QrCodeBlock
  | TableBlock
  | ColumnsBlock

/* -------------------------------------------------------------------------- */
/*  Theme                                                                      */
/* -------------------------------------------------------------------------- */

export type PageSize = 'A4' | 'LETTER'
export type Orientation = 'portrait' | 'landscape'

export type DocumentTheme = {
  pageSize: PageSize
  orientation: Orientation
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  fontFamily: 'Helvetica' | 'Times-Roman' | 'Courier'
  baseFontSize: number
  baseColor: string
}

export const DEFAULT_THEME: DocumentTheme = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: 48,
  marginBottom: 48,
  marginLeft: 48,
  marginRight: 48,
  fontFamily: 'Helvetica',
  baseFontSize: 11,
  baseColor: '#18181b',
}

/* -------------------------------------------------------------------------- */
/*  Document content                                                           */
/* -------------------------------------------------------------------------- */

export type DocumentContent = {
  theme: DocumentTheme
  blocks: DocumentBlock[]
  /** Variables defined for this document. Optional for backwards compat. */
  variables?: DocumentVariable[]
}

export const EMPTY_CONTENT: DocumentContent = {
  theme: DEFAULT_THEME,
  blocks: [],
  variables: [],
}

/* -------------------------------------------------------------------------- */
/*  Row / Detail                                                               */
/* -------------------------------------------------------------------------- */

export type DocumentRow = {
  id: string
  title: string
  description: string | null
  pdfUrl: string | null
  isTemplate: boolean
  createdAt: string
  updatedAt: string
}

export type DocumentDetail = DocumentRow & {
  content: DocumentContent
}

/* -------------------------------------------------------------------------- */
/*  Block catalog (for the "Add block" menu)                                   */
/* -------------------------------------------------------------------------- */

export const BLOCK_CATALOG: {
  type: BlockType
  label: string
  description: string
}[] = [
  {
    type: 'heading',
    label: 'Heading',
    description: 'Large title text',
  },
  {
    type: 'paragraph',
    label: 'Paragraph',
    description: 'Rich text with bold, italic, links',
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Image from media library',
  },
  {
    type: 'list',
    label: 'List',
    description: 'Bullet or numbered list',
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Rows and columns of data',
  },
  {
    type: 'columns',
    label: 'Two columns',
    description: 'Side-by-side content',
  },
  {
    type: 'qrcode',
    label: 'QR Code',
    description: 'Encode a URL or text as a QR',
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Horizontal line',
  },
  {
    type: 'spacer',
    label: 'Spacer',
    description: 'Empty vertical space',
  },
  {
    type: 'signature',
    label: 'Signature',
    description: 'Signature line with name',
  },
  {
    type: 'pageBreak',
    label: 'Page break',
    description: 'Start new page here',
  },
]

/* -------------------------------------------------------------------------- */
/*  Block factory                                                              */
/* -------------------------------------------------------------------------- */

export function createBlock(type: BlockType): DocumentBlock {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  switch (type) {
    case 'heading':
      return { id, type, text: 'Heading', level: 1, align: 'left' }

    case 'paragraph':
      return {
        id,
        type,
        html: 'Write something here…',
        align: 'left',
      }

    case 'image':
      return { id, type, url: '', align: 'center', width: 300 }

    case 'divider':
      return { id, type }

    case 'spacer':
      return { id, type, height: 24 }

    case 'list':
      return { id, type, items: ['First item'], ordered: false }

    case 'pageBreak':
      return { id, type }

    case 'signature':
      return {
        id,
        type,
        name: 'Name',
        role: '',
        align: 'left',
        date: new Date().toISOString().slice(0, 10),
      }

    case 'qrcode':
      return {
        id,
        type,
        value: 'https://internbird.sqrock.cloud',
        size: 120,
        align: 'center',
      }

    case 'table':
      return {
        id,
        type,
        hasHeader: true,
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          ['Row 1, Col 1', 'Row 1, Col 2', 'Row 1, Col 3'],
          ['Row 2, Col 1', 'Row 2, Col 2', 'Row 2, Col 3'],
        ],
        columnWidths: undefined,
        fontSize: undefined,
      }

    case 'columns':
      return {
        id,
        type,
        left: 'Left column content',
        right: 'Right column content',
        gap: 16,
        ratio: '50-50',
      }
  }
}

/* -------------------------------------------------------------------------- */
/*  Columns ratio helper                                                       */
/* -------------------------------------------------------------------------- */

export function ratioToFractions(
  ratio: ColumnsBlock['ratio']
): [number, number] {
  switch (ratio) {
    case '60-40':
      return [0.6, 0.4]
    case '40-60':
      return [0.4, 0.6]
    case '70-30':
      return [0.7, 0.3]
    case '30-70':
      return [0.3, 0.7]
    default:
      return [0.5, 0.5]
  }
}



/* -------------------------------------------------------------------------- */
/*  Variables                                                                  */
/* -------------------------------------------------------------------------- */

export type VariableType = 'text' | 'number' | 'date' | 'image'

export type DocumentVariable = {
  /** Identifier used in `{{key}}` placeholders. */
  key: string
  /** Human-friendly label shown in the variables panel + generate dialog. */
  label: string
  type: VariableType
  /** Optional default value. */
  defaultValue?: string
  /** Optional description shown as a hint in the generate dialog. */
  description?: string
}

/**
 * Add variables to the document content shape.
 * The variables array is stored alongside theme + blocks.
 */
export type DocumentContentWithVars = DocumentContent & {
  variables?: DocumentVariable[]
}

/* -------------------------------------------------------------------------- */
/*  Variable helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Regex that matches `{{ key }}` with optional surrounding spaces. */
export const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

/** Extract all unique variable keys used in a plain text / HTML string. */
export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>()
  let match: RegExpExecArray | null
  // reset lastIndex
  VARIABLE_RE.lastIndex = 0
  while ((match = VARIABLE_RE.exec(text)) !== null) {
    keys.add(match[1])
  }
  return [...keys]
}

/** Walk all text fields in all blocks and return unique variable keys. */
export function collectAllVariableKeys(content: DocumentContent): string[] {
  const keys = new Set<string>()

  for (const block of content.blocks) {
    const addFromString = (s: string | undefined) => {
      if (!s) return
      for (const k of extractVariableKeys(s)) keys.add(k)
    }

    switch (block.type) {
      case 'heading':
        addFromString(block.text)
        break
      case 'paragraph':
        addFromString(block.html)
        break
      case 'list':
        block.items.forEach(addFromString)
        break
      case 'signature':
        addFromString(block.name)
        addFromString(block.role)
        addFromString(block.date)
        break
      case 'qrcode':
        addFromString(block.value)
        break
      case 'table':
        block.headers.forEach(addFromString)
        block.rows.forEach((row) => row.forEach(addFromString))
        break
      case 'columns':
        addFromString(block.left)
        addFromString(block.right)
        break
      case 'image':
        addFromString(block.alt)
        break
      case 'divider':
      case 'spacer':
      case 'pageBreak':
        break
    }
  }

  return [...keys]
}

/** Slug-safe variable key from a label. */
export function slugifyVariableKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/** Replace `{{key}}` occurrences with values from a map. */
export function replaceVariables(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(VARIABLE_RE, (_match, key: string) => {
    const v = values[key]
    if (v === undefined || v === null) return `{{${key}}}`
    return v
  })
}