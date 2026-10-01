'use client'

import * as React from 'react'
import QRCode from 'qrcode'
import { zipSync, type Zippable } from 'fflate'

import type { CraftJson } from '../constants'
import { getRootNodeId, resolvedName } from '../_lib/craft'
import {
  buildFileName,
  replaceVariables,
  type GeneratedFile,
} from '../_lib/variables'

/* -------------------------------------------------------------------------- */
/*  QR pre-generation                                                          */
/* -------------------------------------------------------------------------- */

/** Every distinct QR value in the document, so we only encode each one once. */
export function collectQrValues(json: CraftJson): string[] {
  const values = new Set<string>()

  for (const node of Object.values(json)) {
    if (!node || node.hidden) continue
    if (resolvedName(node) !== 'QrBlock') continue
    const value = node.props?.value
    if (typeof value === 'string' && value.trim()) values.add(value)
  }

  return [...values]
}

export async function generateQrCodes(
  json: CraftJson
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}

  await Promise.all(
    collectQrValues(json).map(async (value) => {
      try {
        out[value] = await QRCode.toDataURL(value, {
          width: 600,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      } catch (err) {
        console.error('[studio] QR generation failed for', value, err)
      }
    })
  )

  return out
}

/* -------------------------------------------------------------------------- */
/*  Core render                                                                */
/* -------------------------------------------------------------------------- */

export type PdfStatus = 'idle' | 'building' | 'uploading' | 'done'

export type RenderOptions = {
  /** Values substituted into `{{key}}` placeholders. */
  values?: Record<string, string>
  /** Passed straight through to the PDF metadata. */
  filename?: string
}

/**
 * Replace every placeholder in the tree, then render it with @react-pdf.
 *
 * The substitution happens on a cloned copy of the tree so the editor state is
 * never mutated.
 */
export async function renderPdfBlob(
  json: CraftJson,
  title: string,
  { values = {}, filename }: RenderOptions = {}
): Promise<Blob> {
  const resolved = hasValues(values)
    ? applyValues(json, values)
    : json

  const [{ pdf }, { StudioPdfDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./studio-pdf'),
  ])

  const qrCodes = await generateQrCodes(resolved)

  return pdf(
    React.createElement(StudioPdfDocument, {
      json: resolved,
      title,
      qrCodes,
      filename,
    })
  ).toBlob()
}

function hasValues(values: Record<string, string>): boolean {
  return Object.keys(values).length > 0
}

/** Deep-clone the tree and interpolate all string props. */
function applyValues(
  json: CraftJson,
  values: Record<string, string>
): CraftJson {
  const out: CraftJson = {}

  for (const [id, node] of Object.entries(json)) {
    const props: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (typeof value === 'string') {
        props[key] = replaceVariables(value, values)
      } else if (Array.isArray(value)) {
        props[key] = value.map((item) =>
          typeof item === 'string' ? replaceVariables(item, values) : item
        )
      } else {
        props[key] = value
      }
    }

    out[id] = { ...node, props }
  }

  return out
}

/* -------------------------------------------------------------------------- */
/*  Bulk generation                                                            */
/* -------------------------------------------------------------------------- */

export type BulkProgress = {
  done: number
  total: number
  current: string
  phase: 'building' | 'packing' | 'uploading' | 'done'
}

export type BulkResult = {
  files: { name: string; blob: Blob; values: Record<string, string> }[]
  zip: Blob
  /** Records whose generated name collided and got numbered instead. */
  deduped: number
}

/**
 * Render one PDF per record and pack them into a single zip archive.
 *
 * Runs sequentially — react-pdf is CPU-bound and parallel builds spike memory
 * hard on large runs.
 */
export async function renderBulkZips({
  json,
  title,
  records,
  nameTemplate,
  defaults = {},
  onProgress,
}: {
  json: CraftJson
  title: string
  records: Record<string, string>[]
  /** Supports `{{key}}` tokens. Falls back to the document title. */
  nameTemplate?: string
  defaults?: Record<string, string>
  onProgress?: (progress: BulkProgress) => void
}): Promise<BulkResult> {
  const files: BulkResult['files'] = []
  const archive: Zippable = {}
  /** How many records had to be auto-numbered because their name clashed. */
  let deduped = 0

  const total = records.length

  /**
   * Zip entry names must be unique or later writes silently overwrite earlier
   * ones. Rows that produce the same name (empty template, or an unresolved
   * placeholder) get numbered so every record survives.
   */
  const used = new Map<string, number>()

  for (let index = 0; index < total; index += 1) {
    const row = records[index]
    // Layer per-row values over the variable defaults.
    const values = { ...defaults, ...row }

    const base = buildFileName(nameTemplate ?? title, values, index, title)
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)

    const name = seen === 0 ? base : numberedName(base, seen + 1)
    if (seen > 0) deduped += 1

    onProgress?.({ done: index, total, current: name, phase: 'building' })

    const blob = await renderPdfBlob(json, title, { values, filename: name })
    files.push({ name, blob, values })

    // Store as a plain Uint8Array — fflate cannot read a Blob directly.
    archive[name] = new Uint8Array(await blob.arrayBuffer())
  }

  onProgress?.({ done: total, total, current: 'archive.zip', phase: 'packing' })

  const zipped = zipSync(archive, { level: 6 })
  const zip = new Blob([zipped], { type: 'application/zip' })

  onProgress?.({ done: total, total, current: 'archive.zip', phase: 'done' })

  return { files, zip, deduped }
}

