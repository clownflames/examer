'use server'

import crypto from 'crypto'
import { count, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { studioDocuments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { getPublicUrl, getUploadPresignedUrl } from '@/lib/r2'

import {
  PAGE_SIZE,
  type CraftJson,
  type StudioDocumentRow,
  type StudioDocumentDetail,
} from './constants'
import { getRootNodeId } from './_lib/craft'

/* -------------------------------------------------------------------------- */
/*  Auth guard                                                                 */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session.user
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listStudioDocuments(
  page = 1
): Promise<{
  data: StudioDocumentRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    await requireAdmin()

    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE

    const rows = await db
      .select({
        id: studioDocuments.id,
        title: studioDocuments.title,
        description: studioDocuments.description,
        createdAt: studioDocuments.createdAt,
        updatedAt: studioDocuments.updatedAt,
      })
      .from(studioDocuments)
      .orderBy(desc(studioDocuments.updatedAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(studioDocuments)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return {
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      })),
      page: safePage,
      totalPages,
      total,
    }
  } catch (error) {
    console.error('[studio] listStudioDocuments error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Get single                                                                 */
/* -------------------------------------------------------------------------- */

export async function getStudioDocument(
  id: string
): Promise<StudioDocumentDetail | null> {
  try {
    await requireAdmin()

    const [row] = await db
      .select()
      .from(studioDocuments)
      .where(eq(studioDocuments.id, id))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      craftJson: row.craftJson as CraftJson,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  } catch (error) {
    console.error('[studio] getStudioDocument error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Save (create or update)                                                    */
/* -------------------------------------------------------------------------- */

/** The generated-PDF metadata lives on the root node's props. */
/**
 * The generated-PDF metadata lives on the root node's props. The client
 * serialises the page setup it knows about, which may predate the latest
 * export, so these keys are carried across rather than overwritten.
 */
const CARRIED_ROOT_KEYS = [
  'pdfUrl',
  'pdfKey',
  'pdfGeneratedAt',
  'pdfSize',
  'generatedFiles',
  'lastBatchId',
] as const

/**
 * Keep the stored-PDF pointer when the editor saves a fresh snapshot — the
 * client serialises the page setup it knows about, which may predate the
 * latest export.
 */
function carryOverPdfMeta(next: CraftJson, previous: unknown): CraftJson {
  if (!previous || typeof previous !== 'object') return next

  const prevJson = previous as CraftJson
  const prevRoot = prevJson[getRootNodeId(prevJson)]
  if (!prevRoot?.props) return next

  const nextRootId = getRootNodeId(next)
  const nextRoot = next[nextRootId]
  if (!nextRoot) return next

  const patch: Record<string, unknown> = {}
  for (const key of CARRIED_ROOT_KEYS) {
    const value = prevRoot.props[key]
    if (value !== undefined) patch[key] = value
  }

  if (Object.keys(patch).length === 0) return next

  return {
    ...next,
    [nextRootId]: { ...nextRoot, props: { ...nextRoot.props, ...patch } },
  }
}

export async function saveStudioDocument(input: {
  id?: string | null
  title: string
  description?: string | null
  craftJson: CraftJson
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin()

    if (!input.title.trim()) {
      return { success: false, error: 'Title is required' }
    }

    if (input.id) {
      const [existing] = await db
        .select({ craftJson: studioDocuments.craftJson })
        .from(studioDocuments)
        .where(eq(studioDocuments.id, input.id))
        .limit(1)

      const updated = await db
        .update(studioDocuments)
        .set({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          craftJson: carryOverPdfMeta(input.craftJson, existing?.craftJson),
          updatedAt: new Date(),
        })
        .where(eq(studioDocuments.id, input.id))
        .returning({ id: studioDocuments.id })

      if (updated.length === 0) {
        return { success: false, error: 'Document not found' }
      }

      revalidatePath('/admin/documents-studio/list')
      revalidatePath(`/admin/documents-studio/${input.id}`)
      return { success: true, id: input.id }
    }

    const id = crypto.randomUUID()
    await db.insert(studioDocuments).values({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      craftJson: input.craftJson,
      createdBy: admin.id,
    })

    revalidatePath('/admin/documents-studio/list')
    return { success: true, id }
  } catch (error) {
    console.error('[studio] saveStudioDocument error:', error)
    return { success: false, error: 'Could not save document' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteStudioDocument(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin()

    const deleted = await db
      .delete(studioDocuments)
      .where(eq(studioDocuments.id, id))
      .returning({ id: studioDocuments.id })

    if (deleted.length === 0) {
      return { success: false, error: 'Not found' }
    }

    revalidatePath('/admin/documents-studio/list')
    return { success: true }
  } catch (error) {
    console.error('[studio] deleteStudioDocument error:', error)
    return { success: false, error: 'Could not delete' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Duplicate                                                                  */
/* -------------------------------------------------------------------------- */

export async function duplicateStudioDocument(
  sourceId: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin()

    const [source] = await db
      .select()
      .from(studioDocuments)
      .where(eq(studioDocuments.id, sourceId))
      .limit(1)

    if (!source) return { success: false, error: 'Document not found' }

    const id = crypto.randomUUID()
    const craftJson = { ...(source.craftJson as CraftJson) }
    const rootId = getRootNodeId(craftJson)
    const root = craftJson[rootId]

    // The copy starts with no stored PDF — it is regenerated on first export.
    if (root) {
      craftJson[rootId] = {
        ...root,
        props: {
          ...root.props,
          pdfUrl: null,
          pdfKey: null,
          pdfGeneratedAt: null,
        },
      }
    }

    await db.insert(studioDocuments).values({
      id,
      title: `${source.title} (copy)`,
      description: source.description,
      craftJson,
      createdBy: admin.id,
    })

    revalidatePath('/admin/documents-studio/list')
    return { success: true, id }
  } catch (error) {
    console.error('[studio] duplicateStudioDocument error:', error)
    return { success: false, error: 'Could not duplicate' }
  }
}

/* -------------------------------------------------------------------------- */
/*  PDF storage                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic key so a document always has exactly one stored PDF — repeated
 * exports overwrite it instead of piling up in the bucket.
 */
function buildStudioPdfKey(documentId: string): string {
  return `studio-documents/${documentId}/document.pdf`
}

/** Batch output lives in its own folder so it never clashes with the single PDF. */
function buildStudioBatchKey(documentId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `studio-documents/${documentId}/batch/${Date.now()}-${safe}`
}

export async function getStudioPdfUploadUrl(
  documentId: string,
  /** When given, a batch key is produced instead of the single-document one. */
  fileName?: string
): Promise<
  | { success: true; uploadUrl: string; publicUrl: string; key: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()

    const key = fileName
      ? buildStudioBatchKey(documentId, fileName)
      : buildStudioPdfKey(documentId)
    const uploadUrl = await getUploadPresignedUrl(key, 'application/pdf')

    return { success: true, uploadUrl, publicUrl: getPublicUrl(key), key }
  } catch (error) {
    console.error('[studio] getStudioPdfUploadUrl error:', error)
    return { success: false, error: 'Could not prepare the upload' }
  }
}

/**
 * Point the document at its stored PDF. The pointer is written onto the root
 * node's props inside `craftJson`, so no extra column is needed.
 */
export async function saveStudioPdfMeta(
  documentId: string,
  meta: { url: string; key: string; size?: number }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin()

    const [row] = await db
      .select({ craftJson: studioDocuments.craftJson })
      .from(studioDocuments)
      .where(eq(studioDocuments.id, documentId))
      .limit(1)

    if (!row) return { success: false, error: 'Document not found' }

    const craftJson = { ...(row.craftJson as CraftJson) }
    const rootId = getRootNodeId(craftJson)
    const root = craftJson[rootId]

    if (!root) return { success: false, error: 'Document has no page root' }

    craftJson[rootId] = {
      ...root,
      props: {
        ...root.props,
        pdfUrl: meta.url,
        pdfKey: meta.key,
        pdfGeneratedAt: new Date().toISOString(),
        ...(typeof meta.size === 'number' ? { pdfSize: meta.size } : {}),
      },
    }

    await db
      .update(studioDocuments)
      .set({ craftJson, updatedAt: new Date() })
      .where(eq(studioDocuments.id, documentId))

    revalidatePath(`/admin/documents-studio/${documentId}`)
    revalidatePath('/admin/documents-studio/list')
    return { success: true }
  } catch (error) {
    console.error('[studio] saveStudioPdfMeta error:', error)
    return { success: false, error: 'Could not save the PDF reference' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Batch (bulk) output                                                        */
/* -------------------------------------------------------------------------- */

type StoredBatchFile = {
  name: string
  url: string
  key: string
  size: number
  values: Record<string, string>
  createdAt: string
  /** Groups files that came from the same run. */
  batchId?: string
}

/**
 * Record the files produced by a bulk run on the document's root node, newest
 * batch first. Keeps the list bounded so the JSONB column cannot grow forever.
 */
export async function saveStudioBatch(
  documentId: string,
  files: StoredBatchFile[]
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  try {
    await requireAdmin()

    if (files.length === 0) {
      return { success: true, count: 0 }
    }

    const [row] = await db
      .select({ craftJson: studioDocuments.craftJson })
      .from(studioDocuments)
      .where(eq(studioDocuments.id, documentId))
      .limit(1)

    if (!row) return { success: false, error: 'Document not found' }

    const craftJson = { ...(row.craftJson as CraftJson) }
    const rootId = getRootNodeId(craftJson)
    const root = craftJson[rootId]

    if (!root) return { success: false, error: 'Document has no page root' }

    const previous = Array.isArray(root.props.generatedFiles)
      ? (root.props.generatedFiles as StoredBatchFile[])
      : []

    const batchId = new Date().toISOString()
    const previousBatchId = root.props.lastBatchId

    // A fresh run replaces the previous batch, otherwise the newest N win.
    const next = [
      ...files.map((file) => ({ ...file, batchId })),
      ...previous.filter((file) => file.batchId !== previousBatchId),
    ].slice(0, 500)

    craftJson[rootId] = {
      ...root,
      props: {
        ...root.props,
        generatedFiles: next,
        lastBatchId: batchId,
      },
    }

    await db
      .update(studioDocuments)
      .set({ craftJson, updatedAt: new Date() })
      .where(eq(studioDocuments.id, documentId))

    revalidatePath(`/admin/documents-studio/${documentId}`)
    revalidatePath('/admin/documents-studio/list')
    return { success: true, count: files.length }
  } catch (error) {
    console.error('[studio] saveStudioBatch error:', error)
    return { success: false, error: 'Could not record the generated files' }
  }
}