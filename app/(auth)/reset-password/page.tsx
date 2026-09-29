'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password must be at most 72 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const token = searchParams.get('token')
  const tokenError = searchParams.get('error')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  // If better-auth redirected back with an error param, show it once
  useEffect(() => {
    if (tokenError) {
      toast.error('This reset link is invalid or has expired.')
    }
  }, [tokenError])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (!token) {
      toast.error('Missing reset token.')
      return
    }

    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    })

    if (error) {
      toast.error(
        error.message ?? 'Could not reset your password. Please try again.'
      )
      return
    }

    setSuccess(true)
    toast.success('Password updated successfully.')

    // Give them a moment to see the success state, then send to login
    setTimeout(() => {
      router.replace('/login')
    }, 2500)
  }

  /* -------------------- NO TOKEN / INVALID -------------------- */
  if (!token) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="bg-destructive/10 border-destructive/20 mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
              <AlertCircle className="text-destructive h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-3">
            <Button
              className="w-full"
              render={<Link href="/forgot-password" />}
            >
              Request a new link
            </Button>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  /* -------------------- SUCCESS -------------------- */
  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="border-emerald-500/20 bg-emerald-500/10 mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl">Password updated</CardTitle>
            <CardDescription>
              Your password has been reset successfully. Redirecting you to
              sign in…
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" render={<Link href="/login" />}>
              Go to sign in
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  /* -------------------- FORM -------------------- */
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>
            Choose a strong password you haven&apos;t used before.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            id="reset-password-form"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup>
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="reset-password">
                      New password
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        {...field}
                        id="reset-password"
                        type={showPassword ? 'text' : 'password'}
                        aria-invalid={fieldState.invalid}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="reset-password-confirm">
                      Confirm password
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        {...field}
                        id="reset-password-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        aria-invalid={fieldState.invalid}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((s) => !s)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                        aria-label={
                          showConfirm ? 'Hide password' : 'Show password'
                        }
                        tabIndex={-1}
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-4">
          <Field
            orientation="horizontal"
            className="w-full justify-end gap-2"
          >
            <Button
              type="button"
              variant="outline"
              render={<Link href="/login" />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? 'Updating…'
                : 'Update password'}
            </Button>
          </Field>
        </CardFooter>
      </Card>
    </div>
  )
}