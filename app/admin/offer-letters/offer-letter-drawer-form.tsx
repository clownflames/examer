'use client'

import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Loader2, Upload, X } from 'lucide-react'
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
import RichTextEditor from '@/components/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  createOfferLetter,
  getOfferLetterUploadUrl,
  updateOfferLetter,
} from './actions'
import {
  STATUS_META,
  type InternshipOption,
  type OfferLetterInput,
  type OfferLetterStatus,
  type UserOption,
} from './constants'

/* Client schema — dates as strings (same split as internship-form.tsx) */
const clientSchema = z.object({
  userId: z.string().min(1, 'Please select a user.'),
  internshipId: z.string().optional().nullable(),

  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters.')
    .max(160),
  designation: z
    .string()
    .min(2, 'Designation must be at least 2 characters.')
    .max(160),
  location: z.string().max(160).optional().nullable(),
  compensation: z.string().max(80).optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  duration: z.string().max(80).optional().nullable(),
  body: z.string().max(50_000).optional().nullable(),

  pdfUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),

  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  // NOTE: `.default()` yahan nahi — wo input/output types ko alag kar deta
  // hai aur zodResolver ka useForm se match nahi hota. defaultValues set kar
  // deta hai pehle se.
  status: z.enum(['draft', 'issued', 'accepted', 'declined', 'revoked']),
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

export type OfferLetterInitial = {
  id: string
  userId: string
  internshipId: string | null
  companyName: string
  designation: string
  location: string | null
  compensation: string | null
  joiningDate: Date | null
  duration: string | null
  body: string | null
  pdfUrl: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  status: OfferLetterStatus
}

export function OfferLetterDrawerForm({
  onSuccess,
  mode = 'create',
  initial,
  users,
  internships,
}: {
  onSuccess: () => void
  mode?: 'create' | 'edit'
  initial?: OfferLetterInitial
  users: UserOption[]
  internships: InternshipOption[]
}) {
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      userId: initial?.userId ?? '',
      internshipId: initial?.internshipId ?? '',
      companyName: initial?.companyName ?? '',
      designation: initial?.designation ?? '',
      location: initial?.location ?? '',
      compensation: initial?.compensation ?? '',
      joiningDate: toDateInput(initial?.joiningDate),
      duration: initial?.duration ?? '',
      body: initial?.body ?? '',
      pdfUrl: initial?.pdfUrl ?? '',
      issuedAt: toDateInput(initial?.issuedAt),
      expiresAt: toDateInput(initial?.expiresAt),
      status: initial?.status ?? 'draft',
    },
  })

  async function onSubmit(values: ClientForm) {
    setSubmitting(true)

    const payload: OfferLetterInput = {
      userId: values.userId,
      internshipId: emptyToNull(values.internshipId),
      companyName: values.companyName,
      designation: values.designation,
      location: emptyToNull(values.location),
      compensation: emptyToNull(values.compensation),
      joiningDate: values.joiningDate ? new Date(values.joiningDate) : null,
      duration: emptyToNull(values.duration),
      body: emptyToNull(values.body),
      pdfUrl: emptyToNull(values.pdfUrl),
      issuedAt: values.issuedAt ? new Date(values.issuedAt) : null,
      expiresAt: values.expiresAt ? new Date(values.expiresAt) : null,
      status: values.status,
    }

    const result =
      mode === 'create'
        ? await createOfferLetter(payload)
        : await updateOfferLetter(initial!.id, payload)

    setSubmitting(false)

    if (result.success) {
      toast.success(
        mode === 'create' ? 'Offer letter created.' : 'Offer letter updated.'
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
        {/* Company */}
        <Controller
          name="companyName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ol-company">Company name</FieldLabel>
              <Input
                {...field}
                id="ol-company"
                placeholder="e.g. Acme Corp"
                value={field.value ?? ''}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Designation */}
        <Controller
          name="designation"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ol-designation">Designation</FieldLabel>
              <Input
                {...field}
                id="ol-designation"
                placeholder="e.g. Frontend Intern"
                value={field.value ?? ''}
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
              <FieldLabel>Offered to</FieldLabel>
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
                Optional. Links the offer to a specific internship.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Location / Compensation / Duration */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="location"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ol-location">Location</FieldLabel>
                <Input
                  {...field}
                  id="ol-location"
                  placeholder="Bengaluru"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="compensation"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ol-comp">Compensation</FieldLabel>
                <Input
                  {...field}
                  id="ol-comp"
                  placeholder="₹25,000/mo"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="duration"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ol-duration">Duration</FieldLabel>
                <Input
                  {...field}
                  id="ol-duration"
                  placeholder="3 months"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Body (rich text) */}
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Letter body</FieldLabel>
              <RichTextEditor
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                minHeight="180px"
                placeholder="Dear candidate, we are pleased to offer you…"
              />
              <FieldDescription>
                This text renders on the user&apos;s offer letter page.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* PDF attachment */}
        <Controller
          name="pdfUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Offer letter PDF</FieldLabel>
              <PdfPicker
                value={field.value || null}
                offerLetterId={initial?.id ?? null}
                onChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Joining / Issued / Expires */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="joiningDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ol-joining">Joining date</FieldLabel>
                <Input
                  id="ol-joining"
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
            name="issuedAt"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ol-issued">Issued on</FieldLabel>
                <Input
                  id="ol-issued"
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
                <FieldLabel htmlFor="ol-expires">Respond by</FieldLabel>
                <Input
                  id="ol-expires"
                  type="date"
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                <FieldDescription>Accept deadline.</FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Status */}
        <Controller
          name="status"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Status</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as OfferLetterStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s].label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <FieldDescription>
                Draft user ko dikhta nahi. &quot;Issued&quot; karne par user
                ko accept/decline option mil jayega.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {mode === 'create' && (
          <FieldDescription>
            A unique reference code (e.g. OFFR-2026-A1B2C3) is generated
            automatically — users can verify it from the Verify Offer Letter
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
                ? 'Creating…'
                : 'Saving…'
              : mode === 'create'
                ? 'Create Offer Letter'
                : 'Save Changes'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*  PDF picker — direct presigned upload to R2                                 */
/* -------------------------------------------------------------------------- */

function PdfPicker({
  value,
  offerLetterId,
  onChange,
}: {
  value: string | null
  offerLetterId: string | null
  onChange: (url: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  async function handleFile(file: File) {
    const isPdf = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')

    if (!isPdf && !isImage) {
      toast.error('Only PDF or image files are allowed.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10 MB).')
      return
    }

    setUploading(true)

    const presigned = await getOfferLetterUploadUrl({
      offerLetterId,
      fileName: file.name,
      contentType: file.type,
    })

    if (!presigned.success) {
      setUploading(false)
      toast.error(presigned.error)
      return
    }

    try {
      const res = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!res.ok) throw new Error(`Upload failed (${res.status})`)

      onChange(presigned.publicUrl)
      toast.success('File uploaded.')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <FileText className="text-muted-foreground h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {value.split('/').pop()}
            </p>
            <div className="mt-1 flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                nativeButton={false}
                render={
                  <a href={value} target="_blank" rel="noopener noreferrer" />
                }
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive h-7 w-7 px-0"
                onClick={() => onChange('')}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-16 w-full gap-2 border-dashed"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploading…' : 'Upload PDF or image'}
        </Button>
      )}
    </div>
  )
}