'use server'

import crypto from 'crypto'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { mediaAssets, user } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  buildMediaKey,
  getPublicUrl,
  getUploadPresignedUrl,
  deleteR2Object,
} from '@/lib/r2'

import {
  PAGE_SIZE,
  type MediaAssetRow,
  type MediaFilter,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Auth helpers                                                               */
/* -------------------------------------------------------------------------- */

async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

async function requireUser() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const role =
    ((session.user as { role?: string }).role === 'admin'
      ? 'admin'
      : 'user') as 'admin' | 'user'
  return { userId: session.user.id, role }
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getMediaAssets(
  page = 1,
  filter: MediaFilter = 'all',
  query = ''
): Promise<{
  data: MediaAssetRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    const { userId, role } = await requireUser()
    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE

    const filters: SQL[] = []

    // Role-based visibility
    if (role === 'user') {
      // Users only see their own uploads
      filters.push(eq(mediaAssets.uploadedBy, userId))
    } else {
      // Admin sees everything by default
      if (filter === 'mine') {
        filters.push(eq(mediaAssets.uploadedBy, userId))
      } else if (filter === 'admin') {
        filters.push(eq(mediaAssets.uploadedByRole, 'admin'))
      } else if (filter === 'user') {
        filters.push(eq(mediaAssets.uploadedByRole, 'user'))
      }
    }

    // Text search
    const q = query.trim()
    if (q) {
      const pattern = `%${q}%`
      const searchFilter = or(
        ilike(mediaAssets.originalName, pattern),
        ilike(mediaAssets.fileName, pattern)
      )
      if (searchFilter) filters.push(searchFilter)
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const rows = await db
      .select({
        id: mediaAssets.id,
        fileName: mediaAssets.fileName,
        originalName: mediaAssets.originalName,
        mimeType: mediaAssets.mimeType,
        size: mediaAssets.size,
        url: mediaAssets.url,
        key: mediaAssets.key,
        width: mediaAssets.width,
        height: mediaAssets.height,
        uploadedBy: mediaAssets.uploadedBy,
        uploadedByName: user.name,
        uploadedByRole: mediaAssets.uploadedByRole,
        createdAt: mediaAssets.createdAt,
      })
      .from(mediaAssets)
      .leftJoin(user, eq(mediaAssets.uploadedBy, user.id))
      .where(whereClause)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(mediaAssets)
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const data: MediaAssetRow[] = rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      originalName: r.originalName,
      mimeType: r.mimeType,
      size: r.size,
      url: r.url,
      key: r.key,
      width: r.width,
      height: r.height,
      uploadedBy: r.uploadedBy,
      uploadedByName: r.uploadedByName,
      uploadedByRole: r.uploadedByRole,
      createdAt: new Date(r.createdAt).toISOString(),
    }))

    return { data, page: safePage, totalPages, total }
  } catch (error) {
    console.error('[media] getMediaAssets error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Presign (upload URL)                                                       */
/* -------------------------------------------------------------------------- */

export async function getMediaUploadUrl(input: {
  fileName: string
  contentType: string
}): Promise<
  | { success: true; uploadUrl: string; publicUrl: string; key: string }
  | { success: false; error: string }
> {
  try {
    const { userId } = await requireUser()

    if (!input.fileName || !input.contentType) {
      return { success: false, error: 'Missing file info' }
    }

    // Only images
    if (!input.contentType.startsWith('image/')) {
      return { success: false, error: 'Only images are allowed' }
    }

    const key = buildMediaKey(userId, input.fileName)
    const uploadUrl = await getUploadPresignedUrl(key, input.contentType)
    const publicUrl = getPublicUrl(key)

    return { success: true, uploadUrl, publicUrl, key }
  } catch (error) {
    console.error('[media] getMediaUploadUrl error:', error)
    return { success: false, error: 'Could not prepare upload' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Save metadata after successful upload                                      */
/* -------------------------------------------------------------------------- */

export async function saveMediaAsset(input: {
  fileName: string
  originalName: string
  mimeType: string
  size: number
  url: string
  key: string
  width?: number | null
  height?: number | null
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const { userId, role } = await requireUser()

    const id = crypto.randomUUID()
    await db.insert(mediaAssets).values({
      id,
      fileName: input.fileName,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      url: input.url,
      key: input.key,
      width: input.width ?? null,
      height: input.height ?? null,
      uploadedBy: userId,
      uploadedByRole: role,
    })

    revalidatePath('/admin/media')
    return { success: true, id }
  } catch (error) {
    console.error('[media] saveMediaAsset error:', error)
    return { success: false, error: 'Could not save media' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteMediaAsset(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { userId, role } = await requireUser()

    const [row] = await db
      .select({
        id: mediaAssets.id,
        key: mediaAssets.key,
        uploadedBy: mediaAssets.uploadedBy,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1)

    if (!row) return { success: false, error: 'Not found' }

    // Users can delete only their own; admins can delete anything
    if (role !== 'admin' && row.uploadedBy !== userId) {
      return { success: false, error: 'Unauthorized' }
    }

    // Remove from R2 first, then DB
    try {
      await deleteR2Object(row.key)
    } catch (err) {
      console.error('[media] R2 delete failed (continuing):', err)
    }

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id))

    revalidatePath('/admin/media')
    return { success: true }
  } catch (error) {
    console.error('[media] deleteMediaAsset error:', error)
    return { success: false, error: 'Could not delete' }
  }
}