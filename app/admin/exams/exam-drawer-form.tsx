'use client'

import * as React from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Clock, ListChecks, Target, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RichTextEditor from '@/components/rich-text-editor'
import {
  createExam,
  updateExam,
  getExamById,
  getNextOrderNo,
} from './actions'
import type { ExamInput, InternshipOption } from './constants'

/* -------------------------------------------------------------------------- */
/*  Client schema                                                              */
/* -------------------------------------------------------------------------- */

const clientSchema = z.object({
  internshipId: z.string().min(1, 'Please select an internship.'),
  orderNo: z.coerce
    .number()
    .int()
    .positive('Order must be a positive number.'),
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  description: z.string().max(20_000).optional().nullable(),
  duration: z.coerce
    .number()
    .int()
    .positive('Duration must be greater than 0.')
    .max(600, 'Duration cannot exceed 600 minutes.'),
  totalMarks: z.coerce
    .number()
    .int()
    .positive('Total marks must be positive.')
    .default(100),
  passingMarks: z
    .union([z.coerce.number().int().nonnegative(), z.literal('')])
    .optional()
    .nullable(),
})

type FormValues = z.infer<typeof clientSchema>

function emptyToNull(v: string | null | undefined) {
  return v && v.trim() !== '' ? v : null
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ExamDrawerForm({
  mode,
  examId,
  internshipOptions,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  examId?: string
  internshipOptions: InternshipOption[]
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [loading, setLoading] = React.useState(mode === 'edit')
  const [notifyStudents, setNotifyStudents] = React.useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema) as Resolver<FormValues>,
    defaultValues: {
      internshipId: '',
      orderNo: 1,
      name: '',
      description: '',
      duration: 60,
      totalMarks: 100,
      passingMarks: '',
    },
  })

  // Load exam data when editing
  React.useEffect(() => {
    if (mode !== 'edit' || !examId) return
    let mounted = true

    async function load() {
      try {
        const exam = await getExamById(examId!)
        if (!mounted || !exam) return
        form.reset({
          internshipId: exam.internshipId,
          orderNo: Number(exam.orderNo),
          name: exam.name,
          description: exam.description ?? '',
          duration: Number(exam.duration),
          totalMarks: Number(exam.totalMarks),
          passingMarks: exam.passingMarks ?? '',
        })
      } catch (err) {
        console.error('Failed to load exam:', err)
        toast.error('Failed to load exam details.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [mode, examId, form])

  // Auto-suggest next order number when internship changes (create mode only)
  const selectedInternshipId = form.watch('internshipId')
  React.useEffect(() => {
    if (mode !== 'create' || !selectedInternshipId) return
    let mounted = true

    async function suggestOrder() {
      try {
        const next = await getNextOrderNo(selectedInternshipId)
        if (mounted) form.setValue('orderNo', next)
      } catch (err) {
        console.error('Failed to suggest order:', err)
      }
    }

    suggestOrder()
    return () => {
      mounted = false
    }
  }, [mode, selectedInternshipId, form])

  async function onSubmit(values: FormValues) {
    if (
      values.passingMarks !== '' &&
      values.passingMarks != null &&
      Number(values.passingMarks) > values.totalMarks
    ) {
      form.setError('passingMarks', {
        message: 'Passing marks cannot exceed total marks.',
      })
      return
    }

    setSubmitting(true)

    const payload: ExamInput = {
      internshipId: values.internshipId,
      orderNo: values.orderNo,
      name: values.name,
      description: emptyToNull(values.description),
      duration: values.duration,
      totalMarks: values.totalMarks,
      passingMarks:
        values.passingMarks === '' || values.passingMarks == null
          ? null
          : Number(values.passingMarks),
    }

    if (mode === 'create') {
      const result = await createExam({ ...payload, notifyStudents })
      setSubmitting(false)

      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong.')
        return
      }

      const n = result.notified
      if (notifyStudents && n) {
        if (n.sent > 0) {
          toast.success(
            `Exam created. ${n.sent} of ${n.recipients} students emailed.`,
            { description: n.message }
          )
        } else {
          toast.warning('Exam created, but no emails were sent.', {
            description: n.message,
          })
        }
      } else {
        toast.success('Exam created.')
      }

      form.reset()
      onSuccess()
      return
    }

    const result = await updateExam(examId!, payload)
    setSubmitting(false)

    if (result.success) {
      toast.success('Exam updated.')
      form.reset()
      onSuccess()
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading exam”¦</p>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <FieldGroup>
        {/* Internship */}
        <Controller
          name="internshipId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Internship</FieldLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an internship" />
                </SelectTrigger>
                <SelectContent>
                  {internshipOptions.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1.5 text-sm">
                      No internships available
                    </div>
                  ) : (
                    internshipOptions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FieldDescription>
                The exam will belong to this internship.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Order + Name side by side */}
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Controller
            name="orderNo"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="exam-orderNo">Order</FieldLabel>
                <Input
                  id="exam-orderNo"
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

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="exam-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="exam-name"
                  placeholder="e.g. Aptitude Round 1"
                  value={field.value ?? ''}
                  autoFocus
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

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
                placeholder="Describe what this exam covers, rules, and instructions”¦"
              />
              <FieldDescription>
                Supports bold, lists, links, and headings.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Duration */}
        <Controller
          name="duration"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="exam-duration">
                Duration (minutes)
              </FieldLabel>
              <div className="relative">
                <Clock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="exam-duration"
                  type="number"
                  min={1}
                  max={600}
                  className="pl-9"
                  value={field.value ?? 60}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? 60 : Number(e.target.value)
                    )
                  }
                />
              </div>
              <FieldDescription>
                How long students have to complete the exam.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Marks grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="totalMarks"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="exam-totalMarks">Total Marks</FieldLabel>
                <div className="relative">
                  <Trophy className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="exam-totalMarks"
                    type="number"
                    min={1}
                    className="pl-9"
                    value={field.value ?? 100}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === '' ? 100 : Number(e.target.value)
                      )
                    }
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="passingMarks"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="exam-passingMarks">
                  Passing Marks
                </FieldLabel>
                <div className="relative">
                  <Target className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="exam-passingMarks"
                    type="number"
                    min={0}
                    className="pl-9"
                    placeholder="Optional"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                </div>
                <FieldDescription>
                  Leave empty if there is no passing threshold.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Notify students (create mode only) */}
        {mode === 'create' && (
          <Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <Switch
                checked={notifyStudents}
                onCheckedChange={setNotifyStudents}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Email students that this exam is ready
                </span>
                <span className="text-muted-foreground text-xs">
                  Sends a notification to every student with a paid
                  registration for this internship. You can also send it later
                  from the Exams table.
                </span>
              </span>
            </label>
          </Field>
        )}

        {/* Info banner */}
        <div className="bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-lg border p-3 text-sm">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            After saving, open the exam from the table to add questions, set
            question types (MCQ, text, code, voice), and configure marks.
            {mode === 'create' &&
              ' If you ticked the box above, students are emailed as soon as the exam is saved — add your questions first if you would rather they received it later.'}
          </p>
        </div>
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
          {submitting
            ? mode === 'create'
              ? 'Creating”¦'
              : 'Saving”¦'
            : mode === 'create'
              ? 'Create Exam'
              : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}