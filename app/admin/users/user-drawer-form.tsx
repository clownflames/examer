'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ShieldCheck, User2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createUser } from './actions'

const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
  role: z.enum(['user', 'admin']),
})

type FormValues = z.infer<typeof clientSchema>

export function UserDrawerForm({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
    },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    const result = await createUser(values)
    setSubmitting(false)

    if (result.success) {
      toast.success('User created.')
      form.reset()
      onSuccess()
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <FieldGroup>
        {/* Role picker */}
        <Controller
          name="role"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Account Type</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <RoleCard
                  selected={field.value === 'user'}
                  onClick={() => field.onChange('user')}
                  icon={<User2 className="h-5 w-5" />}
                  title="User"
                  description="Can register for internships and take exams."
                />
                <RoleCard
                  selected={field.value === 'admin'}
                  onClick={() => field.onChange('admin')}
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Admin"
                  description="Full access to the admin dashboard."
                />
              </div>
              <FieldDescription>
                Admins can manage internships, users, and settings.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Name */}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-name">Full Name</FieldLabel>
              <Input
                {...field}
                id="user-name"
                placeholder="John Doe"
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Email */}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-email">Email</FieldLabel>
              <Input
                {...field}
                id="user-email"
                type="email"
                placeholder="user@example.com"
                autoComplete="off"
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Password */}
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-password">Password</FieldLabel>
              <Input
                {...field}
                id="user-password"
                type="text"
                placeholder="Set a temporary password"
                autoComplete="off"
                value={field.value ?? ''}
              />
              <FieldDescription>
                Minimum 8 characters. Share this securely with the user.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex justify-end gap-2 pb-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset()}
          disabled={submitting}
        >
          Reset
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*  Role card                                                                  */
/* -------------------------------------------------------------------------- */

function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
        'hover:bg-accent/50',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-input'
      )}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        {description}
      </p>
    </button>
  )
}