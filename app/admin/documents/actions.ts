'use server'

import crypto from 'crypto'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  buildDocumentKey,
  deleteR2Object,
  getPublicUrl,
  getUploadPresignedUrl,
} from '@/lib/r2'

import {
  PAGE_SIZE,
  EMPTY_CONTENT,
  type DocumentContent,
  type DocumentDetail,
  type DocumentRow,
} from './constants'

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

export async function getDocuments(
  page = 1,
  query = ''
): Promise<{
  data: DocumentRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    await requireAdmin()

    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE
    const q = query.trim()

    let whereClause: SQL | undefined
    if (q) {
      const pattern = `%${q}%`
      const search = or(
        ilike(documents.title, pattern),
        ilike(documents.description, pattern)
      )
      whereClause = search
    }

    const rows = await db
      .select({
        id: documents.id,
        title: documents.title,
        description: documents.description,
        pdfUrl: documents.pdfUrl,
        isTemplate: documents.isTemplate,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(whereClause)
      .orderBy(desc(documents.updatedAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(documents)
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const data: DocumentRow[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      pdfUrl: r.pdfUrl,
      isTemplate: r.isTemplate,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }))

    return { data, page: safePage, totalPages, total }
  } catch (error) {
    console.error('[documents] getDocuments error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Get single                                                                 */
/* -------------------------------------------------------------------------- */

export async function getDocumentById(
  id: string
): Promise<DocumentDetail | null> {
  try {
    await requireAdmin()

    const [row] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!row) return null

    const content = (row.content as DocumentContent) ?? EMPTY_CONTENT

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      pdfUrl: row.pdfUrl,
      isTemplate: row.isTemplate,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      content,
    }
  } catch (error) {
    console.error('[documents] getDocumentById error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Save (create or update)                                                    */
/* -------------------------------------------------------------------------- */

export async function saveDocument(input: {
  id?: string | null
  title: string
  description?: string | null
  content: DocumentContent
  isTemplate?: boolean
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin()

    if (!input.title.trim()) {
      return { success: false, error: 'Title is required' }
    }

    const now = new Date()

    if (input.id) {
      const updated = await db
        .update(documents)
        .set({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          content: input.content,
          isTemplate: input.isTemplate ?? false,
          updatedAt: now,
        })
        .where(eq(documents.id, input.id))
        .returning({ id: documents.id })

      if (updated.length === 0) {
        return { success: false, error: 'Document not found' }
      }

      revalidatePath('/admin/documents')
      revalidatePath(`/admin/documents/${input.id}/edit`)
      return { success: true, id: input.id }
    }

    const id = crypto.randomUUID()
    await db.insert(documents).values({
      id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      content: input.content,
      isTemplate: input.isTemplate ?? false,
      createdBy: admin.id,
    })

    revalidatePath('/admin/documents')
    return { success: true, id }
  } catch (error) {
    console.error('[documents] saveDocument error:', error)
    return { success: false, error: 'Could not save document' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteDocument(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin()

    const [row] = await db
      .select({ id: documents.id, pdfKey: documents.pdfKey })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1)

    if (!row) return { success: false, error: 'Not found' }

    if (row.pdfKey) {
      try {
        await deleteR2Object(row.pdfKey)
      } catch (err) {
        console.error('[documents] R2 delete failed (continuing):', err)
      }
    }

    await db.delete(documents).where(eq(documents.id, id))

    revalidatePath('/admin/documents')
    return { success: true }
  } catch (error) {
    console.error('[documents] deleteDocument error:', error)
    return { success: false, error: 'Could not delete' }
  }
}

/* -------------------------------------------------------------------------- */
/*  PDF upload (called AFTER PDF is generated on the client)                   */
/* -------------------------------------------------------------------------- */

export async function getPdfUploadUrl(
  documentId: string
): Promise<
  | { success: true; uploadUrl: string; publicUrl: string; key: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()

    const key = buildDocumentKey(documentId, 'document.pdf')
    const uploadUrl = await getUploadPresignedUrl(key, 'application/pdf')
    const publicUrl = getPublicUrl(key)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error('[documents] getPdfUploadUrl error:', error)
    return { success: false, error: 'Could not prepare upload' }
  }
}

export async function updatePdfUrl(
  documentId: string,
  pdfUrl: string,
  pdfKey: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin()

    await db
      .update(documents)
      .set({ pdfUrl, pdfKey, updatedAt: new Date() })
      .where(eq(documents.id, documentId))

    revalidatePath('/admin/documents')
    revalidatePath(`/admin/documents/${documentId}/edit`)
    return { success: true }
  } catch (error) {
    console.error('[documents] updatePdfUrl error:', error)
    return { success: false, error: 'Could not save PDF URL' }
  }
}


/* -------------------------------------------------------------------------- */
/*  Duplicate                                                                  */
/* -------------------------------------------------------------------------- */

export async function duplicateDocument(
  sourceId: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin()

    const [source] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, sourceId))
      .limit(1)

    if (!source) return { success: false, error: 'Document not found' }

    const id = crypto.randomUUID()
    const copyTitle = `${source.title} (copy)`

    await db.insert(documents).values({
      id,
      title: copyTitle,
      description: source.description,
      content: source.content,
      // Do NOT copy the PDF — it will regenerate on first save/generate
      pdfUrl: null,
      pdfKey: null,
      createdBy: admin.id,
      isTemplate: false,
    })

    revalidatePath('/admin/documents')
    return { success: true, id }
  } catch (error) {
    console.error('[documents] duplicateDocument error:', error)
    return { success: false, error: 'Could not duplicate' }
  }
}