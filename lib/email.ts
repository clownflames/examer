import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

if (!RESEND_API_KEY) {
  console.warn(
    '[email] RESEND_API_KEY is not set. Password reset emails will fail.'
  )
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/** Resend caps how many messages a single API call may carry. */
const RESEND_BATCH_LIMIT = 100

export function isEmailConfigured(): boolean {
  return resend !== null
}

/* -------------------------------------------------------------------------- */
/*  Exam ready notification                                                   */
/* -------------------------------------------------------------------------- */

export type ExamReadyEmail = {
  to: string
  userName: string | null
  examName: string
  internshipName: string
  examUrl: string
  durationMinutes: number
  totalMarks: number
  passingMarks: number | null
}

/**
 * Tells a student that a new exam is live for the internship they are
 * registered for.
 *
 * Returns Resend's message id on success so the caller can persist it and poll
 * real delivery status later. Never throws — the caller records the error on
 * the notification row instead.
 */
export async function sendExamReadyEmail(
  params: ExamReadyEmail
): Promise<{ id: string } | { error: string }> {
  if (!resend) {
    return { error: 'Email service is not configured.' }
  }

  const {
    to,
    userName,
    examName,
    internshipName,
    examUrl,
    durationMinutes,
    totalMarks,
    passingMarks,
  } = params

  const firstName = userName?.trim().split(/\s+/)[0] || 'there'
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  const durationLabel =
    hours > 0
      ? `${hours} hr${hours > 1 ? 's' : ''}${minutes ? ` ${minutes} min` : ''}`
      : `${minutes} min`
  const marksLabel = `${totalMarks} marks`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your exam is ready</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#71717a;letter-spacing:0.05em;text-transform:uppercase;">InternBird</p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">A new exam is ready for you</h1>
              <p style="margin:0 0 20px 0;font-size:14px;color:#52525b;line-height:1.6;">Hi ${firstName},</p>
              <p style="margin:0 0 20px 0;font-size:14px;color:#52525b;line-height:1.6;">
                We have just published a new exam for
                <strong style="color:#18181b;">${examName}</strong> as part of your
                <strong style="color:#18181b;">${internshipName}</strong> programme.
                You are registered for it, so the exam is now waiting for you.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#71717a;letter-spacing:0.05em;text-transform:uppercase;">Exam details</p>
                    <p style="margin:0 0 4px 0;font-size:14px;color:#18181b;"><strong>Exam</strong> &middot; ${examName}</p>
                    <p style="margin:0 0 4px 0;font-size:14px;color:#18181b;"><strong>Duration</strong> &middot; ${durationLabel}</p>
                    <p style="margin:0 0 4px 0;font-size:14px;color:#18181b;"><strong>Total marks</strong> &middot; ${marksLabel}</p>
                    ${
                      passingMarks != null
                        ? `<p style="margin:0;font-size:14px;color:#18181b;"><strong>Passing marks</strong> &middot; ${passingMarks}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 40px 8px 40px;">
              <a href="${examUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
                Go to Exam
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 24px 40px;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#71717a;line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;color:#10b981;word-break:break-all;line-height:1.6;">${examUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 32px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:16px 0 0 0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Please attempt the exam before its deadline. If you have any
                questions about your eligibility, just reply to this email and
                our team will help you out.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0 0;font-size:11px;color:#a1a1aa;">
          &copy; ${new Date().getFullYear()} InternBird. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Hi ${firstName},

A new exam is ready for you.

Exam: ${examName}
Programme: ${internshipName}
Duration: ${durationLabel}
Total marks: ${marksLabel}${passingMarks != null ? `\nPassing marks: ${passingMarks}` : ''}

You are registered for this programme, so the exam is waiting for you:
${examUrl}

Please attempt it before the deadline. If you have any questions about your
eligibility, just reply to this email.

— InternBird`

  try {
    const { data, error } = await resend.emails.send({
      from: `InternBird <${FROM_EMAIL}>`,
      to,
      subject: `New exam ready: ${examName}`,
      html,
      text,
    })

    if (error) {
      console.error('[email] exam-ready send failed:', error)
      return { error: error.message ?? 'Email provider rejected the message.' }
    }

    if (!data?.id) {
      return { error: 'Email provider did not return a message id.' }
    }

    return { id: data.id }
  } catch (err) {
    console.error('[email] exam-ready send threw:', err)
    return {
      error:
        err instanceof Error ? err.message : 'Unknown error while sending email.',
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delivery status                                                            */
/* -------------------------------------------------------------------------- */

export type ProviderDeliveryStatus =
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'sent'
  | 'queued'

/**
 * Asks Resend what happened to a message we previously sent. Returns null when
 * the provider has no record of it (e.g. still settling).
 */
export async function getEmailDeliveryStatus(
  providerId: string
): Promise<ProviderDeliveryStatus | null> {
  if (!resend) return null

  try {
    const { data, error } = await resend.emails.get(providerId)
    if (error) {
      console.error('[email] delivery lookup failed:', error)
      return null
    }

    const status = data?.last_event
    switch (status) {
      case 'delivered':
        return 'delivered'
      case 'bounced':
        return 'bounced'
      case 'complained':
        return 'complained'
      case 'sent':
        return 'sent'
      case 'queued':
        return 'queued'
      default:
        return null
    }
  } catch (err) {
    console.error('[email] delivery lookup threw:', err)
    return null
  }
}

export { RESEND_BATCH_LIMIT }

/* -------------------------------------------------------------------------- */
/*  Send password reset email                                                  */
/* -------------------------------------------------------------------------- */

export async function sendPasswordResetEmail(params: {
  to: string
  userName: string | null
  resetUrl: string
}): Promise<void> {
  if (!resend) {
    console.error('[email] Resend not configured — skipping send')
    throw new Error('Email service is not configured.')
  }

  const { to, userName, resetUrl } = params
  const displayName = userName?.trim() || 'there'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#71717a;letter-spacing:0.05em;text-transform:uppercase;">InternBird</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">Reset your password</h1>
              <p style="margin:0 0 8px 0;font-size:14px;color:#52525b;line-height:1.6;">Hi ${displayName},</p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#52525b;line-height:1.6;">
                We received a request to reset the password for your InternBird account. Click the button below to choose a new one.
              </p>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td align="center" style="padding:0 40px 24px 40px;">
              <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
                Reset Password
              </a>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#71717a;line-height:1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;color:#10b981;word-break:break-all;line-height:1.6;">
                ${resetUrl}
              </p>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding:0 40px 32px 40px;border-top:1px solid #e4e4e7;padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                This link will expire in 1 hour. If you didn&apos;t request a password reset, you can safely ignore this email — your password will not change.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0 0;font-size:11px;color:#a1a1aa;">
          © ${new Date().getFullYear()} InternBird. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `Hi ${displayName},

We received a request to reset your InternBird password.

Open this link to choose a new one:
${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

— InternBird`

  const { error } = await resend.emails.send({
    from: `InternBird <${FROM_EMAIL}>`,
    to,
    subject: 'Reset your InternBird password',
    html,
    text,
  })

  if (error) {
    console.error('[email] Resend send failed:', error)
    throw new Error(error.message ?? 'Failed to send reset email.')
  }
}