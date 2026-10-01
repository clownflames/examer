export const PAGE_SIZE = 20

/* -------------------------------------------------------------------------- */
/*  Units                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everything on the canvas is authored in CSS pixels (96 dpi).
 * PDF/PostScript points are 1/72", so 1px === 0.75pt.
 */
export const PX_TO_PT = 0.75
export const PT_TO_PX = 1 / PX_TO_PT

export function px2pt(px: number): number {
  return Math.round(px * PX_TO_PT * 100) / 100
}

export function pt2px(pt: number): number {
  return Math.round(pt * PT_TO_PX * 100) / 100
}

/* -------------------------------------------------------------------------- */
/*  Craft.js serialized state                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A single node inside a Craft.js document.
 *
 * NOTE: Craft.js serializes a **flat map** of `nodeId -> node` (ROOT is included
 * as a normal key). There is no `nodes` wrapper object — `nodes` on a node is an
 * array of child *ids*.
 *
 * `type` is either:
 *   - a plain string, for `Element is="div"` nodes (DOM elements), or
 *   - `{ resolvedName }`, for custom blocks (the key in the Editor `resolver`).
 */
export type CraftNode = {
  type: string | { resolvedName: string }
  isCanvas: boolean
  props: Record<string, unknown>
  displayName?: string
  custom?: Record<string, unknown>
  hidden?: boolean
  parent?: string | null
  nodes?: string[]
  linkedNodes?: Record<string, string>
}

export type CraftJson = Record<string, CraftNode>

export const ROOT_ID = 'ROOT'

/** Every component that may legally appear in a stored document. */
export const ALLOWED_COMPONENTS = new Set([
  'TextBlock',
  'HeadingBlock',
  'ListBlock',
  'ButtonBlock',
  'ImageBlock',
  'QrBlock',
  'TableBlock',
  'DividerBlock',
  'SpacerBlock',
  'TwoColumnBlock',
  'PageBreakBlock',
  'SignatureBlock',
  'BoxBlock',
  // DOM elements created via <Element is="div" />
  'div',
  'span',
  'p',
  'section',
])

/* -------------------------------------------------------------------------- */
/*  Block metadata                                                             */
/* -------------------------------------------------------------------------- */

export type BlockKind =
  | 'text'
  | 'heading'
  | 'list'
  | 'button'
  | 'image'
  | 'qr'
  | 'table'
  | 'divider'
  | 'spacer'
  | 'columns'
  | 'pageBreak'
  | 'signature'
  | 'box'

export type BlockCategory =
  | 'Content'
  | 'Media'
  | 'Data'
  | 'Layout'
  | 'Decoration'

export type BlockMeta = {
  /** craft.js `displayName` — what the user sees. */
  displayName: string
  kind: BlockKind
  category: BlockCategory
  description: string
  /** Has editable textual content (shows a Content section + typography). */
  text?: boolean
  /** Inner content stretches to full width when no explicit width is set. */
  fill?: boolean
  /** Can be aligned left / center / right on the page. */
  align?: boolean
  /** Shows typography controls. */
  typography?: boolean
  /** Shows box controls (background, border, radius, padding, margin, opacity). */
  box?: boolean
}

/**
 * Keyed by the Craft.js resolver key (the component's function name), which is
 * what ends up in `node.type.resolvedName` after serialization.
 */
export const BLOCK_META: Record<string, BlockMeta> = {
  TextBlock: {
    displayName: 'Text',
    kind: 'text',
    category: 'Content',
    description: 'Paragraph text',
    text: true,
    fill: true,
    align: true,
    typography: true,
    box: true,
  },
  HeadingBlock: {
    displayName: 'Heading',
    kind: 'heading',
    category: 'Content',
    description: 'Section title',
    text: true,
    fill: true,
    align: true,
    typography: true,
    box: true,
  },
  ListBlock: {
    displayName: 'List',
    kind: 'list',
    category: 'Content',
    description: 'Bulleted or numbered list',
    text: true,
    fill: true,
    align: true,
    typography: true,
    box: true,
  },
  ButtonBlock: {
    displayName: 'Button',
    kind: 'button',
    category: 'Content',
    description: 'Call-to-action link',
    text: true,
    align: true,
    typography: true,
    box: true,
  },
  ImageBlock: {
    displayName: 'Image',
    kind: 'image',
    category: 'Media',
    description: 'Image or logo',
    align: true,
    box: true,
  },
  QrBlock: {
    displayName: 'QR Code',
    kind: 'qr',
    category: 'Media',
    description: 'Encode a URL or text',
    align: true,
    box: true,
  },
  SignatureBlock: {
    displayName: 'Signature',
    kind: 'signature',
    category: 'Content',
    description: 'Signature line with name',
    text: true,
    align: true,
    typography: true,
    box: true,
  },
  TableBlock: {
    displayName: 'Table',
    kind: 'table',
    category: 'Data',
    description: 'Rows and columns of data',
    align: true,
    typography: true,
    box: true,
  },
  BoxBlock: {
    displayName: 'Box',
    kind: 'box',
    category: 'Decoration',
    description: 'Coloured panel or divider bar',
    align: true,
    box: true,
  },
  DividerBlock: {
    displayName: 'Divider',
    kind: 'divider',
    category: 'Decoration',
    description: 'Horizontal line',
    align: true,
  },
  SpacerBlock: {
    displayName: 'Spacer',
    kind: 'spacer',
    category: 'Layout',
    description: 'Empty vertical space',
  },
  TwoColumnBlock: {
    displayName: 'Two columns',
    kind: 'columns',
    category: 'Layout',
    description: 'Side-by-side content',
    box: true,
  },
  PageBreakBlock: {
    displayName: 'Page break',
    kind: 'pageBreak',
    category: 'Layout',
    description: 'Start a new page here',
  },
}

