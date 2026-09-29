import { Suspense } from 'react'
import ResetPasswordContent from './reset-password-content'

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center p-6">
          <span className="border-foreground/30 border-t-foreground h-6 w-6 animate-spin rounded-full border-2" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}