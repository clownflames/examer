'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { ArrowLeft, MailCheck } from 'lucide-react'

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

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    const { error } = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(
        error.message ??
          'Could not send the reset email. Please try again.'
      )
      return
    }

    setSentTo(data.email)
    setSent(true)
    toast.success('Reset link sent — check your inbox.')
  }

  /* -------------------- SUCCESS STATE -------------------- */
  if (sent) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="bg-primary/10 border-primary/20 mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
              <MailCheck className="text-primary h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a password reset link to{' '}
              <span className="text-foreground font-medium">{sentTo}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm leading-relaxed">
              The link will expire in <strong>1 hour</strong>. If you
              don&apos;t see the email, check your spam or junk folder.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false)
                form.reset()
              }}
            >
              Send to a different email
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

  /* -------------------- FORM STATE -------------------- */
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            id="forgot-password-form"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup>
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="forgot-email"
                      type="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                    />
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
              form="forgot-password-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </Field>

          <p className="text-muted-foreground text-sm">
            Remember your password?{' '}
            <Link
              href="/login"
              className="text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}