'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor from '@/components/rich-text-editor'

import { createInternship, updateInternship } from './actions'
import { type Demand, type InternshipInput } from './constants'

/* -------------------------------------------------------------------------- */
/*  Client form schema                                                         */
/*  Dates are strings here (from <input type="date">), then converted on submit */
/* -------------------------------------------------------------------------- */

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  demandId: z.string().min(1, 'Please select a demand.'),
  description: z.string().max(20_000).optional().nullable(),
  lastSubmissionDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  jdUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  price: z.coerce.number().nonnegative().optional().nullable(),
  sellingPrice: z.coerce.number().nonnegative().optional().nullable(),
  examinerName: z.string().max(120).optional().nullable(),
  examinerPhotoUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  totalScore: z.coerce.number().int().positive().default(100),
})

type FormValues = z.infer<typeof formSchema>

function toDateInput(value?: Date | string | null) {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Convert empty strings to null so the server schema's `.nullable()` branch wins. */
function emptyToNull(v: string | null | undefined) {
  return v && v.trim() !== '' ? v : null
}

export function InternshipForm({
  demands,
  mode,
  initial,
}: {
  demands: Demand[]
  mode: 'create' | 'edit'
  initial?: {
    id: string
    name: string
    demandId: string
    description: string | null
    lastSubmissionDate: Date | null
    startDate: Date | null
    endDate: Date | null
    jdUrl: string | null
    price: string | null
    sellingPrice: string | null
    examinerName: string | null
    examinerPhotoUrl: string | null
    totalScore: number
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: initial?.name ?? '',
      demandId: initial?.demandId ?? '',
      description: initial?.description ?? '',
      lastSubmissionDate: toDateInput(initial?.lastSubmissionDate),
      startDate: toDateInput(initial?.startDate),
      endDate: toDateInput(initial?.endDate),
      jdUrl: initial?.jdUrl ?? '',
      price: initial?.price ? Number(initial.price) : undefined,
      sellingPrice: initial?.sellingPrice
        ? Number(initial.sellingPrice)
        : undefined,
      examinerName: initial?.examinerName ?? '',
      examinerPhotoUrl: initial?.examinerPhotoUrl ?? '',
      totalScore: initial?.totalScore ?? 100,
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      // Shape the payload to match the server schema
      const payload: InternshipInput = {
        name: values.name,
        demandId: values.demandId,
        description: emptyToNull(values.description),
        lastSubmissionDate: values.lastSubmissionDate
          ? new Date(values.lastSubmissionDate)
          : null,
        startDate: values.startDate ? new Date(values.startDate) : null,
        endDate: values.endDate ? new Date(values.endDate) : null,
        jdUrl: emptyToNull(values.jdUrl),
        price: values.price ?? null,
        sellingPrice: values.sellingPrice ?? null,
        examinerName: emptyToNull(values.examinerName),
        examinerPhotoUrl: emptyToNull(values.examinerPhotoUrl),
        totalScore: values.totalScore,
      }

      const result =
        mode === 'create'
          ? await createInternship(payload)
          : await updateInternship(initial!.id, payload)

      if (result.success) {
        toast.success(
          mode === 'create' ? 'Internship created.' : 'Internship updated.'
        )
        router.push('/admin/internships')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Something went wrong.')
      }
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-w-3xl flex-col gap-6"
    >
      <FieldGroup>
        {/* Name */}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                {...field}
                id="name"
                placeholder="Frontend Internship"
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Demand */}
        <Controller
          name="demandId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Demand</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a demand" />
                </SelectTrigger>
                <SelectContent>
                  {demands.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Description (rich text) */}
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Description</FieldLabel>
              <RichTextEditor
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Describe the internship, responsibilities, and expectations”¦"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Dates */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="startDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                <Input
                  {...field}
                  id="startDate"
                  type="date"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="endDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="endDate">End Date</FieldLabel>
                <Input
                  {...field}
                  id="endDate"
                  type="date"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="lastSubmissionDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="lastSubmissionDate">
                  Last Submission
                </FieldLabel>
                <Input
                  {...field}
                  id="lastSubmissionDate"
                  type="date"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Prices */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="price"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="price">Price</FieldLabel>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="sellingPrice"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="sellingPrice">Selling Price</FieldLabel>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* JD URL */}
        <Controller
          name="jdUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="jdUrl">JD URL</FieldLabel>
              <Input
                {...field}
                id="jdUrl"
                placeholder="https://”¦"
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Examiner */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="examinerName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="examinerName">Examiner Name</FieldLabel>
                <Input
                  {...field}
                  id="examinerName"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="examinerPhotoUrl"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="examinerPhotoUrl">
                  Examiner Photo URL
                </FieldLabel>
                <Input
                  {...field}
                  id="examinerPhotoUrl"
                  placeholder="https://”¦"
                  value={field.value ?? ''}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Total Score */}
        <Controller
          name="totalScore"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="totalScore">Total Score</FieldLabel>
              <Input
                id="totalScore"
                type="number"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? 100}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/internships')}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === 'create'
              ? 'Creating”¦'
              : 'Saving”¦'
            : mode === 'create'
              ? 'Create Internship'
              : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}