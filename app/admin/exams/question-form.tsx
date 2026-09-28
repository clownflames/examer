'use client'

import * as React from 'react'
import {
  useForm,
  Controller,
  useFieldArray,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Check, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor from '@/components/rich-text-editor'
import { CodeEditor } from '@/components/code-editor'
import { cn } from '@/lib/utils'
import { createQuestion, updateQuestion } from './questions-actions'
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionInput,
  type QuestionRow,
} from './questions-constants'

/* -------------------------------------------------------------------------- */
/*  Client schema                                                              */
/*                                                                             */
/*  KEY FIX: `options` is optional and MCQ-only validation runs in             */
/*  `.superRefine()`. Non-MCQ types can be submitted without any options.      */
/* -------------------------------------------------------------------------- */

const clientSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Question must be at least 2 characters.')
      .max(500),
    type: z.enum(QUESTION_TYPES),
    marks: z.coerce
      .number()
      .int()
      .positive('Marks must be a positive number.'),
    details: z.string().max(20_000).optional().nullable(),
    defaultText: z.string().max(20_000).optional().nullable(),
    options: z
      .array(
        z.object({
          labelText: z.string(),
          isCorrect: z.boolean(),
        })
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'mcq') return

    const filled = (data.options ?? []).filter(
      (o) => o.labelText.trim().length > 0
    )

    if (filled.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least 2 options.',
        path: ['options'],
      })
    }
    if (!filled.some((o) => o.isCorrect)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mark at least one option as correct.',
        path: ['options'],
      })
    }
  })

type FormValues = z.infer<typeof clientSchema>

