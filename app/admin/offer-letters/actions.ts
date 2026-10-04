'use server'

import crypto from 'crypto'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { internships, offerLetters, user } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  buildOfferLetterKey,
  getPublicUrl,
  getUploadPresignedUrl,
} from '@/lib/r2'
import {
  PAGE_SIZE,
  offerLetterFormSchema,
  type InternshipOption,
  type OfferLetterDetail,
  type OfferLetterFilter,
  type OfferLetterInput,
  type OfferLetterRow,
  type OfferLetterStatus,
  type UserOption,
} from './constants'

export type { OfferLetterRow, OfferLetterDetail, OfferLetterInput }

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
/*  Offer number                                                               */
/*  Public reference code — e.g. OFFR-2026-A1B2C3                              */
/* -------------------------------------------------------------------------- */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — readable

function generateOfferNo() {
  const segment = (len: number) =>
    Array.from(
      { length: len },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('')

  return `OFFR-${new Date().getFullYear()}-${segment(6)}`
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getOfferLetters(
  page = 1,
  filter: OfferLetterFilter = 'all',
  query = ''
): Promise<{
  data: OfferLetterRow[]
  page: number
  totalPages: number
  total: number
}> {
  try {
    await requireAdmin()

    const safePage = Math.max(1, Math.floor(page) || 1)
    const offset = (safePage - 1) * PAGE_SIZE
    const q = query.trim()

    const conditions: SQL[] = []

    if (filter !== 'all') {
      conditions.push(eq(offerLetters.status, filter))
    }

    if (q) {
      conditions.push(
        or(
          ilike(offerLetters.offerNo, `%${q}%`),
          ilike(offerLetters.companyName, `%${q}%`),
          ilike(offerLetters.designation, `%${q}%`),
          ilike(user.name, `%${q}%`),
          ilike(user.email, `%${q}%`)
        )!
      )
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        id: offerLetters.id,
        offerNo: offerLetters.offerNo,
        companyName: offerLetters.companyName,
        designation: offerLetters.designation,
        location: offerLetters.location,
        compensation: offerLetters.compensation,
        status: offerLetters.status,
        userId: offerLetters.userId,
        userName: user.name,
        userEmail: user.email,
        internshipId: offerLetters.internshipId,
        internshipName: internships.name,
        issuedAt: offerLetters.issuedAt,
        expiresAt: offerLetters.expiresAt,
        createdAt: offerLetters.createdAt,
      })
      .from(offerLetters)
      .innerJoin(user, eq(offerLetters.userId, user.id))
      .leftJoin(internships, eq(offerLetters.internshipId, internships.id))
      .where(whereClause)
      .orderBy(desc(offerLetters.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(offerLetters)
      .innerJoin(user, eq(offerLetters.userId, user.id))
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return {
      data: rows.map((r) => ({
        id: r.id,
        offerNo: r.offerNo,
        companyName: r.companyName,
        designation: r.designation,
        location: r.location,
        compensation: r.compensation,
        status: r.status,
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        internshipId: r.internshipId,
        internshipName: r.internshipName,
        issuedAt: r.issuedAt,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
      page: safePage,
      totalPages,
      total,
    }
  } catch (error) {
    console.error('[offer-letters] getOfferLetters error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Single                                                                     */
/* -------------------------------------------------------------------------- */

export async function getOfferLetterById(
  id: string
): Promise<OfferLetterDetail | null> {
  try {
    await requireAdmin()

    const rows = await db
      .select()
      .from(offerLetters)
      .where(eq(offerLetters.id, id))
      .limit(1)

    return rows[0] ?? null
  } catch (error) {
    console.error('[offer-letters] getOfferLetterById error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Create / Update / Delete                                                   */
/* -------------------------------------------------------------------------- */

function normalize(input: OfferLetterInput) {
  return {
    userId: input.userId,
    internshipId: input.internshipId || null,
    companyName: input.companyName,
    designation: input.designation,
    location: input.location || null,
    compensation: input.compensation || null,
    joiningDate: input.joiningDate ?? null,
    duration: input.duration || null,
    body: input.body || null,
    pdfUrl: input.pdfUrl || null,
    issuedAt: input.issuedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    status: input.status,
  }
}

export async function createOfferLetter(input: OfferLetterInput) {
  try {
    await requireAdmin()

    const parsed = offerLetterFormSchema.parse(input)

    const created = await db
      .insert(offerLetters)
      .values({
        id: crypto.randomUUID(),
        offerNo: generateOfferNo(),
        createdBy: input.userId,
        ...normalize(parsed),
      })
      .returning({ id: offerLetters.id })

    revalidatePath('/admin/offer-letters')
    // user side bhi turant reflect kare
    revalidatePath('/offer-letters')
    revalidatePath('/offer-letters/verify')

    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('createOfferLetter failed:', err)
    return { success: false as const, error: 'Failed to create offer letter.' }
  }
}

export async function updateOfferLetter(id: string, input: OfferLetterInput) {
  try {
    await requireAdmin()

    const parsed = offerLetterFormSchema.parse(input)

    const updated = await db
      .update(offerLetters)
      .set(normalize(parsed))
      .where(eq(offerLetters.id, id))
      .returning({ id: offerLetters.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Offer letter not found.' }
    }

    revalidatePath('/admin/offer-letters')
    revalidatePath('/offer-letters')
    revalidatePath('/offer-letters/verify')

    return { success: true as const }
  } catch (err) {
    console.error('updateOfferLetter failed:', err)
    return { success: false as const, error: 'Failed to update offer letter.' }
  }
}

export async function deleteOfferLetter(id: string) {
  try {
    await requireAdmin()

    const deleted = await db
      .delete(offerLetters)
      .where(eq(offerLetters.id, id))
      .returning({ id: offerLetters.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Offer letter not found.' }
    }

    revalidatePath('/admin/offer-letters')
    revalidatePath('/offer-letters')
    revalidatePath('/offer-letters/verify')

    return { success: true as const }
  } catch (err) {
    console.error('deleteOfferLetter failed:', err)
    return { success: false as const, error: 'Failed to delete offer letter.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Status change (issue / revoke / reinstate)                                 */
/* -------------------------------------------------------------------------- */

export async function setOfferLetterStatus(
  id: string,
  status: OfferLetterStatus,
  reason?: string
): Promise<
  { success: true; status: OfferLetterStatus } | { success: false; error: string }
> {
  try {
    await requireAdmin()

    const updated = await db
      .update(offerLetters)
      .set({
        status,
        // Revoke hote waqt reason audit ke liye rakha jaata hai
        revokeReason: status === 'revoked' ? reason || null : null,
        // Issue karte waqt issuedAt set ho jaata hai
        issuedAt:
          status === 'issued' ? new Date() : undefined,
      })
      .where(eq(offerLetters.id, id))
      .returning({ id: offerLetters.id, status: offerLetters.status })

    if (updated.length === 0) {
      return { success: false as const, error: 'Offer letter not found.' }
    }

    revalidatePath('/admin/offer-letters')
    revalidatePath('/offer-letters')
    revalidatePath('/offer-letters/verify')

    return { success: true as const, status: updated[0].status }
  } catch (err) {
    console.error('setOfferLetterStatus failed:', err)
    return { success: false as const, error: 'Failed to update offer letter.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Presigned upload (generated PDF ya uploaded file)                          */
/* -------------------------------------------------------------------------- */

export async function getOfferLetterUploadUrl(
  input: {
    offerLetterId?: string | null
    fileName: string
    contentType: string
  }
): Promise<
  | { success: true; uploadUrl: string; publicUrl: string }
  | { success: false; error: string }
> {
  try {
    await requireAdmin()

    if (!input.fileName || !input.contentType) {
      return { success: false, error: 'Missing file info.' }
    }

    const isPdf = input.contentType === 'application/pdf'
    const isImage = input.contentType.startsWith('image/')

    if (!isPdf && !isImage) {
      return { success: false, error: 'Only PDF or image files are allowed.' }
    }

    // Naye letter ke liye temporary id — record create hone ke baad
    // final key alag banegi, par yahi key kaafi hai
    const key = buildOfferLetterKey(
      input.offerLetterId || crypto.randomUUID(),
      input.fileName
    )

    const uploadUrl = await getUploadPresignedUrl(key, input.contentType)

    return { success: true, uploadUrl, publicUrl: getPublicUrl(key) }
  } catch (error) {
    console.error('[offer-letters] getOfferLetterUploadUrl error:', error)
    return { success: false, error: 'Could not prepare upload.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Options (for the form dropdowns)                                           */
/* -------------------------------------------------------------------------- */

export async function getUsers(): Promise<UserOption[]> {
  try {
    await requireAdmin()

    return await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .orderBy(user.name)
      .limit(500)
  } catch (error) {
    console.error('[offer-letters] getUsers error:', error)
    return []
  }
}

export async function getInternshipOptions(): Promise<InternshipOption[]> {
  try {
    await requireAdmin()

    return await db
      .select({ id: internships.id, name: internships.name })
      .from(internships)
      .orderBy(internships.name)
  } catch (error) {
    console.error('[offer-letters] getInternshipOptions error:', error)
    return []
  }
}