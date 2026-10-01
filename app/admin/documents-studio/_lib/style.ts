import type { CSSProperties } from 'react'
import type { StyleSheet } from '@react-pdf/renderer'

/** react-pdf's style shape, derived from the library's own types. */
export type PdfStyle = ReturnType<typeof StyleSheet.create>[string]

/** react-pdf only accepts these border styles (no `none`, no `double`). */
export type PdfBorderStyle = 'solid' | 'dashed' | 'dotted'

/* -------------------------------------------------------------------------- */
/*  Fonts                                                                      */
/* -------------------------------------------------------------------------- */

export type PdfFontSet = {
  regular: string
  bold: string
  italic: string
  boldItalic: string
}

export type FontFamilyOption = {
  label: string
  /** CSS font stack used on the canvas. */
  css: string
  /** The four standard-PDF faces react-pdf can use without embedding a font. */
  pdf: PdfFontSet
}

const SANS: PdfFontSet = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
}
const SERIF: PdfFontSet = {
  regular: 'Times-Roman',
  bold: 'Times-Bold',
  italic: 'Times-Italic',
  boldItalic: 'Times-BoldItalic',
}
const MONO: PdfFontSet = {
  regular: 'Courier',
  bold: 'Courier-Bold',
  italic: 'Courier-Oblique',
  boldItalic: 'Courier-BoldOblique',
}

export const FONT_FAMILIES = {
  Inter: {
    label: 'Inter (Sans)',
    css: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    pdf: SANS,
  },
  Arial: {
    label: 'Arial',
    css: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
    pdf: SANS,
  },
  Verdana: {
    label: 'Verdana',
    css: 'Verdana, Geneva, sans-serif',
    pdf: SANS,
  },
  Georgia: {
    label: 'Georgia (Serif)',
    css: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
    pdf: SERIF,
  },
  TimesNewRoman: {
    label: 'Times New Roman',
    css: "'Times New Roman', Times, serif",
    pdf: SERIF,
  },
  Palatino: {
    label: 'Palatino',
    css: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    pdf: SERIF,
  },
  Courier: {
    label: 'Courier (Mono)',
    css: "'Courier New', Courier, ui-monospace, monospace",
    pdf: MONO,
  },
  Impact: {
    label: 'Impact',
    css: 'Impact, Haettenschweiler, sans-serif',
    pdf: SANS,
  },
} satisfies Record<string, FontFamilyOption>

export type FontFamilyKey = keyof typeof FONT_FAMILIES

export const FONT_FAMILY_OPTIONS = (
  Object.keys(FONT_FAMILIES) as FontFamilyKey[]
).map((key) => ({ value: key, label: FONT_FAMILIES[key].label }))

/* -------------------------------------------------------------------------- */
/*  Enumerations                                                               */
/* -------------------------------------------------------------------------- */

export const FONT_WEIGHT_OPTIONS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Black' },
]

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
] as const

export const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
]

export const TEXT_DECORATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'underline', label: 'Underline' },
  { value: 'line-through', label: 'Strikethrough' },
]

export const BORDER_STYLE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
]

export const OBJECT_FIT_OPTIONS = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'fill', label: 'Stretch' },
  { value: 'none', label: 'Original' },
]

export type BlockAlign = 'left' | 'center' | 'right'

