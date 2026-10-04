'use server'

import { and, desc, eq, ilike } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import {
  internships,
  offerLetters,
  user as userTable,
} from '@/db/schema'
import { auth } from '@/lib/auth'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MyOfferLetter = {
  id: string
  offerNo: string
  companyName: string
  designation: string
  location: string | null
  compensation: string | null
  joiningDate: string | null
  duration: string | null
  body: string | null
  pdfUrl: string | null
  status: 'draft' | 'issued' | 'accepted' | 'declined' | 'revoked'
  internshipName: string | null
  issuedAt: string | null
  expiresAt: string | null
  respondedAt: string | null
  declineReason: string | null
  revokeReason: string | null
  isExpired: boolean
  /** Sirf `issued` status me user respond kar sakta hai */
  canRespond: boolean
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

/* -------------------------------------------------------------------------- */
/*  My offer letters                                                           */
/*  Drafts user ko nahi dikhte — sirf admin ke liye hain.                       */
/* -------------------------------------------------------------------------- */

export async function getMyOfferLetters(): Promise<MyOfferLetter[]> {
  const userId = await currentUserId()
  if (!userId) return []

  try {
    const rows = await db
      .select({
        id: offerLetters.id,
        offerNo: offerLetters.offerNo,
        companyName: offerLetters.companyName,
        designation: offerLetters.designation,
        location: offerLetters.location,
        compensation: offerLetters.compensation,
        joiningDate: offerLetters.joiningDate,
        duration: offerLetters.duration,
        body: offerLetters.body,
        pdfUrl: offerLetters.pdfUrl,
        status: offerLetters.status,
        internshipName: internships.name,
        issuedAt: offerLetters.issuedAt,
        expiresAt: offerLetters.expiresAt,
        respondedAt: offerLetters.respondedAt,
        declineReason: offerLetters.declineReason,
        revokeReason: offerLetters.revokeReason,
      })
      .from(offerLetters)
      .leftJoin(internships, eq(offerLetters.internshipId, internships.id))
      .where(eq(offerLetters.userId, userId))
      .orderBy(desc(offerLetters.createdAt))
      .limit(100)

    const now = Date.now()

    return rows
      // Drafts user se chhupaye rehte hain
      .filter((r) => r.status !== 'draft')
      .map((r) => {
        const isExpired = r.expiresAt
          ? new Date(r.expiresAt).getTime() < now
          : false

        return {
          id: r.id,
          offerNo: r.offerNo,
          companyName: r.companyName,
          designation: r.designation,
          location: r.location,
          compensation: r.compensation,
          joiningDate: r.joiningDate
            ? new Date(r.joiningDate).toISOString()
            : null,
          duration: r.duration,
          body: r.body,
          pdfUrl: r.pdfUrl,
          status: r.status,
          internshipName: r.internshipName,
          issuedAt: r.issuedAt ? new Date(r.issuedAt).toISOString() : null,
          expiresAt: r.expiresAt
            ? new Date(r.expiresAt).toISOString()
            : null,
          respondedAt: r.respondedAt
            ? new Date(r.respondedAt).toISOString()
            : null,
          declineReason: r.declineReason,
          revokeReason: r.revokeReason,
          isExpired,
          // Deadline nikalne ke baad respond nahi kar sakte
          canRespond: r.status === 'issued' && !isExpired,
        }
      })
  } catch (error) {
    console.error('getMyOfferLetters error:', error)
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  Respond — accept / decline                                                 */
/* -------------------------------------------------------------------------- */

export async function respondToOfferLetter(
  id: string,
  response: 'accepted' | 'declined',
  reason?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { success: false, error: 'Please log in first.' }

  try {
    // Sirf apni hi letter par respond kar sakta hai
    const rows = await db
      .select({
        id: offerLetters.id,
        status: offerLetters.status,
        expiresAt: offerLetters.expiresAt,
      })
      .from(offerLetters)
      .where(
        and(
          eq(offerLetters.id, id),
          eq(offerLetters.userId, userId)
        )
      )
      .limit(1)

    const letter = rows[0]

    if (!letter) {
      return { success: false, error: 'Offer letter not found.' }
    }

    if (letter.status !== 'issued') {
      return {
        success: false,
        error: 'This offer can no longer be responded to.',
      }
    }

    if (letter.expiresAt && new Date(letter.expiresAt).getTime() < Date.now()) {
      return { success: false, error: 'This offer has expired.' }
    }

    await db
      .update(offerLetters)
      .set({
        status: response,
        respondedAt: new Date(),
        declineReason: response === 'declined' ? reason?.trim() || null : null,
      })
      .where(eq(offerLetters.id, id))

    revalidatePath('/offer-letters')
    revalidatePath('/offer-letters/verify')

    return { success: true }
  } catch (error) {
    console.error('respondToOfferLetter error:', error)
    return { success: false, error: 'Could not submit your response.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Public verification                                                        */
/* -------------------------------------------------------------------------- */

export type VerifiedOfferLetter = {
  found: true
  offerNo: string
  companyName: string
  designation: string
  location: string | null
  compensation: string | null
  candidateName: string
  issuedAt: string | null
  expiresAt: string | null
  status: MyOfferLetter['status']
  isExpired: boolean
  isOpen: boolean
  revokeReason: string | null
  internshipName: string | null
}

export type VerifyOfferResult =
  | VerifiedOfferLetter
  | { found: false; error: string }

export async function verifyOfferLetter(
  offerNo: string
): Promise<VerifyOfferResult> {
  const code = offerNo.trim()
  if (!code) return { found: false, error: 'Enter an offer reference number.' }

  try {
    const rows = await db
      .select({
        offerNo: offerLetters.offerNo,
        companyName: offerLetters.companyName,
        designation: offerLetters.designation,
        location: offerLetters.location,
        compensation: offerLetters.compensation,
        status: offerLetters.status,
        issuedAt: offerLetters.issuedAt,
        expiresAt: offerLetters.expiresAt,
        revokeReason: offerLetters.revokeReason,
        candidateName: userTable.name,
        internshipName: internships.name,
      })
      .from(offerLetters)
      .innerJoin(userTable, eq(offerLetters.userId, userTable.id))
      .leftJoin(internships, eq(offerLetters.internshipId, internships.id))
      .where(
        // Case-insensitive match — users keyboard se type karte hain
        ilike(offerLetters.offerNo, code)
      )
      .limit(1)

    const row = rows[0]

    if (!row) {
      return {
        found: false,
        error: 'No offer letter found with this reference. Please check and retry.',
      }
    }

    const isExpired = row.expiresAt
      ? new Date(row.expiresAt).getTime() < Date.now()
      : false

    return {
      found: true,
      offerNo: row.offerNo,
      companyName: row.companyName,
      designation: row.designation,
      location: row.location,
      compensation: row.compensation,
      candidateName: row.candidateName,
      issuedAt: row.issuedAt ? new Date(row.issuedAt).toISOString() : null,
      expiresAt: row.expiresAt
        ? new Date(row.expiresAt).toISOString()
        : null,
      status: row.status,
      isExpired,
      // Issued + not expired + not revoked/declined
      isOpen: row.status === 'issued' && !isExpired,
      revokeReason: row.revokeReason,
      internshipName: row.internshipName,
    }
  } catch (error) {
    console.error('verifyOfferLetter error:', error)
    return {
      found: false,
      error: 'Could not verify right now. Please try again later.',
    }
  }
}