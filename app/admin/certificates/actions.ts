'use server'

import crypto from 'crypto'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { certificates, internships, user } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  PAGE_SIZE,
  certificateFormSchema,
  type CertificateDetail,
  type CertificateFilter,
  type CertificateInput,
  type CertificateRow,
  type InternshipOption,
  type UserOption,
} from './constants'

export type { CertificateRow, CertificateDetail, CertificateInput }

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
/*  Certificate number                                                         */
/*  Public verification code — e.g. INTR-2026-A1B2C3                          */
/* -------------------------------------------------------------------------- */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — readable

function generateCertificateNo() {
  const segment = (len: number) =>
    Array.from(
      { length: len },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('')

  return `INTR-${new Date().getFullYear()}-${segment(6)}`
}

/* -------------------------------------------------------------------------- */
/*  List                                                                       */
/* -------------------------------------------------------------------------- */

export async function getCertificates(
  page = 1,
  filter: CertificateFilter = 'all',
  query = ''
): Promise<{
  data: CertificateRow[]
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

    if (filter === 'issued') conditions.push(eq(certificates.status, 'issued'))
    if (filter === 'revoked')
      conditions.push(eq(certificates.status, 'revoked'))

    if (q) {
      conditions.push(
        or(
          ilike(certificates.title, `%${q}%`),
          ilike(certificates.certificateNo, `%${q}%`),
          ilike(user.name, `%${q}%`),
          ilike(user.email, `%${q}%`)
        )!
      )
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        id: certificates.id,
        certificateNo: certificates.certificateNo,
        title: certificates.title,
        description: certificates.description,
        imageUrl: certificates.imageUrl,
        userId: certificates.userId,
        userName: user.name,
        userEmail: user.email,
        internshipId: certificates.internshipId,
        internshipName: internships.name,
        status: certificates.status,
        issuedAt: certificates.issuedAt,
        expiresAt: certificates.expiresAt,
        createdAt: certificates.createdAt,
      })
      .from(certificates)
      .innerJoin(user, eq(certificates.userId, user.id))
      .leftJoin(internships, eq(certificates.internshipId, internships.id))
      .where(whereClause)
      .orderBy(desc(certificates.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)

    const totalResult = await db
      .select({ value: count() })
      .from(certificates)
      .innerJoin(user, eq(certificates.userId, user.id))
      .where(whereClause)

    const total = Number(totalResult[0]?.value ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return {
      data: rows.map((r) => ({
        id: r.id,
        certificateNo: r.certificateNo,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        internshipId: r.internshipId,
        internshipName: r.internshipName,
        status: r.status,
        issuedAt: r.issuedAt,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
      page: safePage,
      totalPages,
      total,
    }
  } catch (error) {
    console.error('[certificates] getCertificates error:', error)
    return { data: [], page: 1, totalPages: 1, total: 0 }
  }
}

/* -------------------------------------------------------------------------- */
/*  Single                                                                     */
/* -------------------------------------------------------------------------- */

export async function getCertificateById(
  id: string
): Promise<CertificateDetail | null> {
  try {
    await requireAdmin()

    const rows = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1)

    return rows[0] ?? null
  } catch (error) {
    console.error('[certificates] getCertificateById error:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Create / Update / Delete                                                   */
/* -------------------------------------------------------------------------- */

function normalize(input: CertificateInput) {
  return {
    userId: input.userId,
    title: input.title,
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    internshipId: input.internshipId || null,
    issuedAt: input.issuedAt ?? new Date(),
    expiresAt: input.expiresAt ?? null,
  }
}

export async function createCertificate(input: CertificateInput) {
  try {
    await requireAdmin()

    const parsed = certificateFormSchema.parse(input)

    const created = await db
      .insert(certificates)
      .values({
        id: crypto.randomUUID(),
        certificateNo: generateCertificateNo(),
        createdBy: input.userId,
        ...normalize(parsed),
      })
      .returning({ id: certificates.id })

    revalidatePath('/admin/certificates')
    // user side bhi turant reflect kare
    revalidatePath('/certificates')
    revalidatePath('/certificates/verify')

    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('createCertificate failed:', err)
    return { success: false as const, error: 'Failed to create certificate.' }
  }
}

export async function updateCertificate(id: string, input: CertificateInput) {
  try {
    await requireAdmin()

    const parsed = certificateFormSchema.parse(input)

    const updated = await db
      .update(certificates)
      .set(normalize(parsed))
      .where(eq(certificates.id, id))
      .returning({ id: certificates.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Certificate not found.' }
    }

    revalidatePath('/admin/certificates')
    revalidatePath(`/admin/certificates/${id}`)
    revalidatePath('/certificates')
    revalidatePath('/certificates/verify')

    return { success: true as const }
  } catch (err) {
    console.error('updateCertificate failed:', err)
    return { success: false as const, error: 'Failed to update certificate.' }
  }
}

export async function deleteCertificate(id: string) {
  try {
    await requireAdmin()

    const deleted = await db
      .delete(certificates)
      .where(eq(certificates.id, id))
      .returning({ id: certificates.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Certificate not found.' }
    }

    revalidatePath('/admin/certificates')
    revalidatePath('/certificates')
    revalidatePath('/certificates/verify')

    return { success: true as const }
  } catch (err) {
    console.error('deleteCertificate failed:', err)
    return { success: false as const, error: 'Failed to delete certificate.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Revoke / Reinstate                                                          */
/* -------------------------------------------------------------------------- */

export async function setCertificateStatus(
  id: string,
  status: 'issued' | 'revoked',
  reason?: string
): Promise<
  { success: true; status: 'issued' | 'revoked' } | { success: false; error: string }
> {
  try {
    await requireAdmin()

    const updated = await db
      .update(certificates)
      .set({
        status,
        revokeReason: status === 'revoked' ? reason || null : null,
      })
      .where(eq(certificates.id, id))
      .returning({ id: certificates.id, status: certificates.status })

    if (updated.length === 0) {
      return { success: false as const, error: 'Certificate not found.' }
    }

    revalidatePath('/admin/certificates')
    revalidatePath('/certificates')
    revalidatePath('/certificates/verify')

    return { success: true as const, status: updated[0].status }
  } catch (err) {
    console.error('setCertificateStatus failed:', err)
    return { success: false as const, error: 'Failed to update certificate.' }
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
    console.error('[certificates] getUsers error:', error)
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
    console.error('[certificates] getInternshipOptions error:', error)
    return []
  }
}