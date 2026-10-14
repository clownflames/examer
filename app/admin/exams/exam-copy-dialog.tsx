'use client'

import * as React from 'react'
import { AlertCircle, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { copyExamToInternships } from './actions'
import type { InternshipOption } from './constants'
import { InternshipMultiSelect } from './internship-multi-select'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  examId: string
  examName: string
  internshipId: string
  internshipName: string
  orderNo: number
  questionCount: number
  internshipOptions: InternshipOption[]
  onCopied: () => void | Promise<void>
}

export function CopyExamDialog({
  open,
  onOpenChange,
  examId,
  examName,
  internshipId,
  internshipName,
  orderNo,
  questionCount,
  internshipOptions,
  onCopied,
}: Props) {
  const [targets, setTargets] = React.useState<string[]>([])
  const [copyQuestions, setCopyQuestions] = React.useState(true)
  const [nameSuffix, setNameSuffix] = React.useState('')
  const [orderMode, setOrderMode] = React.useState<'next' | 'same'>('next')
  const [makePublic, setMakePublic] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  // Defaults are re-seeded by remounting the dialog (see `key` in CopyExamButton)
  // rather than by an effect, so reopening always starts clean.

  const finalName = `${examName}${nameSuffix.trim()}`
  const canSubmit = targets.length > 0 && !pending && finalName.length <= 120

  async function handleCopy() {
    if (!canSubmit) return
    setPending(true)
    try {
      const result = await copyExamToInternships(examId, targets, {
        copyQuestions,
        nameSuffix,
        orderMode,
        makePublic,
      })

      if (!result.success) {
        toast.error(result.error ?? 'Copy failed.')
        return
      }

      await onCopied()
      toast.success(
        `Copied to ${result.created} internship${result.created === 1 ? '' : 's'}.`,
        {
          description:
            result.questionsCopied && result.questionsCopied > 0
              ? `Each copy has all ${result.questionsCopied} question${result.questionsCopied === 1 ? '' : 's'}.`
              : 'Questions were not copied.',
        }
      )
      onOpenChange(false)
    } catch (err) {
      console.error('Copy exam failed:', err)
      toast.error('Copy failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={pending ? () => {} : onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Copy exam
          </DialogTitle>
          <DialogDescription>
            Copy <strong>{examName}</strong> from {internshipName} into other
            internships.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <Field>
            <FieldLabel>Copy to internships</FieldLabel>
            <InternshipMultiSelect
              options={internshipOptions}
              value={targets}
              onChange={setTargets}
              excludeId={internshipId}
              excludeLabel="current"
              maxHeight="max-h-44"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="copy-suffix">Name suffix</FieldLabel>
            <Input
              id="copy-suffix"
              value={nameSuffix}
              onChange={(e) => setNameSuffix(e.target.value)}
              placeholder="e.g. (Java)"
              maxLength={120}
            />
            <FieldDescription>
              Appended to the exam name. Copies will be called{' '}
              <span className="text-foreground">{finalName || examName}</span>.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="copy-order">Order number</FieldLabel>
            <Select
              value={orderMode}
              onValueChange={(value) =>
                setOrderMode(value === 'same' ? 'same' : 'next')
              }
            >
              <SelectTrigger id="copy-order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">Next available in each internship</SelectItem>
                <SelectItem value="same">Same as this exam (#{orderNo})</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={copyQuestions}
              onCheckedChange={(checked) => setCopyQuestions(checked === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Copy all {questionCount} question
                {questionCount === 1 ? '' : 's'} and their options
              </span>
              <span className="text-muted-foreground text-xs">
                {questionCount === 0
                  ? 'This exam has no questions yet, so only the exam settings will be copied.'
                  : 'Each copy gets its own set of questions, so you can edit them independently.'}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <Switch
              checked={makePublic}
              onCheckedChange={setMakePublic}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Make the copies public straight away
              </span>
              <span className="text-muted-foreground text-xs">
                Copies start private so nobody sees them by accident. Flip the
                switch to publish them now.
              </span>
            </span>
          </label>

          {finalName.length > 120 && (
            <p className="text-destructive flex items-start gap-2 text-[11px]">
              <AlertCircle className="mt-px h-3 w-3 shrink-0" />
              The name is {finalName.length} characters — the limit is 120.
            </p>
          )}

          {targets.length > 0 && (
            <p className="text-muted-foreground text-[11px]">
              {targets.length} new exam{targets.length === 1 ? '' : 's'} will be
              created in the selected internship
              {targets.length === 1 ? '' : 's'}, numbered{' '}
              {orderMode === 'same'
                ? `#${orderNo} like this one`
                : 'from the next free slot in each'}
              . Students are not emailed — use the Emails button on each copy
              when you are ready.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleCopy} disabled={!canSubmit}>
            {pending ? <Loader2 className="animate-spin" /> : <Copy />}
            {pending
              ? 'Copying…'
              : targets.length > 0
                ? `Copy to ${targets.length} internship${targets.length === 1 ? '' : 's'}`
                : 'Select internships'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}