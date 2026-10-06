'use client'

import * as React from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import RichTextEditor from '@/components/rich-text-editor'
import { MediaPicker } from '@/components/admin/media-picker'
import { createDemand, updateDemand } from './actions'
import { type DemandInput } from './constants'

const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  iconUrl: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
  description: z.string().max(20_000).optional().nullable(),
  keyFeatures: z
    .array(z.object({ value: z.string().min(1, 'Feature cannot be empty.') }))
    .max(20, 'You can add at most 20 features.'),
})

type ClientForm = z.infer<typeof clientSchema>

function emptyToNull(v: string | null | undefined) {
  return v && v.trim() !== '' ? v : null
}

export type DemandInitial = {
  id: string
  name: string
  iconUrl: string | null
  description: string | null
  keyFeatures: string[] | null
}

export function DemandDrawerForm({
  onSuccess,
  mode = 'create',
  initial,
}: {
  onSuccess: () => void
  mode?: 'create' | 'edit'
  initial?: DemandInitial
}) {
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initial?.name ?? '',
      iconUrl: initial?.iconUrl ?? '',
      description: initial?.description ?? '',
      keyFeatures:
        initial?.keyFeatures && initial.keyFeatures.length > 0
          ? initial.keyFeatures.map((value) => ({ value }))
          : [{ value: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'keyFeatures',
  })

  async function onSubmit(values: ClientForm) {
    setSubmitting(true)

    const payload: DemandInput = {
      name: values.name,
      iconUrl: emptyToNull(values.iconUrl),
      description: emptyToNull(values.description),
      keyFeatures: values.keyFeatures
        .map((f) => f.value.trim())
        .filter((v) => v.length > 0),
    }

    const result =
      mode === 'create'
        ? await createDemand(payload)
        : await updateDemand(initial!.id, payload)

    setSubmitting(false)

    if (result.success) {
      toast.success(
        mode === 'create' ? 'Demand created.' : 'Demand updated.'
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
        {/* Name */}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="demand-name">Name</FieldLabel>
              <Input
                {...field}
                id="demand-name"
                placeholder="e.g. Frontend Development"
                value={field.value ?? ''}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Icon — pick from the media library or upload a new one */}
        <Controller
          name="iconUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Icon</FieldLabel>
              <MediaPicker
                value={field.value || null}
                onChange={(url) => field.onChange(url)}
                label="Icon image"
              />
              <FieldDescription>
                Optional. A small square image that represents this demand.
                Pick an existing one from your media library or upload a new
                image.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Icon URL — manual fallback */}
        <Controller
          name="iconUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="demand-iconUrl">
                Or paste an image URL
              </FieldLabel>
              <Input
                {...field}
                id="demand-iconUrl"
                placeholder="https://…"
                value={field.value ?? ''}
              />
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
                minHeight="140px"
                placeholder="Write a short description of this demand category…"
              />
              <FieldDescription>
                Supports bold, lists, links, and headings for formatting.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Key features */}
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel>Key Features</FieldLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ value: '' })}
              disabled={fields.length >= 20}
            >
              <Plus className="h-4 w-4" />
              Add feature
            </Button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {fields.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No features added. Click <strong>Add feature</strong> to start.
              </p>
            ) : (
              fields.map((f, index) => (
                <Controller
                  key={f.id}
                  name={`keyFeatures.${index}.value`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          {...field}
                          placeholder={`Feature ${index + 1}`}
                          value={field.value ?? ''}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        aria-label="Remove feature"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                />
              ))
            )}
          </div>
          <FieldDescription>
            Up to 20 short bullet points describing this demand.
          </FieldDescription>
        </Field>

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
                ? 'Create Demand'
                : 'Save Changes'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}