'use client'

import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  Search,
  Users,
  X,
} from 'lucide-react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { createTeam, getStudentCandidates } from './actions'
import type {
  TeamInput,
  InternshipOption,
  DemandOption,
  StudentCandidate,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Client schema                                                              */
/* -------------------------------------------------------------------------- */

const clientSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters.').max(120),
  internshipId: z.string().min(1, 'Please select an internship.'),
  demandId: z.string().min(1, 'Please select a demand.'),
  memberIds: z
    .array(z.string())
    .min(1, 'Add at least one student to the team.'),
})

type FormValues = z.infer<typeof clientSchema>

type SortKey = 'name' | 'gainScore' | 'examsCompleted' | 'registeredAt'
type SortDir = 'asc' | 'desc'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* -------------------------------------------------------------------------- */
/*  Main form                                                                  */
/* -------------------------------------------------------------------------- */

export function TeamDrawerForm({
  internshipOptions,
  demandOptions,
  onSuccess,
}: {
  internshipOptions: InternshipOption[]
  demandOptions: DemandOption[]
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [candidates, setCandidates] = React.useState<StudentCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState('')
  const [sortKey, setSortKey] = React.useState<SortKey>('gainScore')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [minScore, setMinScore] = React.useState('')
  const [hideTeamMembers, setHideTeamMembers] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      internshipId: '',
      demandId: '',
      memberIds: [],
    },
  })

  const internshipId = form.watch('internshipId')

  // Auto-fill demand when internship changes
  React.useEffect(() => {
    if (!internshipId) return
    const found = internshipOptions.find((i) => i.id === internshipId)
    if (found) form.setValue('demandId', found.demandId)
  }, [internshipId, internshipOptions, form])

  // Load candidates when internship changes
  React.useEffect(() => {
    if (!internshipId) {
      setCandidates([])
      setSelectedIds(new Set())
      return
    }
    let mounted = true
    setLoadingCandidates(true)
    async function load() {
      try {
        const rows = await getStudentCandidates(internshipId)
        if (!mounted) return
        setCandidates(rows)
        setSelectedIds(new Set())
      } catch (err) {
        console.error('Failed to load candidates:', err)
        toast.error('Failed to load students.')
      } finally {
        if (mounted) setLoadingCandidates(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [internshipId])

  // Keep form.memberIds in sync with selection
  React.useEffect(() => {
    form.setValue('memberIds', Array.from(selectedIds))
  }, [selectedIds, form])

  // Filter + sort candidates
  const visible = React.useMemo(() => {
    const min = minScore === '' ? null : Number(minScore)
    const q = search.trim().toLowerCase()

    const filtered = candidates.filter((c) => {
      if (hideTeamMembers && c.alreadyInTeam) return false
      if (min != null && !Number.isNaN(min) && c.gainScore < min) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    })

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'gainScore') return (a.gainScore - b.gainScore) * dir
      if (sortKey === 'examsCompleted')
        return (a.examsCompleted - b.examsCompleted) * dir
      return (
        (new Date(a.registeredAt).getTime() -
          new Date(b.registeredAt).getTime()) *
        dir
      )
    })

    return sorted
  }, [candidates, search, minScore, sortKey, sortDir, hideTeamMembers])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleMember(userId: string) {
    const candidate = candidates.find((c) => c.userId === userId)
    if (candidate?.alreadyInTeam) return

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleAll() {
    const selectable = visible.filter((c) => !c.alreadyInTeam)
    if (selectable.length === 0) return

    const allSelected = selectable.every((c) => selectedIds.has(c.userId))
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const c of selectable) next.delete(c.userId)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const c of selectable) next.add(c.userId)
        return next
      })
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)

    // Safety net: never send already-teamed users
    const safeMemberIds = Array.from(selectedIds).filter((id) => {
      const c = candidates.find((x) => x.userId === id)
      return c && !c.alreadyInTeam
    })

    if (safeMemberIds.length === 0) {
      setSubmitting(false)
      form.setError('memberIds', {
        message: 'Add at least one student to the team.',
      })
      return
    }

    const payload: TeamInput = {
      name: values.name,
      internshipId: values.internshipId,
      demandId: values.demandId,
      memberIds: safeMemberIds,
    }

    const result = await createTeam(payload)
    setSubmitting(false)

    if (result.success) {
      toast.success('Team created.')
      form.reset()
      setSelectedIds(new Set())
      onSuccess()
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  const selectedCandidates = candidates.filter(
    (c) => selectedIds.has(c.userId) && !c.alreadyInTeam
  )

  const allVisibleSelected =
    visible.filter((c) => !c.alreadyInTeam).length > 0 &&
    visible
      .filter((c) => !c.alreadyInTeam)
      .every((c) => selectedIds.has(c.userId))

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
      noValidate
    >
      <FieldGroup>
        {/* Name */}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="team-name">Team Name</FieldLabel>
              <Input
                {...field}
                id="team-name"
                placeholder="e.g. Team Alpha"
                value={field.value ?? ''}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Internship + demand */}
        <div className="grid gap-4 sm:grid-cols-2">
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
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="demandId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Demand</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!internshipId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-filled from internship" />
                  </SelectTrigger>
                  <SelectContent>
                    {demandOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Defaults to the internship&apos;s demand.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>

        {/* Candidate selection */}
        <Field data-invalid={!!form.formState.errors.memberIds}>
          <div className="flex items-center justify-between">
            <FieldLabel>
              Select Students{' '}
              <span className="text-muted-foreground font-normal">
                ({selectedIds.size} selected)
              </span>
            </FieldLabel>
            {!internshipId && (
              <span className="text-muted-foreground text-xs">
                Pick an internship first
              </span>
            )}
          </div>

          {internshipId && (
            <>
              {/* Filters */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative w-[140px]">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min score"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                  />
                </div>
                <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={hideTeamMembers}
                    onCheckedChange={(v) => setHideTeamMembers(v === true)}
                  />
                  Hide already-teamed
                </label>
                {(search || minScore || hideTeamMembers) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setMinScore('')
                      setHideTeamMembers(false)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Table */}
              <div className="mt-3 rounded-md border">
                <div className="max-h-[380px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-background sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <SortableHead
                          label="Student"
                          active={sortKey === 'name'}
                          dir={sortDir}
                          onClick={() => toggleSort('name')}
                        />
                        <SortableHead
                          label="Gain Score"
                          active={sortKey === 'gainScore'}
                          dir={sortDir}
                          onClick={() => toggleSort('gainScore')}
                          className="w-[140px]"
                        />
                        <SortableHead
                          label="Exams"
                          active={sortKey === 'examsCompleted'}
                          dir={sortDir}
                          onClick={() => toggleSort('examsCompleted')}
                          className="w-[120px]"
                        />
                        <SortableHead
                          label="Registered"
                          active={sortKey === 'registeredAt'}
                          dir={sortDir}
                          onClick={() => toggleSort('registeredAt')}
                          className="w-[140px]"
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingCandidates ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground h-24 text-center"
                          >
                            Loading students…
                          </TableCell>
                        </TableRow>
                      ) : visible.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-muted-foreground h-24 text-center"
                          >
                            No students match your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visible.map((c) => {
                          const checked = selectedIds.has(c.userId)
                          const disabled = c.alreadyInTeam

                          return (
                            <TableRow
                              key={c.registrationId}
                              className={cn(
                                'cursor-pointer',
                                checked && 'bg-accent/40',
                                disabled && 'opacity-60'
                              )}
                              onClick={() => {
                                if (!disabled) toggleMember(c.userId)
                              }}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={() => {
                                    if (!disabled) toggleMember(c.userId)
                                  }}
                                  aria-label={`Select ${c.name}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    {c.image ? (
                                      <AvatarImage
                                        src={c.image}
                                        alt={c.name}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-xs">
                                      {getInitials(c.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">
                                        {c.name}
                                      </span>
                                      {c.alreadyInTeam && (
                                        <Badge
                                          variant="destructive"
                                          className="text-[10px]"
                                        >
                                          In team: {c.teamName ?? '—'}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-muted-foreground text-xs">
                                      {c.email}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className="tabular-nums"
                                >
                                  {c.gainScore}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm tabular-nums">
                                  {c.examsCompleted}/{c.examsTotal}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {new Date(
                                  c.registeredAt
                                ).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {form.formState.errors.memberIds && (
            <FieldError errors={[form.formState.errors.memberIds]} />
          )}
        </Field>

        {/* Selected students preview */}
        {selectedCandidates.length > 0 && (
          <div className="bg-muted/40 flex flex-wrap gap-1.5 rounded-md border p-3">
            <span className="text-muted-foreground mr-1 inline-flex items-center gap-1 text-xs">
              <Users className="h-3.5 w-3.5" /> Members:
            </span>
            {selectedCandidates.map((c) => (
              <Badge key={c.userId} variant="secondary" className="gap-1">
                {c.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    toggleMember(c.userId)
                  }}
                  className="hover:text-destructive"
                  aria-label={`Remove ${c.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </FieldGroup>

      <div className="flex justify-end gap-2 pb-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset()
            setSelectedIds(new Set())
          }}
          disabled={submitting}
        >
          Reset
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Team'}
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sortable header                                                            */
/* -------------------------------------------------------------------------- */

function SortableHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className="hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  )
}