'use server'

import { desc, eq, ilike } from 'drizzle-orm'
import { headers } from 'next/headers'
import { and, type SQL } from 'drizzle-orm'

import { db } from '@/db'
import {
  certificates,
  internships,
  user,
  verificationRequests,
} from '@/db/schema'
import { auth } from '@/lib/auth'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MyCertificate = {
  id: string
  certificateNo: string
  title: string
  description: string | null
  imageUrl: string | null
  internshipName: string | null
  status: 'issued' | 'revoked'
  issuedAt: string
  expiresAt: string | null
  /** Set when the certificate is past its expiry date */
  isExpired: boolean
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

/* -------------------------------------------------------------------------- */
/*  My certificates                                                            */
/* -------------------------------------------------------------------------- */

export async function getMyCertificates(): Promise<MyCertificate[]> {
  const userId = await currentUserId()
  if (!userId) return []

  try {
    const rows = await db
      .select({
        id: certificates.id,
        certificateNo: certificates.certificateNo,
        title: certificates.title,
        description: certificates.description,
        imageUrl: certificates.imageUrl,
        internshipName: internships.name,
        status: certificates.status,
        issuedAt: certificates.issuedAt,
        expiresAt: certificates.expiresAt,
      })
      .from(certificates)
      .leftJoin(internships, eq(certificates.internshipId, internships.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.createdAt))
      .limit(100)

    const now = Date.now()

    return rows.map((r) => ({
      id: r.id,
      certificateNo: r.certificateNo,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      internshipName: r.internshipName,
      status: r.status,
      issuedAt: new Date(r.issuedAt).toISOString(),
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
      isExpired: r.expiresAt ? new Date(r.expiresAt).getTime() < now : false,
    }))
  } catch (error) {
    console.error('getMyCertificates error:', error)
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  Public verification                                                        */
/*  Certificate number se lookup — koi bhi (bina login) verify kar sakta hai. */
/* -------------------------------------------------------------------------- */

export type VerifiedCertificate = {
  found: true
  certificateNo: string
  title: string
  holderName: string
  issuedAt: string
  expiresAt: string | null
  status: 'issued' | 'revoked'
  isExpired: boolean
  revokeReason: string | null
  internshipName: string | null
}

export type VerifyResult =
  | VerifiedCertificate
  | { found: false; error: string }

export async function verifyCertificate(
  certificateNo: string
): Promise<VerifyResult> {
  const code = certificateNo.trim()
  if (!code) return { found: false, error: 'Enter a certificate number.' }

  try {
    const conditions: SQL[] = [
      eq(certificates.certificateNo, code),
      // Case-insensitive match so users don't fight with their keyboard
      ilike(certificates.certificateNo, code),
    ]

    const rows = await db
      .select({
        certificateNo: certificates.certificateNo,
        title: certificates.title,
        status: certificates.status,
        issuedAt: certificates.issuedAt,
        expiresAt: certificates.expiresAt,
        revokeReason: certificates.revokeReason,
        holderName: user.name,
        internshipName: internships.name,
      })
      .from(certificates)
      .innerJoin(user, eq(certificates.userId, user.id))
      .leftJoin(internships, eq(certificates.internshipId, internships.id))
      .where(and(...conditions))
      .limit(1)

    const row = rows[0]

    if (!row) {
      return {
        found: false,
        error: 'No certificate found with this number. Please check and retry.',
      }
    }

    return {
      found: true,
      certificateNo: row.certificateNo,
      title: row.title,
      holderName: row.holderName,
      issuedAt: new Date(row.issuedAt).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      status: row.status,
      isExpired: row.expiresAt
        ? new Date(row.expiresAt).getTime() < Date.now()
        : false,
      revokeReason: row.revokeReason,
      internshipName: row.internshipName,
    }
  } catch (error) {
    console.error('verifyCertificate error:', error)
    return {
      found: false,
      error: 'Could not verify right now. Please try again later.',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Verification requests (mine)                                              */
/* -------------------------------------------------------------------------- */

export type MyVerificationRequest = {
  id: string
  certificateNo: string | null
  certificateTitle: string | null
  verifierName: string
  verifierEmail: string
  organisation: string | null
  note: string | null
  reviewNote: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt: string | null
}

export async function getMyVerificationRequests(): Promise<
  MyVerificationRequest[]
> {
  const userId = await currentUserId()
  if (!userId) return []

  try {
    const rows = await db
      .select({
        id: verificationRequests.id,
        certificateNo: certificates.certificateNo,
        certificateTitle: certificates.title,
        verifierName: verificationRequests.verifierName,
        verifierEmail: verificationRequests.verifierEmail,
        organisation: verificationRequests.organisation,
        note: verificationRequests.note,
        reviewNote: verificationRequests.reviewNote,
        status: verificationRequests.status,
        createdAt: verificationRequests.createdAt,
        reviewedAt: verificationRequests.reviewedAt,
      })
      .from(verificationRequests)
      .leftJoin(
        certificates,
        eq(verificationRequests.certificateId, certificates.id)
      )
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(50)

    return rows.map((r) => ({
      id: r.id,
      certificateNo: r.certificateNo,
      certificateTitle: r.certificateTitle,
      verifierName: r.verifierName,
      verifierEmail: r.verifierEmail,
      organisation: r.organisation,
      note: r.note,
      reviewNote: r.reviewNote,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    }))
  } catch (error) {
    console.error('getMyVerificationRequests error:', error)
    return []
  }
}

export async function createVerificationRequest(input: {
  certificateId?: string | null
  verifierName: string
  verifierEmail: string
  organisation?: string | null
  note?: string | null
}): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Please log in first.' }

  try {
    const name = input.verifierName?.trim()
    const email = input.verifierEmail?.trim()

    if (!name) return { success: false, error: 'Verifier name is required.' }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Enter a valid verifier email.' }
    }

    const id = crypto.randomUUID()

    await db.insert(verificationRequests).values({
      id,
      userId,
      certificateId: input.certificateId || null,
      verifierName: name,
      verifierEmail: email,
      organisation: input.organisation?.trim() || null,
      note: input.note?.trim() || null,
    })

    return { success: true, id }
  } catch (error) {
    console.error('createVerificationRequest error:', error)
    return { success: false, error: 'Could not submit the request.' }
  }
}