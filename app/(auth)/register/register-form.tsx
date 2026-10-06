'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AddUser } from './actions'
import { authClient } from '@/lib/auth-client'

const formSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters.')
      .max(50, 'Name must be at most 50 characters.'),
    email: z.string().email('Please enter a valid email address.'),
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

function Registration({
  googleEnabled = true,
}: {
  /**
   * Whether Google credentials are configured on the server.
   *
   * Passed in from the server page so the button can be hidden instead of
   * shown and then failing, and so the client bundle never has to know whether
   * credentials exist.
   */
  googleEnabled?: boolean;
}) {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    const result = await AddUser({
      name: data.name,
      email: data.email,
      password: data.password,
    })

    if (result === 'User Created Successfully') {
      toast.success('Account created! Please sign in.')
      router.replace('/login')
      return
    }

    toast.error(result ?? 'Something went wrong')
  }

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true)
      await authClient.signIn.social({
        provider: 'google',
        // Same dispatcher the login page uses. It used to point at /dashboard,
        // which does not exist — every Google signup ended on a 404.
        callbackURL: '/auth/redirect',
        errorCallbackURL: '/register',
      })
    } catch (err) {
      console.error('Google sign-in failed:', err)
      toast.error('Could not sign in with Google. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Create an Account</CardTitle>
            <CardDescription>
              Sign up to get started in less than a minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Hidden when Google is not configured, so nobody taps a button
                that can only fail. */}
            {googleEnabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || form.formState.isSubmitting}
                >
                  {googleLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Connecting…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <GoogleIcon className="h-4 w-4" />
                      Continue with Google
                    </span>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
              </>
            ) : null}

            <form
              id="registration-form"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FieldGroup>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
                      <Input
                        {...field}
                        id="reg-name"
                        aria-invalid={fieldState.invalid}
                        placeholder="John Doe"
                        autoComplete="name"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reg-email">Email</FieldLabel>
                      <Input
                        {...field}
                        id="reg-email"
                        type="email"
                        aria-invalid={fieldState.invalid}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reg-password">Password</FieldLabel>
                      <Input
                        {...field}
                        id="reg-password"
                        type="password"
                        aria-invalid={fieldState.invalid}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <FieldDescription>
                        Must be at least 8 characters.
                      </FieldDescription>
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
                      <FieldLabel htmlFor="reg-confirm-password">
                        Confirm Password
                      </FieldLabel>
                      <Input
                        {...field}
                        id="reg-confirm-password"
                        type="password"
                        aria-invalid={fieldState.invalid}
                        placeholder="••••••••"
                        autoComplete="new-password"
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
                onClick={() => form.reset()}
                disabled={form.formState.isSubmitting}
              >
                Reset
              </Button>
              <Button
                type="submit"
                form="registration-form"
                disabled={form.formState.isSubmitting || googleLoading}
              >
                {form.formState.isSubmitting ? 'Creating…' : 'Sign Up'}
              </Button>
            </Field>
            <p className="text-muted-foreground text-sm">
              Already have an account?{' '}
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

      {/* Right: Image + Marketing Copy */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <Image
          src="/images/team.jpg"
          alt="Team collaborating in a modern workspace"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />

        <div className="relative z-10 flex h-full flex-col justify-center p-12 xl:p-16">
          <div className="max-w-lg space-y-6 text-white">
            <span className="inline-block rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider backdrop-blur-sm">
              Join Us
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              Start Your Career Journey Today
            </h1>
            <p className="text-lg text-white/80 xl:text-xl">
              Learn, grow, and collaborate with a passionate team. Build real
              skills while working alongside people who care about your
              success.
            </p>

            <ul className="space-y-3 pt-4 text-white/90">
              {[
                'Learn working with a team',
                'Hands-on real-world projects',
                'Mentorship from experienced developers',
                'Grow your career faster',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Registration