export type BlockKey = keyof typeof BLOCK_META

/* -------------------------------------------------------------------------- */
/*  Page setup                                                                 */
/* -------------------------------------------------------------------------- */

export type PageSizeKey =
  | 'A4'
  | 'A5'
  | 'B5'
  | 'LETTER'
  | 'LEGAL'
  | 'TABLOID'
  | 'EXECUTIVE'
  | 'CUSTOM'

export type PagePreset = {
  label: string
  /** Portrait dimensions, in PostScript points. */
  widthPt: number
  heightPt: number
}

export const PAGE_PRESETS: Record<Exclude<PageSizeKey, 'CUSTOM'>, PagePreset> =
  {
    A4: { label: 'A4 — 210 × 297 mm', widthPt: 595.28, heightPt: 841.89 },
    A5: { label: 'A5 — 148 × 210 mm', widthPt: 419.53, heightPt: 595.28 },
    B5: { label: 'B5 — 176 × 250 mm', widthPt: 498.9, heightPt: 708.66 },
    LETTER: { label: 'Letter — 8.5 × 11 in', widthPt: 612, heightPt: 792 },
    LEGAL: { label: 'Legal — 8.5 × 14 in', widthPt: 612, heightPt: 1008 },
    TABLOID: {
      label: 'Tabloid — 11 × 17 in',
      widthPt: 792,
      heightPt: 1224,
    },
    EXECUTIVE: {
      label: 'Executive — 7.25 × 10.5 in',
      widthPt: 521.86,
      heightPt: 756,
    },
  }

export type PageSizeOption = { value: PageSizeKey; label: string }

/**
 * Page configuration. Stored on the **root node's props** inside `craftJson`,
 * so it round-trips with the document without any extra database columns.
 *
 * Margins are in CSS pixels; page dimensions are in PostScript points.
 */
export type PageSetup = {
  pageSize: PageSizeKey
  customWidthPt: number
  customHeightPt: number
  orientation: 'portrait' | 'landscape'
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  backgroundColor: string
  /** Draw dashed guides at every page boundary on the canvas. */
  showGuides: boolean
  /** CSS grid overlay size in px (0 = off). */
  gridSize: number
  snapToGrid: boolean
  /** Render "Page N of M" in the PDF footer. */
  pageNumbers: boolean
  /** R2 key + public URL of the last generated PDF. */
  pdfUrl: string | null
  pdfKey: string | null
  pdfGeneratedAt: string | null
}

/** A PDF produced by a bulk run. */
export type GeneratedFile = {
  name: string
  url: string
  key: string
  size: number
  /** The row values this file was built from. */
  values: Record<string, string>
  createdAt: string
  /** Groups files that came from the same run. */
  batchId?: string
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  pageSize: 'A4',
  customWidthPt: 595.28,
  customHeightPt: 841.89,
  orientation: 'portrait',
  marginTop: 64,
  marginRight: 56,
  marginBottom: 64,
  marginLeft: 56,
  backgroundColor: '#ffffff',
  showGuides: true,
  gridSize: 0,
  snapToGrid: false,
  pageNumbers: true,
  pdfUrl: null,
  pdfKey: null,
  pdfGeneratedAt: null,
}

/** Resolve a page setup into concrete pixel dimensions for the canvas. */
export function resolvePageSize(setup: PageSetup): {
  width: number
  height: number
  /** same, in PostScript points — for the PDF renderer */
  widthPt: number
  heightPt: number
} {
  const preset =
    setup.pageSize === 'CUSTOM' ? null : PAGE_PRESETS[setup.pageSize]

  const widthPt = preset
    ? preset.widthPt
    : setup.customWidthPt || PAGE_PRESETS.A4.widthPt
  const heightPt = preset
    ? preset.heightPt
    : setup.customHeightPt || PAGE_PRESETS.A4.heightPt

  const landscape = setup.orientation === 'landscape'
  const w = landscape ? Math.max(widthPt, heightPt) : Math.min(widthPt, heightPt)
  const h = landscape ? Math.min(widthPt, heightPt) : Math.max(widthPt, heightPt)

  return {
    widthPt: Math.round(w * 100) / 100,
    heightPt: Math.round(h * 100) / 100,
    width: Math.round(pt2px(w)),
    height: Math.round(pt2px(h)),
  }
}

/* -------------------------------------------------------------------------- */
/*  Rows / detail                                                              */
/* -------------------------------------------------------------------------- */

export type StudioDocumentRow = {
  id: string
  title: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export type StudioDocumentDetail = StudioDocumentRow & {
  craftJson: CraftJson
}
