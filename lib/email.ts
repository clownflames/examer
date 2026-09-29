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