function emptyToNull(v: string | null | undefined) {
  return v && v.trim() !== '' ? v : null
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function QuestionForm({
  examId,
  initial,
  onCancel,
  onSuccess,
}: {
  examId: string
  initial?: QuestionRow
  onCancel: () => void
  onSuccess: () => void | Promise<void>
}) {
  const isEdit = !!initial
  const [submitting, setSubmitting] = React.useState(false)
  const [codeLang, setCodeLang] = React.useState('javascript')

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initial?.name ?? '',
      type: initial?.type ?? 'mcq',
      marks: initial?.marks ?? 1,
      details: initial?.details ?? '',
      defaultText: initial?.defaultText ?? '',
      options:
        initial?.options.map((o) => ({
          labelText: o.labelText,
          isCorrect: o.isCorrect,
        })) ?? [
          { labelText: '', isCorrect: false },
          { labelText: '', isCorrect: false },
        ],
    },
    mode: 'onSubmit',
  })

  const type = useWatch({ control: form.control, name: 'type' })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  })

  // Clear stale option errors when switching away from MCQ
  React.useEffect(() => {
    if (type !== 'mcq') {
      form.clearErrors('options')
    }
  }, [type, form])

  async function onSubmit(values: FormValues) {
    setSubmitting(true)

    const cleanedOptions =
      values.type === 'mcq'
        ? (values.options ?? [])
            .map((o) => ({
              labelText: o.labelText.trim(),
              isCorrect: o.isCorrect,
            }))
            .filter((o) => o.labelText.length > 0)
        : []

    const payload: QuestionInput = {
      name: values.name,
      type: values.type,
      marks: values.marks,
      details: emptyToNull(values.details),
      defaultText: emptyToNull(values.defaultText),
      options: cleanedOptions,
    }

    const result = isEdit
      ? await updateQuestion(initial!.id, payload)
      : await createQuestion(examId, payload)

    setSubmitting(false)

    if (result.success) {
      toast.success(isEdit ? 'Question updated.' : 'Question created.')
      await onSuccess()
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  const optionsError = form.formState.errors.options
  const optionsErrorMessage =
    optionsError && 'message' in optionsError
      ? (optionsError.message as string | undefined)
      : undefined

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-5"
      noValidate
    >
      <FieldGroup>
        {/* ---------------- Type selector ---------------- */}
        <Controller
          name="type"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel>Question Type</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      field.onChange(t)
                    }}
                    className={cn(
                      'rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                      field.value === t
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-input hover:bg-accent/50'
                    )}
                    aria-pressed={field.value === t}
                  >
                    {QUESTION_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </Field>
          )}
        />

        {/* ---------------- Question + marks ---------------- */}
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="q-name">Question</FieldLabel>
                <Input
                  {...field}
                  id="q-name"
                  placeholder="Type the question…"
                  value={field.value ?? ''}
                  autoFocus
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="marks"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="q-marks">Marks</FieldLabel>
                <Input
                  id="q-marks"
                  type="number"
                  min={1}
                  value={field.value ?? 1}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? 1 : Number(e.target.value)
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

        {/* ---------------- MCQ options ---------------- */}
        {type === 'mcq' && (
          <Field data-invalid={!!optionsError}>
            <div className="flex items-center justify-between">
              <FieldLabel>Options</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  append({ labelText: '', isCorrect: false })
                }}
              >
                <Plus className="h-4 w-4" />
                Add option
              </Button>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              {fields.map((f, index) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Controller
                    name={`options.${index}.isCorrect`}
                    control={form.control}
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          field.onChange(!field.value)
                        }}
                        className={cn(
                          'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                          field.value
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-input hover:border-green-500'
                        )}
                        aria-pressed={field.value}
                        aria-label="Mark as correct"
                        title="Mark as correct"
                      >
                        {field.value && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  />
                  <div className="flex-1">
                    <Controller
                      name={`options.${index}.labelText`}
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder={`Option ${index + 1}`}
                          value={field.value ?? ''}
                        />
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault()
                      remove(index)
                    }}
                    disabled={fields.length <= 2}
                    aria-label="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <FieldDescription>
              Click the circle to mark an option as correct. You need at least
              two options with at least one correct.
            </FieldDescription>
            {optionsErrorMessage && (
              <FieldError errors={[{ message: optionsErrorMessage }]} />
            )}
          </Field>
        )}

        {/* ---------------- Text answer ---------------- */}
        {type === 'text' && (
          <Controller
            name="defaultText"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="q-defaultText">
                  Sample Answer{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  {...field}
                  id="q-defaultText"
                  placeholder="Shown as a hint or reference answer…"
                  value={field.value ?? ''}
                />
                <FieldDescription>
                  Used as a placeholder or reference answer.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        )}

        {/* ---------------- Code editor ---------------- */}
        {type === 'code' && (
          <Controller
            name="defaultText"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between">
                  <FieldLabel>
                    Starter Code{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FieldLabel>
                  <LanguageSelect value={codeLang} onChange={setCodeLang} />
                </div>
                <CodeEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  language={codeLang}
                  height="240px"
                />
                <FieldDescription>
                  Code students see in the editor when the question loads.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        )}

        {/* ---------------- Voice ---------------- */}
        {type === 'voice' && (
          <div className="bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Badge variant="secondary">Voice</Badge>
            <p>
              Students will record a spoken answer. Add any instructions in
              the Details section below.
            </p>
          </div>
        )}

        {/* ---------------- Details (rich text) ---------------- */}
        <Controller
          name="details"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Details / Instructions</FieldLabel>
              <RichTextEditor
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                minHeight="120px"
                placeholder="Add instructions, hints, or extra context for this question…"
              />
              <FieldDescription>Optional.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      {/* ---------------- Actions ---------------- */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.preventDefault()
            onCancel()
          }}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? isEdit
              ? 'Saving…'
              : 'Creating…'
            : isEdit
              ? 'Save Changes'
              : 'Add Question'}
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*  Language picker                                                            */
/* -------------------------------------------------------------------------- */

function LanguageSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="javascript">JavaScript</SelectItem>
        <SelectItem value="typescript">TypeScript</SelectItem>
        <SelectItem value="python">Python</SelectItem>
        <SelectItem value="java">Java</SelectItem>
        <SelectItem value="cpp">C++</SelectItem>
        <SelectItem value="c">C</SelectItem>
        <SelectItem value="go">Go</SelectItem>
        <SelectItem value="rust">Rust</SelectItem>
        <SelectItem value="sql">SQL</SelectItem>
        <SelectItem value="html">HTML</SelectItem>
        <SelectItem value="css">CSS</SelectItem>
        <SelectItem value="json">JSON</SelectItem>
      </SelectContent>
    </Select>
  )
}