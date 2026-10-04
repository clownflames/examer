'use client'

import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MediaPicker } from '@/app/admin/documents/_components/media-picker'

import { createCertificate, updateCertificate } from './actions'
import {
  type CertificateInput,
  type InternshipOption,
  type UserOption,
} from './constants'

/* Client schema — dates as strings (same split as internship-form.tsx) */
const clientSchema = z.object({
  userId: z.string().min(1, 'Please select a user.'),
  title: z.string().min(2, 'Title must be at least 2 characters.').max(160),
  description: z.string().max(20_000).optional().nullable(),
  imageUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  internshipId: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
})

type ClientForm = z.infer<typeof clientSchema>

function toDateInput(value?: Date | string | null) {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function emptyToNull(v: string | null | undefined) {
  return v && v.trim() !== '' ? v : null
}

export type CertificateInitial = {
  id: string
  userId: string
  title: string
  description: string | null
  imageUrl: string | null
  internshipId: string | null
  issuedAt: Date
  expiresAt: Date | null
}

export function CertificateDrawerForm({
  onSuccess,
  mode = 'create',
  initial,
  users,
  internships,
}: {
  onSuccess: () => void
  mode?: 'create' | 'edit'
  initial?: CertificateInitial
  users: UserOption[]
  internships: InternshipOption[]
}) {
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      userId: initial?.userId ?? '',
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      imageUrl: initial?.imageUrl ?? '',
      internshipId: initial?.internshipId ?? '',
      issuedAt: toDateInput(initial?.issuedAt) || toDateInput(new Date()),
      expiresAt: toDateInput(initial?.expiresAt),
    },
  })

  async function onSubmit(values: ClientForm) {
    setSubmitting(true)

    const payload: CertificateInput = {
      userId: values.userId,
      title: values.title,
      description: emptyToNull(values.description),
      imageUrl: emptyToNull(values.imageUrl),
      internshipId: emptyToNull(values.internshipId),
      issuedAt: values.issuedAt ? new Date(values.issuedAt) : new Date(),
      expiresAt: values.expiresAt ? new Date(values.expiresAt) : null,
    }

    const result =
      mode === 'create'
        ? await createCertificate(payload)
        : await updateCertificate(initial!.id, payload)

    setSubmitting(false)

    if (result.success) {
      toast.success(
        mode === 'create' ? 'Certificate issued.' : 'Certificate updated.'
      )
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
        {/* Title */}
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="cert-title">Title</FieldLabel>
              <Input
                {...field}
                id="cert-title"
                placeholder="e.g. Frontend Development Internship"
                value={field.value ?? ''}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* User */}
        <Controller
          name="userId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Issued to</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Internship (optional) */}
        <Controller
          name="internshipId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Internship</FieldLabel>
              <Select
                value={field.value ?? '__none'}
                onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to any internship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {internships.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Optional. Links the certificate to a specific internship.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Description */}
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="cert-description">Description</FieldLabel>
              <Input
                {...field}
                id="cert-description"
                placeholder="Optional note shown on the certificate"
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Image */}
        <Controller
          name="imageUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Certificate image</FieldLabel>
              <MediaPicker
                value={field.value || null}
                onChange={field.onChange}
              />
              <FieldDescription>
                Pick from the media library. Used as the certificate preview.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Issued / expires */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="issuedAt"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cert-issuedAt">Issued on</FieldLabel>
                <Input
                  id="cert-issuedAt"
                  type="date"
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="expiresAt"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cert-expiresAt">Expires on</FieldLabel>
                <Input
                  id="cert-expiresAt"
                  type="date"
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                <FieldDescription>
                  Leave blank if it never expires.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {mode === 'create' && (
          <FieldDescription>
            A unique verification code (e.g. INTR-2026-A1B2C3) is generated
            automatically — users can verify it from the Verify Certificate
            page.
          </FieldDescription>
        )}

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
            {submitting
              ? mode === 'create'
                ? 'Issuing…'
                : 'Saving…'
              : mode === 'create'
                ? 'Issue Certificate'
                : 'Save Changes'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}