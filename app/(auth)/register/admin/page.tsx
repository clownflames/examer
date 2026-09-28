'use client'

import React, { useEffect, useState } from 'react'
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
import { IsAdminPresent, AddAdmin } from './actions'

const formSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(50, 'Name must be at most 50 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
})

function AdminRegistration() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    let mounted = true

    async function checkAdmin() {
      try {
        const isAdminPresent = await IsAdminPresent()
        if (isAdminPresent && mounted) {
          router.replace('/login')
          return
        }
      } catch (err) {
        console.error('Failed to check admin presence:', err)
      } finally {
        if (mounted) setChecking(false)
      }
    }

    checkAdmin()

    return () => {
      mounted = false
    }
  }, [router])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    const result = await AddAdmin(data)

    if (result === 'User Created Successfully') {
      toast.success(result)
      router.replace('/login')
      return
    }

    toast.error(result ?? 'Something went wrong')
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Checking setup…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full sm:max-w-md">
        <CardHeader>
          <CardTitle>Create Admin Account</CardTitle>
          <CardDescription>
            No admin exists yet. Create the first admin to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="admin-registration-form" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="admin-name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="admin-name"
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
                    <FieldLabel htmlFor="admin-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="admin-email"
                      type="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="admin@example.com"
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
                    <FieldLabel htmlFor="admin-password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="admin-password"
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
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal" className="w-full justify-end gap-2">
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
              form="admin-registration-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating…' : 'Create Admin'}
            </Button>
          </Field>
        </CardFooter>
      </Card>
    </div>
  )
}

export default AdminRegistration