export const ALIGN_OPTIONS: { value: BlockAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

/** Which flex justification maps to each alignment. */
export const ALIGN_TO_FLEX: Record<BlockAlign, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

/* -------------------------------------------------------------------------- */
/*  Shared style props                                                         */
/* -------------------------------------------------------------------------- */

export type BlockStyleProps = {
  /* spacing (px) */
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number

  /* box */
  backgroundColor: string
  borderWidth: number
  borderStyle: string
  borderColor: string
  borderRadius: number
  opacity: number

  /* typography */
  color: string
  fontSize: number
  fontWeight: string
  fontFamily: FontFamilyKey
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textDecoration: 'none' | 'underline' | 'line-through'
  fontStyle: 'normal' | 'italic'

  /* layout */
  align: BlockAlign
  /** Explicit width in px. 0 = automatic. */
  width: number
}

/**
 * Every block spreads this into `craft.props`, so the settings panel can offer
 * the same box + typography controls for all of them.
 */
export const BASE_STYLE_PROPS: BlockStyleProps = {
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 6,
  marginLeft: 0,

  backgroundColor: 'transparent',
  borderWidth: 0,
  borderStyle: 'solid',
  borderColor: '#d4d4d8',
  borderRadius: 0,
  opacity: 100,

  color: '#18181b',
  fontSize: 14,
  fontWeight: '400',
  fontFamily: 'Inter',
  lineHeight: 1.5,
  letterSpacing: 0,
  textAlign: 'left',
  textTransform: 'none',
  textDecoration: 'none',
  fontStyle: 'normal',

  align: 'left',
  width: 0,
}

/** Padding/margin defaults, handy for content blocks that need breathing room. */
export const CONTENT_PADDING = {
  paddingTop: 2,
  paddingRight: 0,
  paddingBottom: 2,
  paddingLeft: 0,
}

export function styleDefaults(
  overrides: Partial<BlockStyleProps> & Record<string, unknown> = {}
) {
  return { ...BASE_STYLE_PROPS, ...overrides }
}

/* -------------------------------------------------------------------------- */
/*  Coercion helpers                                                           */
/* -------------------------------------------------------------------------- */

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Read style props off a node with sensible fallbacks. */
export function readStyle(props: Record<string, unknown>): BlockStyleProps {
  return {
    ...BASE_STYLE_PROPS,
    ...(props as Partial<BlockStyleProps>),
  }
}

/* -------------------------------------------------------------------------- */
/*  Canvas (CSS)                                                               */
/* -------------------------------------------------------------------------- */

export function boxCss(style: BlockStyleProps): CSSProperties {
  const borderWidth = num(style.borderWidth)
  return {
    paddingTop: num(style.paddingTop),
    paddingRight: num(style.paddingRight),
    paddingBottom: num(style.paddingBottom),
    paddingLeft: num(style.paddingLeft),
    marginTop: num(style.marginTop),
    marginRight: num(style.marginRight),
    marginBottom: num(style.marginBottom),
    marginLeft: num(style.marginLeft),
    backgroundColor: str(style.backgroundColor, 'transparent') || 'transparent',
    borderWidth,
    borderStyle: borderWidth > 0 ? (style.borderStyle || 'solid') : 'none',
    borderColor: str(style.borderColor, '#d4d4d8'),
    borderRadius: num(style.borderRadius),
    opacity: num(style.opacity, 100) / 100,
  }
}

export function textCss(style: BlockStyleProps): CSSProperties {
  const family = FONT_FAMILIES[style.fontFamily] ?? FONT_FAMILIES.Inter
  return {
    color: str(style.color, '#18181b'),
    fontSize: num(style.fontSize, 14),
    fontWeight: str(style.fontWeight, '400'),
    fontFamily: family.css,
    lineHeight: num(style.lineHeight, 1.5),
    letterSpacing: num(style.letterSpacing),
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    textDecoration: style.textDecoration === 'none' ? undefined : style.textDecoration,
  }
}

/** Style for the inner content wrapper of a block. */
export function contentCss(
  style: BlockStyleProps,
  fill: boolean
): CSSProperties {
  return {
    width: num(style.width) > 0 ? num(style.width) : fill ? '100%' : 'auto',
    maxWidth: '100%',
  }
}

/* -------------------------------------------------------------------------- */
/*  PDF (react-pdf)                                                            */
/* -------------------------------------------------------------------------- */

export function pdfFontFor(style: BlockStyleProps): string {
  const family = FONT_FAMILIES[style.fontFamily] ?? FONT_FAMILIES.Inter
  const bold = num(style.fontWeight, 400) >= 600
  const italic = style.fontStyle === 'italic'
  if (bold && italic) return family.pdf.boldItalic
  if (bold) return family.pdf.bold
  if (italic) return family.pdf.italic
  return family.pdf.regular
}

export function applyTextTransform(
  text: string,
  transform: BlockStyleProps['textTransform']
): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'capitalize':
      return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    default:
      return text
  }
}

const PT = 0.75

export function pdfBox(style: BlockStyleProps): PdfStyle {
  const borderWidth = num(style.borderWidth)
  return {
    paddingTop: num(style.paddingTop) * PT,
    paddingRight: num(style.paddingRight) * PT,
    paddingBottom: num(style.paddingBottom) * PT,
    paddingLeft: num(style.paddingLeft) * PT,
    marginTop: num(style.marginTop) * PT,
    marginRight: num(style.marginRight) * PT,
    marginBottom: num(style.marginBottom) * PT,
    marginLeft: num(style.marginLeft) * PT,
    backgroundColor: str(style.backgroundColor, 'transparent') || 'transparent',
    borderWidth: borderWidth * PT,
    // react-pdf has no `none`; a zero width already hides the border.
    borderStyle: pdfBorderStyle(style.borderStyle),
    borderColor: str(style.borderColor, '#d4d4d8'),
    borderRadius: num(style.borderRadius) * PT,
    opacity: num(style.opacity, 100) / 100,
  }
}

export function pdfBorderStyle(value: unknown): PdfBorderStyle {
  const v = str(value, 'solid')
  // react-pdf has no `double`; the closest visual match is a solid line.
  return v === 'dashed' || v === 'dotted' ? v : 'solid'
}

export function pdfText(
  style: BlockStyleProps,
  extra: PdfStyle = {}
): PdfStyle {
  return {
    fontFamily: pdfFontFor(style),
    fontSize: num(style.fontSize, 14) * PT,
    color: str(style.color, '#18181b'),
    lineHeight: num(style.lineHeight, 1.5),
    letterSpacing: num(style.letterSpacing) * PT,
    textAlign: style.textAlign,
    textDecoration:
      style.textDecoration === 'none' ? undefined : style.textDecoration,
    ...extra,
  }
}

/** Width in points for the inner content wrapper. */
export function pdfContentWidth(
  style: BlockStyleProps,
  fill: boolean
): number | string {
  const w = num(style.width)
  if (w > 0) return w * PT
  return fill ? '100%' : 'auto'
}
