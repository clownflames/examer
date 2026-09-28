'use client'

import * as React from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Field,
    FieldDescription,
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
import {
    createRegistration,
    getStudentOptions,
    getInternshipOptions,
} from './actions'
import {
    type StudentOption,
    type InternshipOption,
} from './constants'
import RichTextEditor from '@/components/rich-text-editor'

const clientSchema = z.object({
    userId: z.string().min(1, 'Please select a student.'),
    internshipId: z.string().min(1, 'Please select an internship.'),
    coverLetter: z.string().max(20_000).optional().nullable(),
    resumeUrl: z
        .string()
        .url('Must be a valid URL.')
        .optional()
        .nullable()
        .or(z.literal('')),
    gainScore: z.coerce.number().int().min(0).max(1000),
})

type FormValues = z.infer<typeof clientSchema>

export function RegistrationDrawerForm({
    onSuccess,
}: {
    onSuccess: () => void
}) {
    const [submitting, setSubmitting] = React.useState(false)
    const [students, setStudents] = React.useState<StudentOption[]>([])
    const [internships, setInternships] = React.useState<InternshipOption[]>([])
    const [loading, setLoading] = React.useState(true)

    const form = useForm<FormValues>({
        resolver: zodResolver(clientSchema) as Resolver<FormValues>,
        defaultValues: {
            userId: '',
            internshipId: '',
            coverLetter: '',
            resumeUrl: '',
            gainScore: 0,
        },
    })

    React.useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const [s, i] = await Promise.all([
                    getStudentOptions(),
                    getInternshipOptions(),
                ])
                if (!mounted) return
                setStudents(s)
                setInternships(i)
            } catch (err) {
                console.error('Failed to load options:', err)
                toast.error('Failed to load students or internships.')
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [])

    async function onSubmit(values: FormValues) {
        setSubmitting(true)

        const result = await createRegistration({
            userId: values.userId,
            internshipId: values.internshipId,
            coverLetter: values.coverLetter || null,
            resumeUrl: values.resumeUrl || null,
            gainScore: values.gainScore,
        })

        setSubmitting(false)

        if (result.success) {
            toast.success('Registration created.')
            form.reset()
            onSuccess()
        } else {
            toast.error(result.error ?? 'Something went wrong.')
        }
    }

    if (loading) {
        return (
            <p className="text-muted-foreground text-sm">Loading options”¦</p>
        )
    }

    return (
        <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mx-auto flex w-full max-w-2xl flex-col gap-6"
        >
            <FieldGroup>
                {/* Student */}
                <Controller
                    name="userId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>Student</FieldLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a student" />
                                </SelectTrigger>
                                <SelectContent>
                                    {students.length === 0 ? (
                                        <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                            No students found
                                        </div>
                                    ) : (
                                        students.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} — {s.email}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                {/* Internship */}
                <Controller
                    name="internshipId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>Internship</FieldLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an internship" />
                                </SelectTrigger>
                                <SelectContent>
                                    {internships.length === 0 ? (
                                        <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                            No internships found
                                        </div>
                                    ) : (
                                        internships.map((i) => (
                                            <SelectItem key={i.id} value={i.id}>
                                                {i.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                {/* Gain score */}
                <Controller
                    name="gainScore"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="gainScore">Initial Gain Score</FieldLabel>
                            <Input
                                id="gainScore"
                                type="number"
                                min={0}
                                value={field.value ?? 0}
                                onChange={(e) =>
                                    field.onChange(
                                        e.target.value === '' ? 0 : Number(e.target.value)
                                    )
                                }
                            />
                            <FieldDescription>
                                Can be edited later from the table.
                            </FieldDescription>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                {/* Resume URL */}
                <Controller
                    name="resumeUrl"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="resumeUrl">Resume URL</FieldLabel>
                            <Input
                                {...field}
                                id="resumeUrl"
                                placeholder="https://”¦"
                                value={field.value ?? ''}
                            />
                            <FieldDescription>Optional.</FieldDescription>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                    )}
                />

                {/* Cover letter */}
                <Controller
                    name="coverLetter"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>Cover Letter</FieldLabel>
                            <RichTextEditor
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                minHeight="140px"
                                placeholder="Write the student's cover letter”¦"
                            />
                            <FieldDescription>
                                Optional. Supports bold, lists, links, and headings.
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
                    {submitting ? 'Registering”¦' : 'Register Student'}
                </Button>
            </div>
        </form>
    )
}