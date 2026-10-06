import { and, count, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/db'
import { examNotifications, payments, user } from '@/db/schema'
import {
  getEmailDeliveryStatus,
  isEmailConfigured,
  sendExamReadyEmail,
  type ProviderDeliveryStatus,
} from '@/lib/email'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type NotificationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained'

export type NotificationRow = {
  id: string
  userId: string
  studentName: string
  email: string
  status: NotificationStatus
  providerId: string | null
  error: string | null
  attempts: number
  sentAt: string | null
  deliveredAt: string | null
  createdAt: string
}

export type NotificationSummary = {
  total: number
  delivered: number
  sent: number
  queued: number
  failed: number
  bounced: number
  complained: number
  /** Every recipient whose email is confirmed to have landed. */
  deliveredTo: number
}

/**
 * Where the "Go to Exam" link should point.
 *
 * Order matters: explicit config first, then the platform's own value.
 * VERCEL_PROJECT_PRODUCTION_URL is preferred over VERCEL_URL because the
 * latter is the per-deployment preview domain, which is not what a student
 * should be clicking months later.
 *
 * Returns null in production if we cannot prove a real public host — see
 * `resolveSiteUrl`.
 */
function resolveSiteUrl(): string | null {
  const candidate =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    // Local development only.
    'http://localhost:3000'

  const url = candidate.replace(/\/$/, '')

  const isLocal =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(url)

  // Never ship a localhost link to a real student's inbox: the mail would be
  // accepted and "delivered", then dead on arrival with nothing logged.
  if (isLocal && process.env.NODE_ENV === 'production') {
    return null
  }

  return url
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Who gets the email: every student with a PAID registration for the exam's
 * internship. That is the same gate the student-facing exam list uses, so we
 * never mail somebody who cannot open the exam.
 *
 * selectDistinct matters — a student can have several paid rows (e.g. a
 * retried or duplicated payment) and must still receive one email.
 */
async function paidStudentsFor(internshipId: string) {
  return db
    .selectDistinct({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .innerJoin(
      payments,
      and(
        eq(payments.userId, user.id),
        eq(payments.internshipId, internshipId),
        eq(payments.status, 'paid')
      )
    )
    .where(and(eq(user.role, 'user'), sql`${user.email} <> ''`))
}

/* -------------------------------------------------------------------------- */
/*  Send                                                                       */
/* -------------------------------------------------------------------------- */

export type SendResult = {
  examId: string
  recipients: number
  sent: number
  failed: number
  /** True when nothing was attempted because email is not configured. */
  skipped: boolean
  message?: string
}

/** Per-exam delivery counts, shaped for the admin table. */
export type ExamNotificationCounts = Record<
  string,
  { total: number; delivered: number; failed: number }
>

/**
 * Writes one queued row per paid student, then sends. Rows are written BEFORE
 * sending so a crash mid-send still leaves an auditable record of who was
 * supposed to be notified.
 */
export async function notifyStudentsOfExam(params: {
  examId: string
  examName: string
  internshipName: string
  internshipId: string
  durationMinutes: number
  totalMarks: number
  passingMarks: number | null
}): Promise<SendResult> {
  const {
    examId,
    examName,
    internshipName,
    internshipId,
    durationMinutes,
    totalMarks,
    passingMarks,
  } = params

  const recipients = await paidStudentsFor(internshipId)

  if (recipients.length === 0) {
    return {
      examId,
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: false,
      message: 'No students have a paid registration for this internship yet.',
    }
  }

  // ---- 1. one row per student, before any send ----
  await db
    .insert(examNotifications)
    .values(
      recipients.map((r) => ({
        id: crypto.randomUUID(),
        examId,
        userId: r.id,
        recipientEmail: r.email,
        status: 'queued' as const,
        attempts: 0,
      }))
    )
    .onConflictDoUpdate({
      // Re-notifying resets the attempt so a retried recipient is not skipped.
      target: [examNotifications.examId, examNotifications.userId],
      set: {
        recipientEmail: sql`excluded.recipient_email`,
        status: 'queued',
        error: null,
        attempts: 0,
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        providerId: null,
        updatedAt: new Date(),
      },
    })

  /**
   * Refuse to send rather than mail every student a dead link. The rows are
   * already written as 'failed' with the reason, so this is visible in the
   * admin Emails drawer instead of silently succeeding.
   */
  const siteUrl = resolveSiteUrl()

  const blockers: string[] = []

  if (!isEmailConfigured()) {
    blockers.push(
      'Email service is not configured (RESEND_API_KEY is missing).'
    )
  }

  if (!siteUrl) {
    blockers.push(
      'No public site URL is configured, so the email would contain a localhost link. Set BETTER_AUTH_URL (or NEXT_PUBLIC_SITE_URL) to your production domain.'
    )
  }

  if (blockers.length > 0) {
    await db
      .update(examNotifications)
      .set({
        status: 'failed',
        error: blockers.join(' '),
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(examNotifications.examId, examId))

    return {
      examId,
      recipients: recipients.length,
      sent: 0,
      failed: recipients.length,
      skipped: true,
      message: `No emails were sent. ${blockers.join(' ')}`,
    }
  }

  // ---- 2. send one by one so a single bad address cannot fail the batch ----
  const examUrl = `${siteUrl}/internships`

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const row = await db
      .select({ id: examNotifications.id })
      .from(examNotifications)
      .where(
        and(
          eq(examNotifications.examId, examId),
          eq(examNotifications.userId, recipient.id)
        )
      )
      .limit(1)

    const notificationId = row[0]?.id
    if (!notificationId) continue

    const result = await sendExamReadyEmail({
      to: recipient.email,
      userName: recipient.name,
      examName,
      internshipName,
      examUrl,
      durationMinutes,
      totalMarks,
      passingMarks,
    })

    if ('id' in result) {
      sent += 1
      await db
        .update(examNotifications)
        .set({
          status: 'sent',
          providerId: result.id,
          error: null,
          sentAt: new Date(),
          failedAt: null,
          attempts: sql`${examNotifications.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(examNotifications.id, notificationId))
    } else {
      failed += 1
      await db
        .update(examNotifications)
        .set({
          status: 'failed',
          error: result.error.slice(0, 1000),
          failedAt: new Date(),
          attempts: sql`${examNotifications.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(examNotifications.id, notificationId))
    }
  }

  return { examId, recipients: recipients.length, sent, failed, skipped: false }
}

/* -------------------------------------------------------------------------- */
/*  Delivery sync                                                              */
/* -------------------------------------------------------------------------- */

export type SyncResult = {
  checked: number
  updated: number
  /** Provider gave us nothing usable for these. */
  unknown: number
}

/**
 * Polls the provider for every notification that is still in flight and
 * records what it finds. Safe to run any number of times.
 */
export async function syncDeliveryStatuses(examId?: string): Promise<SyncResult> {
  const pending = await db
    .select({
      id: examNotifications.id,
      providerId: examNotifications.providerId,
    })
    .from(examNotifications)
    .where(
      and(
        examId ? eq(examNotifications.examId, examId) : undefined,
        isNotNull(examNotifications.providerId),
        sql`${examNotifications.status} not in ('delivered', 'bounced', 'complained')`
      )
    )

  let updated = 0
  let unknown = 0

  for (const row of pending) {
    const status: ProviderDeliveryStatus | null = await getEmailDeliveryStatus(
      row.providerId as string
    )

    if (!status) {
      unknown += 1
      continue
    }

    await db
      .update(examNotifications)
      .set({
        status,
        error:
          status === 'bounced' || status === 'complained'
            ? `Mailbox rejected the message (${status}).`
            : null,
        deliveredAt: status === 'delivered' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(examNotifications.id, row.id))

    updated += 1
  }

  return { checked: pending.length, updated, unknown }
}

/* -------------------------------------------------------------------------- */
/*  Read                                                                       */
/* -------------------------------------------------------------------------- */

export async function getNotificationSummary(
  examId: string
): Promise<NotificationSummary> {
  const rows = await db
    .select({
      status: examNotifications.status,
      n: sql<number>`count(*)::int`,
    })
    .from(examNotifications)
    .where(eq(examNotifications.examId, examId))
    .groupBy(examNotifications.status)

  const summary: NotificationSummary = {
    total: 0,
    delivered: 0,
    sent: 0,
    queued: 0,
    failed: 0,
    bounced: 0,
    complained: 0,
    deliveredTo: 0,
  }

  for (const r of rows) {
    const n = Number(r.n ?? 0)
    summary[r.status] = n
    summary.total += n
  }
  summary.deliveredTo = summary.delivered
  return summary
}

export async function getNotificationsForExam(
  examId: string
): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: examNotifications.id,
      userId: examNotifications.userId,
      studentName: user.name,
      email: examNotifications.recipientEmail,
      status: examNotifications.status,
      providerId: examNotifications.providerId,
      error: examNotifications.error,
      attempts: examNotifications.attempts,
      sentAt: examNotifications.sentAt,
      deliveredAt: examNotifications.deliveredAt,
      createdAt: examNotifications.createdAt,
    })
    .from(examNotifications)
    .leftJoin(user, eq(examNotifications.userId, user.id))
    .where(eq(examNotifications.examId, examId))
    .orderBy(examNotifications.createdAt)

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    studentName: r.studentName ?? 'Unknown student',
    email: r.email,
    status: r.status,
    providerId: r.providerId,
    error: r.error,
    attempts: r.attempts,
    sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
    deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  }))
}

/**
 * Per-exam delivery counts for the admin table, so the list can show
 * "12/15 delivered" without a query per row.
 */
export async function getNotificationCountsByExam(): Promise<ExamNotificationCounts> {
  const rows = await db
    .select({
      examId: examNotifications.examId,
      total: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${examNotifications.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${examNotifications.status} in ('failed', 'bounced', 'complained'))::int`,
    })
    .from(examNotifications)
    .groupBy(examNotifications.examId)

  const out: ExamNotificationCounts = {}
  for (const r of rows) {
    out[r.examId] = {
      total: Number(r.total ?? 0),
      delivered: Number(r.delivered ?? 0),
      failed: Number(r.failed ?? 0),
    }
  }
  return out
}

/** How many notifications across the whole site still need a delivery check. */
export async function countPendingDeliveryChecks(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(examNotifications)
    .where(
      and(
        isNotNull(examNotifications.providerId),
        sql`${examNotifications.status} not in ('delivered', 'bounced', 'complained')`
      )
    )
  return Number(row?.n ?? 0)
}