/** `report.pdf` -> `report-2.pdf` */
function numberedName(base: string, n: number): string {
  return `${base.replace(/\.pdf$/i, '')}-${n}.pdf`
}

/* -------------------------------------------------------------------------- */
/*  Storage                                                                    */
/* -------------------------------------------------------------------------- */

export type UploadedPdf = {
  name: string
  url: string
  key: string
  size: number
  values: Record<string, string>
  createdAt: string
}

/** Upload every generated file under `<document>/batch/`. */
export async function uploadBatch({
  documentId,
  files,
  getUploadUrl,
  onProgress,
}: {
  documentId: string
  files: { name: string; blob: Blob; values: Record<string, string> }[]
  getUploadUrl: (
    documentId: string,
    fileName: string
  ) => Promise<
    | { success: true; uploadUrl: string; publicUrl: string; key: string }
    | { success: false; error: string }
  >
  onProgress?: (progress: BulkProgress) => void
}): Promise<UploadedPdf[]> {
  const uploaded: UploadedPdf[] = []
  const total = files.length

  for (let index = 0; index < total; index += 1) {
    const file = files[index]
    onProgress?.({ done: index, total, current: file.name, phase: 'uploading' })

    try {
      const presign = await getUploadUrl(documentId, file.name)
      if (!presign.success) throw new Error(presign.error)

      const response = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file.blob,
        headers: { 'Content-Type': 'application/pdf' },
      })
      if (!response.ok) throw new Error(`Upload failed (${response.status})`)

      uploaded.push({
        name: file.name,
        url: presign.publicUrl,
        key: presign.key,
        size: file.blob.size,
        values: file.values,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[studio] batch upload failed for', file.name, err)
    }
  }

  onProgress?.({ done: total, total, current: '', phase: 'done' })
  return uploaded
}

/* -------------------------------------------------------------------------- */
/*  Download helpers                                                           */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'document'
  )
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Let the browser start the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function archiveName(title: string, count: number): string {
  return `${slugify(title)}-${count}-pdfs.zip`
}

/* -------------------------------------------------------------------------- */
/*  Stored-file helpers                                                        */
/* -------------------------------------------------------------------------- */

export function readGeneratedFiles(json: CraftJson): GeneratedFile[] {
  const root = json[getRootNodeId(json)]
  const raw = root?.props?.generatedFiles
  return Array.isArray(raw) ? (raw as GeneratedFile[]) : []
}

/* -------------------------------------------------------------------------- */
/*  Single PDF: build, store, download                                        */
/* -------------------------------------------------------------------------- */

export type GenerateResult =
  | {
      ok: true
      blob: Blob
      filename: string
      publicUrl: string | null
      key: string | null
      stored: boolean
    }
  | { ok: false; error: string; filename?: string }

/**
 * Build one PDF, upload a copy to R2 and hand the file to the browser.
 *
 * A storage failure never blocks the download — the user still gets their file.
 */
export async function generateAndStorePdf({
  json,
  title,
  documentId,
  getUploadUrl,
  onStatus,
}: {
  json: CraftJson
  title: string
  documentId: string
  getUploadUrl: (
    documentId: string,
    fileName?: string
  ) => Promise<
    | { success: true; uploadUrl: string; publicUrl: string; key: string }
    | { success: false; error: string }
  >
  onStatus?: (status: PdfStatus) => void
}): Promise<GenerateResult> {
  onStatus?.('building')

  let blob: Blob
  let filename: string

  try {
    blob = await renderPdfBlob(json, title)
    filename = `${slugify(title)}.pdf`
  } catch (err) {
    console.error('[studio] PDF render failed:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not build the PDF',
    }
  }

  try {
    onStatus?.('uploading')

    const presign = await getUploadUrl(documentId, filename)
    if (!presign.success) throw new Error(presign.error)

    const response = await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'application/pdf' },
    })
    if (!response.ok) throw new Error(`Upload failed (${response.status})`)

    onStatus?.('done')
    return {
      ok: true,
      blob,
      filename,
      publicUrl: presign.publicUrl,
      key: presign.key,
      stored: true,
    }
  } catch (err) {
    console.error('[studio] PDF upload failed:', err)
    return {
      ok: true,
      blob,
      filename,
      publicUrl: null,
      key: null,
      stored: false,
    }
  }
}
